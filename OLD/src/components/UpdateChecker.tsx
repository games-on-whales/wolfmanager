import { useEffect, useState } from 'react'
import { 
    Card, 
    CardContent, 
    CardHeader, 
    Chip, 
    Divider, 
    CircularProgress, 
    Typography,
    Box,
    IconButton,
    Link,
    Tooltip,
    Button,
    Theme
} from '@mui/material'
import { LoadingButton } from '@mui/lab'
import { dockerAPI } from '../services/api/docker'
import type { DockerImage } from '../services/api/docker/types'
import {
    GitHub as GitHubIcon,
    Refresh as RefreshIcon,
    Update as UpdateIcon
} from '@mui/icons-material'

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString()
}

function getTagColor(tag: string): "info" | "secondary" {
    return tag.startsWith('dev-') ? "secondary" : "info"
}

export function UpdateChecker() {
    const [images, setImages] = useState<DockerImage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [updatingImages, setUpdatingImages] = useState<Set<string>>(new Set())

    const checkUpdates = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setIsRefreshing(true)
            const response = await dockerAPI.checkUpdates(forceRefresh)
            console.log('Docker update response:', response)
            console.log('First image labels:', response.images[0]?.labels)
            console.log('First image description:', response.images[0]?.labels?.['org.opencontainers.image.description'])
            console.log('First image licenses:', response.images[0]?.labels?.['org.opencontainers.image.licenses'])
            setImages(response.images)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check for updates')
        } finally {
            setIsLoading(false)
            if (forceRefresh) setIsRefreshing(false)
        }
    }

    const handleUpdate = async (repository: string) => {
        try {
            setUpdatingImages((prev: Set<string>) => new Set(prev).add(repository))
            const response = await dockerAPI.updateImage(repository)
            setImages(response.images)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update image')
        } finally {
            setUpdatingImages((prev: Set<string>) => {
                const newSet = new Set(prev)
                newSet.delete(repository)
                return newSet
            })
        }
    }

    useEffect(() => {
        checkUpdates(false)
    }, [])

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress size={40} />
            </Box>
        )
    }

    if (error) {
        return (
            <Box p={2}>
                <Card>
                    <CardContent>
                        <Typography color="error">{error}</Typography>
                    </CardContent>
                </Card>
            </Box>
        )
    }

    return (
        <Box p={2} sx={{ '& > *': { mb: 2 }, maxWidth: '1200px', margin: '0 auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" component="h1">
                    Updates
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<RefreshIcon />}
                    onClick={() => checkUpdates(true)}
                    disabled={isRefreshing}
                    aria-label="Check for updates"
                    color="primary"
                >
                    {isRefreshing ? 'Checking...' : 'Check for Updates'}
                </Button>
            </Box>
            {images.map((image: DockerImage) => (
                <Card 
                    key={image.name} 
                    elevation={0}
                    sx={{
                        position: 'relative',
                        bgcolor: (theme: Theme) => theme.palette.mode === 'dark' 
                            ? 'rgba(30, 41, 59, 1)' 
                            : 'rgba(255, 255, 255, 1)',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflow: 'hidden',
                        transform: 'none !important',
                        transition: 'none !important'
                    }}
                >
                    <CardHeader
                        title={
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Typography variant="h6" component="h2">{image.name}</Typography>
                                        {image.installed && (
                                            <Chip 
                                                label={image.currentVersion || 'stable'}
                                                color={getTagColor(image.currentVersion || 'stable')}
                                                size="small"
                                                sx={{ minWidth: 60 }}
                                            />
                                        )}
                                    </Box>
                                    {image.currentCreated && (
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ display: 'block', mb: 1 }}
                                        >
                                            Last Updated • {formatDate(image.currentCreated)}
                                        </Typography>
                                    )}
                                    {image.labels?.['org.opencontainers.image.description'] && (
                                        <Typography 
                                            variant="body2" 
                                            color="text.secondary"
                                            sx={{ mb: 1 }}
                                        >
                                            {image.labels['org.opencontainers.image.description']}
                                        </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {image.labels?.['org.opencontainers.image.licenses'] && (
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label={`License: ${image.labels['org.opencontainers.image.licenses']}`}
                                                sx={{ 
                                                    bgcolor: 'background.default',
                                                    fontSize: '0.75rem'
                                                }}
                                            />
                                        )}
                                        {image.architecture && (
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label={`${image.architecture}${image.os ? ` / ${image.os}` : ''}`}
                                                sx={{ 
                                                    bgcolor: 'background.default',
                                                    fontSize: '0.75rem'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {image.repoUrl && (
                                        <Tooltip title="View on GitHub">
                                            <IconButton
                                                component={Link}
                                                href={image.repoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="View on GitHub"
                                                sx={{ 
                                                    color: 'text.secondary',
                                                    '&:hover': {
                                                        color: 'text.primary'
                                                    }
                                                }}
                                            >
                                                <GitHubIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {image.updateAvailable ? (
                                        <LoadingButton 
                                            loading={updatingImages.has(image.name)}
                                            loadingPosition="start"
                                            startIcon={<UpdateIcon />}
                                            variant="contained"
                                            color="warning"
                                            onClick={() => handleUpdate(image.name)}
                                            sx={{
                                                minWidth: 120
                                            }}
                                        >
                                            Update
                                        </LoadingButton>
                                    ) : image.installed ? (
                                        <Chip 
                                            label="Up to Date" 
                                            color="success" 
                                            variant="outlined"
                                            sx={{
                                                borderWidth: 1,
                                                fontWeight: 500
                                            }}
                                        />
                                    ) : (
                                        <Chip 
                                            label="Not Installed" 
                                            color="default" 
                                            variant="outlined"
                                            sx={{
                                                borderWidth: 1,
                                                fontWeight: 500
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        }
                        sx={{
                            p: 2,
                            '& .MuiCardHeader-content': {
                                flex: 1
                            }
                        }}
                    />
                    {(image.updateAvailable || image.error) && <Divider />}
                    {(image.updateAvailable || image.error) && (
                        <CardContent>
                            {image.updateAvailable && (
                                <Box 
                                    sx={{ 
                                        display: 'flex',
                                        gap: 2,
                                        p: 2,
                                        bgcolor: (theme: Theme) => theme.palette.mode === 'dark'
                                            ? 'rgba(25, 118, 210, 0.05)'
                                            : 'rgba(25, 118, 210, 0.02)',
                                        borderRadius: 1,
                                        border: '2px solid',
                                        borderColor: 'info.main'
                                    }}
                                >
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Typography 
                                                variant="subtitle2" 
                                                color="info.main"
                                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                            >
                                                Available Update
                                                {image.latestCreated && (
                                                    <Typography 
                                                        component="span" 
                                                        variant="body2" 
                                                        color="text.secondary"
                                                    >
                                                        • {formatDate(image.latestCreated)}
                                                    </Typography>
                                                )}
                                            </Typography>
                                        </Box>
                                        {image.latestCommitMessage && (
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    mt: 1,
                                                    p: 1.5,
                                                    bgcolor: (theme: Theme) => theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'rgba(0, 0, 0, 0.03)',
                                                    borderRadius: 1,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                {image.latestCommitMessage}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            )}

                            {image.error && (
                                <Typography 
                                    color="error" 
                                    variant="body2" 
                                    sx={{ 
                                        mt: 2,
                                        p: 1.5,
                                        bgcolor: (theme: Theme) => theme.palette.mode === 'dark'
                                            ? 'rgba(211, 47, 47, 0.05)'
                                            : 'rgba(211, 47, 47, 0.02)',
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'error.main'
                                    }}
                                >
                                    {image.error}
                                </Typography>
                            )}
                        </CardContent>
                    )}
                </Card>
            ))}
        </Box>
    )
} 