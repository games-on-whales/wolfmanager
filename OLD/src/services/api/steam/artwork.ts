import { SteamGridResponse, SteamGridImage } from './types';
import ConfigService from '../config';
import CacheService from '../cache';
import Logger from '../logs';
import { getOwnedGames } from './games';

export const getGameArtwork = async (appId: number): Promise<string | null> => {
  try {
    // First try to get from cache
    const cachedArtwork = await getCachedArtwork(appId);
    if (cachedArtwork) {
      Logger.debug('Using cached artwork', 'SteamService', { appId });
      return cachedArtwork;
    }

    // If not in cache, fetch from SteamGridDB
    const options = await getArtworkOptions(appId);
    if (!options || options.length === 0) {
      Logger.debug('No artwork options available', 'SteamService', { appId });
      return null;
    }

    // Find suitable artwork
    const artwork = findSuitableArtwork(options);
    if (!artwork) {
      Logger.debug('No suitable artwork found', 'SteamService', { appId });
      return null;
    }

    // Try to cache the artwork
    try {
      await cacheArtwork(appId, artwork.url);
      const newCachedArtwork = await getCachedArtwork(appId);
      if (newCachedArtwork) {
        Logger.debug('Successfully cached and retrieved artwork', 'SteamService', { appId });
        return newCachedArtwork;
      }
    } catch (cacheError) {
      Logger.warn('Failed to cache artwork, using direct URL', 'SteamService');
      return artwork.url;
    }

    // If caching failed but we have a URL, use it directly
    Logger.debug('Using artwork URL directly', 'SteamService', { appId });
    return artwork.url;
  } catch (error) {
    Logger.error('Failed to get game artwork', 'SteamService');
    return null;
  }
};

const getCachedArtwork = async (appId: number): Promise<string | null> => {
  try {
    const response = await fetch(`/api/cache/artwork/${appId}`);
    if (!response.ok) {
      if (response.status !== 404) {
        Logger.warn('Failed to get cached artwork', 'SteamService');
      }
      return null;
    }
    const data = await response.json();
    return data.url || null;
  } catch (error) {
    Logger.warn('Error getting cached artwork', 'SteamService');
    return null;
  }
};

export async function refreshAllArtwork(): Promise<void> {
  Logger.info('Starting artwork refresh for all games');
  await ConfigService.loadConfig();
  const config = ConfigService.getConfig();
  
  // Get all unique game IDs across all users
  const allGames = new Set<number>();
  for (const username of Object.keys(config.users)) {
    try {
      const games = await getOwnedGames(username);
      games.forEach(game => allGames.add(game.appid));
    } catch (error) {
      Logger.error(`Failed to get games for user ${username}`, error);
    }
  }

  Logger.info(`Found ${allGames.size} unique games across all users`);

  // Check cache and download missing artwork
  let processed = 0;
  for (const appId of allGames) {
    try {
      // Check if already cached
      const cached = await CacheService.getCachedArtwork(appId);
      if (!cached) {
        Logger.debug(`Fetching artwork for game ${appId}`);
        const artwork = await getGameArtwork(appId);
        if (artwork) {
          processed++;
          if (processed % 10 === 0) {
            Logger.info(`Processed ${processed} games`);
          }
        }
      }
    } catch (error) {
      Logger.error(`Failed to process artwork for game ${appId}`, error);
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  Logger.info(`Artwork refresh complete. Processed ${processed} games`);
} 

const getArtworkOptions = async (appId: number): Promise<SteamGridImage[]> => {
  try {
    Logger.debug('Making SteamGridDB API request', 'SteamService', { appId });
    const response = await fetch(`/api/steamgrid/artwork/${appId}`);

    if (!response.ok) {
      Logger.error('SteamGridDB API request failed', 'SteamService');
      return [];
    }

    const data = await response.json() as SteamGridResponse;
    const availableGrids = data.data?.grids || [];
    
    Logger.debug('Received SteamGridDB response', 'SteamService', { 
      appId, 
      success: data.success,
      gridCount: availableGrids.length,
      availableStyles: [...new Set(availableGrids.map(g => g.style))],
      availableDimensions: [...new Set(availableGrids.map(g => `${g.width}x${g.height}`))]
    });

    return availableGrids;
  } catch (error) {
    Logger.error('Failed to fetch artwork options', 'SteamService');
    return [];
  }
};

const findSuitableArtwork = (options: SteamGridImage[]): SteamGridImage | null => {
  // Try to find the best grid in this order:
  // 1. 600x900 alternate style
  // 2. Any 600x900
  // 3. Any alternate style
  // 4. First available grid
  let artwork = options.find(item => 
    item.style === 'alternate' && 
    item.width === 600 && 
    item.height === 900
  );

  if (!artwork) {
    artwork = options.find(item => 
      item.width === 600 && 
      item.height === 900
    );
  }

  if (!artwork) {
    artwork = options.find(item => 
      item.style === 'alternate'
    );
  }

  if (!artwork && options.length > 0) {
    artwork = options[0];
  }

  return artwork || null;
};

const cacheArtwork = async (appId: number, imageUrl: string): Promise<void> => {
  const response = await fetch('/api/cache/artwork', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      appId: appId.toString(),
      imageUrl
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to cache artwork: ${response.statusText}`);
  }
}; 