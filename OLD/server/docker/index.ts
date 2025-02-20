import { request } from 'http'
import type { RequestOptions, IncomingMessage } from 'http'
import { exec as cpExec } from 'node:child_process'
import { promisify } from 'node:util'
import express from 'express'
import dockerService from './service.js'

const exec = promisify(cpExec)

interface DockerImage {
    name: string
    currentVersion: string
    latestVersion: string | null
    versionsBehind: number | null
    updateAvailable: boolean
    error?: string
}

interface DockerImageInfo {
    RepoTags: string[]
}

async function makeDockerRequest(path: string, method = 'GET'): Promise<any> {
    return new Promise((resolve, reject) => {
        const socketPath = '/var/run/docker.sock'
        
        const options: RequestOptions = {
            socketPath,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        }

        const req = request(options, (res: IncomingMessage) => {
            let data = ''
            
            res.on('data', chunk => {
                data += chunk
            })
            
            res.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : null)
                } catch (error) {
                    reject(new Error(`Failed to parse Docker API response: ${error instanceof Error ? error.message : 'Unknown error'}`))
                }
            })
        })

        req.on('error', (error) => {
            reject(new Error(`Docker API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
        })

        req.end()
    })
}

async function getLocalImages(): Promise<string[]> {
    try {
        const images = await makeDockerRequest('/v1.41/images/json')
        return images
            .filter((img: DockerImageInfo) => 
                img.RepoTags && 
                img.RepoTags.some(tag => tag.toLowerCase().includes('wolf')))
            .flatMap((img: DockerImageInfo) => img.RepoTags)
    } catch (error) {
        console.error('Error fetching local images:', error instanceof Error ? error.message : 'Unknown error')
        return []
    }
}

async function getLatestVersion(imageName: string): Promise<string | null> {
    try {
        // First try to pull the latest image
        await makeDockerRequest(`/v1.41/images/create?fromImage=${imageName}`, 'POST')
        
        // Then get the updated image info
        const images = await makeDockerRequest('/v1.41/images/json')
        const image = images.find((img: DockerImageInfo) => 
            img.RepoTags && 
            img.RepoTags.some(tag => tag.startsWith(imageName)))

        if (!image || !image.RepoTags || image.RepoTags.length === 0) {
            return null
        }

        const tag = image.RepoTags[0].split(':')[1]
        return tag || null
    } catch (error) {
        console.error(`Error checking updates for ${imageName}:`, error instanceof Error ? error.message : 'Unknown error')
        return null
    }
}

function calculateVersionsBehind(current: string, latest: string): number {
    // This is a simple implementation - you might want to enhance this based on your versioning scheme
    const currentParts = current.split('.')
    const latestParts = latest.split('.')
    
    for (let i = 0; i < Math.min(currentParts.length, latestParts.length); i++) {
        const currentNum = parseInt(currentParts[i], 10)
        const latestNum = parseInt(latestParts[i], 10)
        if (latestNum > currentNum) return latestNum - currentNum
    }
    
    return 0
}

const router = express.Router()

router.get('/updates', async (req, res) => {
    try {
        const forceRefresh = req.query.force === 'true'
        const images = await dockerService.checkUpdates(forceRefresh)
        res.json({ images })
    } catch (error) {
        console.error('Error checking for updates:', error instanceof Error ? error.message : 'Unknown error')
        res.status(500).json({ 
            error: 'Failed to check for updates',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
})

router.post('/update/:repository', async (req, res) => {
    let repository = decodeURIComponent(req.params.repository)
    
    try {
        // Ensure the repository has the full path if it's a Firefox image
        if (repository.toLowerCase() === 'firefox') {
            repository = 'ghcr.io/games-on-whales/firefox'
        }
        
        console.log(`Processing update request for repository: ${repository}`)
        
        // Get the current image info to get the correct tag
        const images = await dockerService.checkUpdates(true)
        console.log('Available images:', images.map(img => ({ name: img.name, current: img.currentVersion, latest: img.latestVersion })))
        
        const imageToUpdate = images.find(img => img.name === repository)
        
        if (!imageToUpdate) {
            console.error(`Image not found in available images: ${repository}`)
            throw new Error(`Image ${repository} not found`)
        }

        console.log('Image to update:', {
            name: imageToUpdate.name,
            currentVersion: imageToUpdate.currentVersion,
            latestVersion: imageToUpdate.latestVersion,
            updateAvailable: imageToUpdate.updateAvailable
        })

        // Use the latest version tag or fallback to stable
        const tag = imageToUpdate.latestVersion || 'stable'
        const fullImageName = `${repository}:${tag}`
        console.log(`Pulling image: ${fullImageName}`)

        try {
            // Get remote image digest first
            console.log(`Executing skopeo inspect for remote image: docker://${fullImageName}`)
            const { stdout: remoteStdout, stderr: remoteStderr } = await exec(`skopeo inspect docker://${fullImageName}`)
            if (remoteStderr) {
                console.warn('Skopeo inspect warning:', remoteStderr)
            }
            
            const remoteInfo = JSON.parse(remoteStdout)
            const expectedDigest = remoteInfo.Digest
            console.log(`Remote image info:`, {
                digest: expectedDigest,
                created: remoteInfo.Created,
                architecture: remoteInfo.Architecture
            })

            // Pull the image using Docker API
            console.log(`Pulling image using Docker API: ${fullImageName}`)
            await makeDockerRequest(`/v1.41/images/create?fromImage=${encodeURIComponent(fullImageName)}`, 'POST')
            
            // Get the local image info to verify
            console.log('Fetching local image info for verification')
            const images = await makeDockerRequest('/v1.41/images/json')
            const localImage = images.find((img: any) => 
                img.RepoTags && 
                img.RepoTags.some((tag: string) => tag === fullImageName)
            )

            if (!localImage) {
                console.error('Local image not found after pull. Available images:', 
                    images.map((img: any) => img.RepoTags).flat().filter(Boolean))
                throw new Error('Failed to find pulled image locally')
            }

            // Compare digests
            const localDigest = localImage.Id.replace('sha256:', '')
            console.log('Image verification:', {
                expected: expectedDigest,
                actual: localDigest,
                match: localDigest === expectedDigest.replace('sha256:', '')
            })

            if (!localDigest || localDigest !== expectedDigest.replace('sha256:', '')) {
                console.error('Digest mismatch:', {
                    expected: expectedDigest,
                    actual: localDigest
                })
                throw new Error('Update verification failed: image digest mismatch')
            }

            console.log('Update verification successful:', {
                image: fullImageName,
                digest: expectedDigest
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            console.error('Update operation failed:', {
                phase: 'image pull and verification',
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        }

        // Force refresh the update check to get new status
        const updatedImages = await dockerService.checkUpdates(true)
        res.json({ 
            success: true,
            images: updatedImages
        })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error updating image:', {
            repository: repository,
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        })
        res.status(500).json({ 
            error: 'Failed to update image',
            details: errorMessage
        })
    }
})

export type { DockerImage }
export default router 