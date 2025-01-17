import { handleApiResponse, handleApiError } from '../base';
import Logger from '../logs';

const FETCH_TIMEOUT = 5000; // 5 seconds

class CacheService {
  async ensureCacheDir(): Promise<void> {
    try {
      Logger.debug('Ensuring cache directory exists', 'CacheService');
      const response = await fetch('/api/cache/ensure', { method: 'POST' });
      await handleApiResponse<void>(response, 'CacheService');
    } catch (error) {
      await handleApiError(error, 'CacheService');
    }
  }

  async getCachedArtwork(appId: number): Promise<string | null> {
    try {
      Logger.debug('Checking for cached artwork', 'CacheService', { appId });
      const response = await fetch(`/api/cache/artwork/${appId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          Logger.debug('No cached artwork found', 'CacheService', { appId });
          return null;
        }
        throw new Error(`Failed to get cached artwork: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      Logger.debug('Found cached artwork', 'CacheService', { appId });
      return url;
    } catch (error) {
      Logger.error('Failed to get cached artwork', error, 'CacheService');
      return null;
    }
  }

  async cacheArtwork(appId: number, imageUrl: string): Promise<string | null> {
    try {
      Logger.debug('Caching artwork', 'CacheService', { appId, imageUrl });
      const response = await fetch('/api/cache/artwork', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appId, imageUrl })
      });

      if (!response.ok) {
        throw new Error(`Failed to cache artwork: ${response.statusText}`);
      }

      return await this.getCachedArtwork(appId);
    } catch (error) {
      Logger.error('Failed to cache artwork', error, 'CacheService');
      return null;
    }
  }
}

export default new CacheService(); 