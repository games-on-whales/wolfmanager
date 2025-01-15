import { SteamGame } from '../types/config';
import { ConfigService } from './ConfigService';
import { CacheService } from './CacheService';
import Logger from './LogService';

interface SteamGridImage {
  id: string;
  score: number;
  style: string;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  url: string;
}

interface SteamGridResponse {
  success: boolean;
  data: {
    id: number;
    name: string;
    types: string[];
    verified: boolean;
    grids: SteamGridImage[];
  };
}

export const SteamService = {
  getOwnedGames: async (): Promise<SteamGame[]> => {
    Logger.debug('Fetching owned games');
    await ConfigService.loadConfig();
    const config = ConfigService.getConfig();
    const currentUser = ConfigService.getCurrentUser();
    
    if (!currentUser) {
      Logger.error('No user selected');
      throw new Error('No user selected');
    }

    try {
      const response = await fetch(
        `/api/steam/games?steamApiKey=${currentUser.steamApiKey}&steamId=${currentUser.steamId}`
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
    Logger.debug('Starting artwork fetch process', { appId });
    await ConfigService.loadConfig();
    const config = ConfigService.getConfig();
    
    if (!config.steamGridDbApiKey) {
      Logger.warn('SteamGridDB API key not configured, skipping artwork fetch');
      return null;
    }

    // Check cache first
    Logger.debug('Checking artwork cache', { appId });
    const cachedArtwork = await CacheService.getCachedArtwork(appId);
    if (cachedArtwork) {
      Logger.info('Using cached artwork', { appId });
      return cachedArtwork;
    }
    Logger.debug('No cached artwork found, fetching from API', { appId });

    try {
      Logger.debug('Making SteamGridDB API request', { appId });
      const response = await fetch(
        `/api/steamgrid/artwork/${appId}`,
        {
          headers: {
            'X-SteamGridDB-Key': config.steamGridDbApiKey
          }
        }
      );

      if (!response.ok) {
        Logger.error('SteamGridDB API request failed', {
          appId,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`SteamGridDB API request failed: ${response.statusText}`);
      }

      const data = await response.json() as SteamGridResponse;
      Logger.debug('Received SteamGridDB response', { 
        appId, 
        success: data.success,
        gridCount: data.data?.grids?.length || 0 
      });
      
      // Find the first 600x900 grid in the alternate style
      const grid = data.data?.grids?.find(item => 
        item.style === 'alternate' && 
        item.width === 600 && 
        item.height === 900
      );

      if (grid?.url) {
        Logger.info('Found suitable artwork', { 
          appId,
          style: grid.style,
          dimensions: `${grid.width}x${grid.height}`,
          url: grid.url
        });
        const cachedUrl = await CacheService.cacheArtwork(appId, grid.url);
        if (cachedUrl) {
          Logger.info('Successfully cached artwork', { appId });
          return cachedUrl;
        }
      } else {
        const availableGrids = data.data?.grids || [];
        Logger.warn('No suitable artwork found', { 
          appId,
          availableStyles: [...new Set(availableGrids.map(item => item.style))],
          availableDimensions: [...new Set(availableGrids.map(item => `${item.width}x${item.height}`))]
        });
      }

      return null;
    } catch (error) {
      Logger.error('Failed to fetch game artwork', { 
        appId, 
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error 
      });
      return null;
    }
  }
}; 