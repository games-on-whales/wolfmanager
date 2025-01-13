import { SteamGame } from '../types/config';
import { ConfigService } from './ConfigService';
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

  getGameArtwork: async (appId: number) => {
    Logger.debug('Fetching artwork for game', { appId });
    const config = ConfigService.getConfig();
    
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
        Logger.error('SteamGridDB API request failed', {
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`SteamGridDB API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      Logger.info('Successfully retrieved artwork data');
      Logger.debug('Artwork data', data);
      return data;
    } catch (error) {
      Logger.error('Failed to fetch game artwork', error);
      throw error;
    }
  }
}; 