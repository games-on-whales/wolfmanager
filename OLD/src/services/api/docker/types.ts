export interface DockerImage {
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
    labels?: {
        'org.opencontainers.image.created'?: string
        'org.opencontainers.image.description'?: string
        'org.opencontainers.image.licenses'?: string
        'org.opencontainers.image.ref.name'?: string
        'org.opencontainers.image.revision'?: string
        'org.opencontainers.image.source'?: string
        'org.opencontainers.image.title'?: string
        'org.opencontainers.image.url'?: string
        'org.opencontainers.image.version'?: string
    }
    architecture?: string
    os?: string
    installed: boolean
}

export interface DockerUpdateResponse {
    images: DockerImage[]
    error?: string
} 