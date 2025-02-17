import { exec as cpExec } from 'node:child_process'
import { promisify } from 'node:util'
import { ConfigManager } from '../config/ConfigManager.js'
import { DockerRepository } from '../../src/types/config'
import fetch from 'node-fetch'

const exec = promisify(cpExec)

interface DockerImage {
    name: string
    currentVersion: string | null
    latestVersion: string | null
    versionsBehind: number | null
    updateAvailable: boolean
    error?: string
    currentDigest?: string
    latestDigest?: string
    currentCreated?: string
    latestCreated?: string
    currentCommitMessage?: string
    latestCommitMessage?: string
    repoUrl?: string
    labels?: Record<string, string>
    architecture?: string
    os?: string
    installed: boolean
}

interface DockerImageInfo {
    RepoTags: string[]
}

interface SkopeoInspectResponse {
    Name: string
    Digest: string
    RepoTags: string[]
    Created: string
    DockerVersion: string
    Labels: Record<string, string>
    Architecture: string
    Os: string
    Layers: string[]
}

interface GitHubCommitResponse {
    commit: {
        message: string
    }
}

function extractGitHubInfo(repository: string): { owner: string; repo: string } | null {
    // Handle GitHub Container Registry URLs
    const ghcrMatch = repository.match(/ghcr\.io\/([^\/]+)\/([^\/]+)/)
    if (ghcrMatch) {
        return { owner: ghcrMatch[1], repo: ghcrMatch[2] }
    }
    
    // Handle Docker Hub URLs that point to GitHub
    const dockerHubMatch = repository.match(/([^\/]+)\/([^\/]+)$/)
    if (dockerHubMatch) {
        return { owner: dockerHubMatch[1], repo: dockerHubMatch[2] }
    }
    
    return null
}

async function getCommitMessage(owner: string, repo: string, sha: string): Promise<string | undefined> {
    try {
        console.log(`Fetching commit message for ${owner}/${repo} commit ${sha}`)
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`)
        
        if (!response.ok) {
            console.error(`Failed to fetch commit message: ${response.statusText}`)
            return undefined
        }
        
        const data = await response.json() as GitHubCommitResponse
        return data.commit.message
    } catch (error) {
        console.error('Error fetching commit message:', error instanceof Error ? error.message : 'Unknown error')
        return undefined
    }
}

async function getAvailableTags(repository: string): Promise<string[]> {
    try {
        console.log(`Discovering available tags for ${repository}`)
        const { stdout } = await exec(`skopeo list-tags docker://${repository}`)
        const response = JSON.parse(stdout) as { Tags: string[] }
        console.log(`Found tags for ${repository}:`, response.Tags)
        return response.Tags
    } catch (error) {
        console.log(`Failed to get tags for ${repository}, falling back to default tags:`, error instanceof Error ? error.message : 'Unknown error')
        // Fallback to common tags if we can't fetch them
        return ['stable', 'latest', 'edge', 'master', 'dev-wolfapi']
    }
}

async function getImageInfo(repository: string, tag: string = 'stable'): Promise<SkopeoInspectResponse> {
    // Try the specified tag first
    try {
        const command = `skopeo inspect docker://${repository}:${tag}`
        console.log(`Trying primary tag - Executing command: ${command}`)
        const { stdout } = await exec(command)
        console.log(`Successfully found remote image with primary tag: ${repository}:${tag}`)
        console.log('Raw skopeo inspect response:', stdout)
        
        const parsedResponse = JSON.parse(stdout) as SkopeoInspectResponse
        console.log('Primary tag Labels:', parsedResponse.Labels)
        
        return parsedResponse
    } catch (error) {
        console.log(`Failed to find remote image with primary tag ${repository}:${tag}, trying alternatives`)
    }
    
    // If primary tag fails, try alternatives
    const tagsToTry = await getAvailableTags(repository)
    console.log(`Trying alternative tags:`, tagsToTry)
    
    for (const tryTag of tagsToTry) {
        try {
            const command = `skopeo inspect docker://${repository}:${tryTag}`
            console.log(`Trying alternative tag - Executing command: ${command}`)
            const { stdout } = await exec(command)
            console.log(`Successfully found remote image with tag: ${repository}:${tryTag}`)
            console.log('Raw skopeo inspect response:', stdout)
            
            const parsedResponse = JSON.parse(stdout) as SkopeoInspectResponse
            console.log('Alternative tag Labels:', parsedResponse.Labels)
            
            // Verify if we're getting the description
            if (parsedResponse.Labels['org.opencontainers.image.description']) {
                console.log('Found description:', parsedResponse.Labels['org.opencontainers.image.description'])
            } else {
                console.log('No description found in labels')
                console.log('Available label keys:', Object.keys(parsedResponse.Labels))
            }
            
            return parsedResponse
        } catch (error) {
            console.log(`Failed to find remote image ${repository}:${tryTag}:`, error instanceof Error ? error.message : 'Unknown error')
            continue
        }
    }
    
    throw new Error(`Failed to inspect image ${repository} with any known tag`)
}

