import Logger from './LogService';

const FETCH_TIMEOUT = 5000; // 5 seconds

const fetchWithTimeout = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const CacheService = {
  async ensureCacheDir() {
    try {
      const response = await fetchWithTimeout('/api/cache/ensure', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to ensure cache directory exists');
      }
    } catch (error) {
      Logger.error('Failed to ensure cache directory', error, 'CacheService');
    }
  },

  async getCachedArtwork(appId: number): Promise<string | null> {
    try {
      const response = await fetchWithTimeout(`/api/cache/artwork/${appId}`);
      if (response.ok) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        Logger.error(`Request timeout getting cached artwork for ${appId}`, error, 'CacheService');
      } else {
        Logger.error(`Failed to get cached artwork for ${appId}`, error, 'CacheService');
      }
      return null;
    }
  },

  async cacheArtwork(appId: number, imageUrl: string): Promise<string | null> {
    try {
      const response = await fetchWithTimeout('/api/cache/artwork', {
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
      if (error instanceof Error && error.name === 'AbortError') {
        Logger.error(`Request timeout caching artwork for ${appId}`, error, 'CacheService');
      } else {
        Logger.error(`Failed to cache artwork for ${appId}`, error, 'CacheService');
      }
      return null;
    }
  }
}; 