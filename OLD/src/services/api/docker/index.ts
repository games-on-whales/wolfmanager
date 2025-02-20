import { BaseAPI } from '../base'
import type { DockerUpdateResponse } from './types'

class DockerAPI extends BaseAPI {
    private readonly BASE_PATH = '/api/docker'

    async checkUpdates(forceRefresh = false): Promise<DockerUpdateResponse> {
        return this.get<DockerUpdateResponse>(`${this.BASE_PATH}/updates${forceRefresh ? '?force=true' : ''}`)
    }

    async updateImage(repository: string): Promise<DockerUpdateResponse> {
        return this.post<DockerUpdateResponse>(`${this.BASE_PATH}/update/${encodeURIComponent(repository)}`)
    }
}

export const dockerAPI = new DockerAPI() 