async function getLocalImageInfo(repository: string, tag: string): Promise<SkopeoInspectResponse | null> {
    try {
        console.log(`Inspecting local image ${repository}`)
        
        // Array of possible image name variations
        const nameVariations = [
            repository,                          // Full name: ghcr.io/games-on-whales/firefox
            repository.split('/').pop() || '',   // Short name: firefox
            repository.split('/').slice(-2).join('/') // Medium name: games-on-whales/firefox
        ]

        // Get available tags from the repository
        const tagsToTry = await getAvailableTags(repository)
        
        console.log('Trying the following combinations:')
        for (const name of nameVariations) {
            for (const tryTag of tagsToTry) {
                const fullName = `${name}:${tryTag}`
                try {
                    const command = `skopeo inspect docker-daemon:${fullName}`
                    console.log(`Executing command: ${command}`)
                    const { stdout } = await exec(command)
                    console.log(`Successfully found local image: ${fullName}`)
                    console.log('Raw local image inspect response:', stdout)
                    
                    const parsedResponse = JSON.parse(stdout) as SkopeoInspectResponse
                    console.log('Local image labels:', parsedResponse.Labels)
                    
                    // Verify if we're getting the description
                    if (parsedResponse.Labels['org.opencontainers.image.description']) {
                        console.log('Found local description:', parsedResponse.Labels['org.opencontainers.image.description'])
                    } else {
                        console.log('No description found in local image labels')
                        console.log('Available local label keys:', Object.keys(parsedResponse.Labels))
                    }
                    
                    return parsedResponse
                } catch (error) {
                    console.log(`Failed to find image as ${fullName}:`, error instanceof Error ? error.message : 'Unknown error')
                    continue
                }
            }
        }
        
        // If we get here, no image was found with any variation
        console.log(`No local image found for ${repository} after trying all name and tag variations`)
        return null
    } catch (error) {
        console.error(`Error in getLocalImageInfo for ${repository}:`, error instanceof Error ? error.message : 'Unknown error')
        return null
    }
}

async function getLatestVersion(repository: string): Promise<{ 
    version: string | null
    digest: string | undefined
    created: string | undefined
    labels: Record<string, string> | undefined 
}> {
    try {
        console.log(`Getting latest version for ${repository}`)
        const imageInfo = await getImageInfo(repository)
        console.log(`Image info for ${repository}:`, imageInfo)
        
        return {
            version: 'stable',
            digest: imageInfo.Digest,
            created: imageInfo.Created,
            labels: imageInfo.Labels
        }
    } catch (error) {
        console.error(`Error checking updates for ${repository}:`, error instanceof Error ? error.message : 'Unknown error')
        return { 
            version: null, 
            digest: undefined, 
            created: undefined, 
            labels: undefined 
        }
    }
}

function calculateVersionsBehind(current: string | null, latest: string | null): number {
    // If either version is null, we can't calculate the difference
    if (current === null || latest === null) return 0
    
    // For non-semantic versions, we'll just return 1 if versions are different
    // This indicates an update is available without trying to calculate the difference
    return current !== latest ? 1 : 0
}

// Cache for update results
let lastUpdateCheck: {
    results: DockerImage[]
} | null = null

