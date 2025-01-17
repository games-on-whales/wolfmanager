import { SteamGame } from './types';
import ConfigService from '../config';
import Logger from '../logs';
import { handleApiResponse, handleApiError } from '../base';

export async function getOwnedGames(username?: string): Promise<SteamGame[]> {
  Logger.debug('Starting owned games fetch process', 'SteamService', { username });
  
  try {
    Logger.debug('Making Steam API request', 'SteamService', { username });
    const response = await fetch(
      `/api/steam/games${username ? `?username=${encodeURIComponent(username)}` : ''}`
    );

    if (!response.ok) {
      Logger.error('Steam API request failed', {
        status: response.status,
        statusText: response.statusText
      }, 'SteamService');
      throw new Error(`Steam API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.response?.games) {
      Logger.error('Invalid response from Steam API', null, 'SteamService');
      throw new Error('Invalid response from Steam API');
    }

    Logger.info('Successfully fetched owned games', 'SteamService', { 
      username,
      gameCount: data.response.games.length 
    });
    return data.response.games;
  } catch (error) {
    Logger.error('Failed to fetch owned games', error, 'SteamService');
    throw error;
  }
} 