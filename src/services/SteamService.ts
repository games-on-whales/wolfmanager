import { SteamGame } from '../types/config';
import { ConfigService } from './ConfigService';
import { CacheService } from './CacheService';
import Logger from './LogService';

export const SteamService = {
  getOwnedGames: async (steamId: string): Promise<SteamGame[]> => {
    Logger.debug('Fetching owned games for Steam ID', { steamId });
    const config = ConfigService.getConfig();
    
    try {
      const response = await fetch(
        `/api/steam/games?steamApiKey=${config.steamApiKey}&steamId=${steamId}`
      );
      
      if (!response.ok) {
        Logger.error('Steam API request failed', {
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Steam API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      Logger.info(`Successfully retrieved ${data.response?.games?.length || 0} games`);
      Logger.debug('Games data', data.response);
      return data.response.games || [];
    } catch (error) {
      Logger.error('Failed to fetch owned games', error);
      throw error;
    }
  },

  getGameArtwork: async (appId: number): Promise<string | null> => {
    Logger.debug('Fetching artwork for game', { appId });
    const config = ConfigService.getConfig();
    
    if (!config.steamGridDbApiKey) {
      Logger.warn('SteamGridDB API key not configured');
      return null;
    }

    // Check cache first
    const cachedArtwork = await CacheService.getCachedArtwork(appId);
    if (cachedArtwork) {
      Logger.debug('Using cached artwork', { appId });
      return cachedArtwork;
    }

    try {
      const response = await fetch(
        `/api/steamgrid/artwork/${appId}`,
        {
          headers: {
            'X-SteamGridDB-Key': config.steamGridDbApiKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`SteamGridDB API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Find the first 600x900 grid in the alternate style
      const grid = data.data?.find((item: any) => 
        item.style === 'alternate' && 
        item.width === 600 && 
        item.height === 900
      );

      if (grid?.url) {
        Logger.info('Found suitable artwork', { appId });
        return CacheService.cacheArtwork(appId, grid.url);
      }

      Logger.warn('No suitable artwork found', { appId });
      return null;
    } catch (error) {
      Logger.error('Failed to fetch game artwork', error);
      return null;
    }
  }
}; 