async function processRepository(repo: DockerRepository): Promise<DockerImage> {
    try {
        console.log(`\n=== Processing repository: ${repo.repository} ===`)
        
        // Extract GitHub repository information
        const githubInfo = extractGitHubInfo(repo.repository)
        const repoUrl = githubInfo ? `https://github.com/${githubInfo.owner}/${githubInfo.repo}` : undefined
        console.log(`GitHub info:`, githubInfo)
        
        // Check if we have the image locally using skopeo
        console.log(`Checking for local installation...`)
        const localInfo = await getLocalImageInfo(repo.repository, 'stable')
        console.log(`Local installation status:`, localInfo ? 'Installed' : 'Not installed')
        
        // Always check remote regardless of local installation
        try {
            console.log(`Checking remote repository...`)
            const imageInfo = await getImageInfo(repo.repository, 'stable')
            console.log(`Remote check successful`)
            console.log('Remote image labels:', imageInfo.Labels)
            console.log('Raw Labels object:', JSON.stringify(imageInfo.Labels, null, 2))
            
            // Get commit messages if we have GitHub info
            let currentCommitMessage, latestCommitMessage
            if (githubInfo && localInfo) {
                console.log(`Fetching commit messages...`)
                if (localInfo.Labels['org.opencontainers.image.revision']) {
                    currentCommitMessage = await getCommitMessage(
                        githubInfo.owner,
                        githubInfo.repo,
                        localInfo.Labels['org.opencontainers.image.revision']
                    )
                }
                if (imageInfo.Labels['org.opencontainers.image.revision']) {
                    latestCommitMessage = await getCommitMessage(
                        githubInfo.owner,
                        githubInfo.repo,
                        imageInfo.Labels['org.opencontainers.image.revision']
                    )
                }
            }
            
            const updateAvailable = localInfo ? imageInfo.Digest !== localInfo.Digest : false
            console.log(`Update status: ${updateAvailable ? 'Update available' : 'Up to date'}`)
            
            // Use remote image labels as they are more likely to be complete
            const labels = imageInfo.Labels
            console.log('Using labels:', labels)
            
            return {
                name: repo.name,
                currentVersion: localInfo ? 'stable' : null,
                latestVersion: 'stable',
                versionsBehind: 0,
                updateAvailable,
                currentDigest: localInfo?.Digest,
                latestDigest: imageInfo.Digest,
                currentCreated: localInfo?.Created,
                latestCreated: imageInfo.Created,
                currentCommitMessage,
                latestCommitMessage,
                repoUrl,
                labels,  // Use the labels directly from skopeo
                architecture: imageInfo.Architecture,
                os: imageInfo.Os,
                installed: !!localInfo
            }
        } catch (error) {
            console.error(`Error checking remote image:`, error)
            // If we have local info, show it
            if (localInfo) {
                console.log(`Using local info only due to remote check failure`)
                return {
                    name: repo.name,
                    currentVersion: 'stable',
                    latestVersion: null,
                    versionsBehind: null,
                    updateAvailable: false,
                    currentDigest: localInfo.Digest,
                    currentCreated: localInfo.Created,
                    repoUrl,
                    labels: localInfo.Labels,  // Use local labels if remote check fails
                    architecture: localInfo.Architecture,
                    os: localInfo.Os,
                    error: 'Failed to check for updates',
                    installed: true
                }
            } else {
                console.log(`No local installation found and remote check failed`)
                return {
                    name: repo.name,
                    currentVersion: null,
                    latestVersion: null,
                    versionsBehind: null,
                    updateAvailable: false,
                    repoUrl,
                    error: 'Failed to check image',
                    installed: false
                }
            }
        }
    } catch (error) {
        console.error('Error processing repository:', error)
        return {
            name: repo.name,
            currentVersion: null,
            latestVersion: null,
            versionsBehind: null,
            updateAvailable: false,
            error: 'Failed to process repository',
            installed: false
        }
    }
}

async function checkUpdates(forceRefresh = false): Promise<DockerImage[]> {
    // Return cached results if available and not forcing refresh
    if (!forceRefresh && lastUpdateCheck) {
        console.log('Returning cached update results')
        return lastUpdateCheck.results
    }

    console.log('Starting update check')
    const configManager = await ConfigManager.getInstance()
    const config = configManager.getConfig()
    console.log('Config loaded:', config)
    
    // Process all repositories in parallel
    const updatePromises = config.wolfRepositories.map(repo => processRepository(repo))
    const updates = await Promise.all(updatePromises)

    // Sort updates: Updates first, then installed, then not installed
    updates.sort((a, b) => {
        if (a.updateAvailable && !b.updateAvailable) return -1
        if (!a.updateAvailable && b.updateAvailable) return 1
        if (a.installed && !b.installed) return -1
        if (!a.installed && b.installed) return 1
        return a.name.localeCompare(b.name)
    })

    // Update cache
    lastUpdateCheck = {
        results: updates
    }

    console.log('\nUpdate check complete. Results:', updates)
    return updates
}

export type { DockerImage }
export default {
    checkUpdates,
} 