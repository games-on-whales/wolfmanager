import { SteamGame } from './types';
import { ConfigService } from '../../config';
import Logger from '../../logs';

export async function getOwnedGames(username?: string): Promise<SteamGame[]> {
  Logger.debug('Starting owned games fetch process', 'SteamService', { username });
  await ConfigService.loadConfig();
  const config = ConfigService.getConfig();
  
  // If no username provided, use current user
  if (!username) {
    if (!config.currentUser) {
      Logger.error('No user selected', 'SteamService');
      throw new Error('Please select a user in the configuration');
    }
    username = config.currentUser;
  }

  // Get user's Steam credentials
  const user = config.users[username];
  if (!user) {
    Logger.error('User not found', 'SteamService', { username });
    throw new Error(`User ${username} not found`);
  }

  if (!user.steamId || !user.steamApiKey) {
    Logger.error('Missing Steam credentials', 'SteamService', { username });
    throw new Error('Steam ID and API key are required');
  }

  try {
    Logger.debug('Making Steam API request', 'SteamService', { username });
    const response = await fetch(
      `/api/steam/games?username=${encodeURIComponent(username)}`
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
      Logger.error('Invalid response from Steam API', 'SteamService', { data });
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