import Logger from './LogService';

export const CacheService = {
  async ensureCacheDir() {
    try {
      const response = await fetch('/api/cache/ensure', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to ensure cache directory exists');
      }
    } catch (error) {
      Logger.error('Failed to ensure cache directory', error);
    }
  },

  async getCachedArtwork(appId: number): Promise<string | null> {
    try {
      const response = await fetch(`/api/cache/artwork/${appId}`);
      if (response.ok) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to get cached artwork for ${appId}`, error);
      return null;
    }
  },

  async cacheArtwork(appId: number, imageUrl: string): Promise<string | null> {
    try {
      const response = await fetch('/api/cache/artwork', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appId, imageUrl }),
      });

      if (response.ok) {
        return this.getCachedArtwork(appId);
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to cache artwork for ${appId}`, error);
      return null;
    }
  }
}; 