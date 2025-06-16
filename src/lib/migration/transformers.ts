/**
 * Data Transformers
 *
 * Transform TOML data structures to database format
 */

import { randomUUID } from 'crypto';
import type {
  NewUser,
  NewClientDevice,
  NewPlatform,
  NewGame,
  NewUserLibrary,
  NewUserGame,
  NewTask,
  NewSystemConfig,
  NewMetadataProvider,
  TaskStatus,
} from '../db/schema';
import type {
  TomlUser,
  TomlClientDevice,
  TomlGameMaster,
  TomlUserLibrary,
  TomlTask,
  TomlSystemConfig,
  TomlMetadataProvider,
  SteamLibraryToml,
  DefaultConfigToml
} from './types';

/**
 * Transform TOML users to database format
 */
export function transformUsers(tomlUsers: Record<string, TomlUser>): NewUser[] {
  const users: NewUser[] = [];
  
  for (const [username, userData] of Object.entries(tomlUsers)) {
    const user: NewUser = {
      username: userData.username,
      passwordHash: userData.password_hash,
      isAdmin: userData.is_admin,
      hasChangedPassword: userData.has_changed_password,
      steamId: userData.steam_id || null,
      steamApiKey: userData.steam_api_key || null,
    };
    
    users.push(user);
  }
  
  return users;
}

/**
 * Transform TOML client devices to database format
 */
export function transformClientDevices(
  tomlUsers: Record<string, TomlUser>,
  userMap: Map<string, string>
): NewClientDevice[] {
  const clientDevices: NewClientDevice[] = [];
  
  for (const [username, userData] of Object.entries(tomlUsers)) {
    const userId = userMap.get(username);
    if (!userId || !userData.clients) {
      console.log(`Skipping user ${username}: userId=${userId}, hasClients=${!!userData.clients}`);
      continue;
    }
    
    console.log(`Processing clients for user ${username}, found ${userData.clients.length} clients`);
    
    for (const clientData of userData.clients) {
      console.log(`Processing client:`, {
        id: clientData.id,
        friendly_name: clientData.friendly_name,
        pair_secret: clientData.pair_secret ? '***' : 'empty'
      });
      
      const clientDevice: NewClientDevice = {
        userId,
        friendlyName: clientData.friendly_name,
        pairSecret: clientData.pair_secret || '', // Use the actual pair_secret from TOML
        wolfClientId: clientData.id || `legacy-${clientData.friendly_name}-${Date.now()}`, // Use TOML client ID or generate one
      };
      
      console.log(`Created client device object:`, {
        userId: clientDevice.userId,
        friendlyName: clientDevice.friendlyName,
        pairSecret: clientDevice.pairSecret ? '***' : 'empty'
      });
      
      clientDevices.push(clientDevice);
    }
  }
  
  return clientDevices;
}

/**
 * Transform TOML games and platform data to database format
 */
export function transformGames(steamLibrary: SteamLibraryToml): {
  platforms: NewPlatform[],
  games: NewGame[]
} {
  const platforms: NewPlatform[] = [];
  const games: NewGame[] = [];
  
  // Create Steam platform
  const steamPlatformId = steamLibrary.metadata.platform || 'steam';
  const steamPlatform: NewPlatform = {
    id: steamPlatformId,
    name: 'Steam',
    version: steamLibrary.metadata.version || '1.0.0',
  };
  platforms.push(steamPlatform);
  
  // Transform games
  for (const [platformGameId, gameData] of Object.entries(steamLibrary.games)) {
    const game: NewGame = {
      platformId: steamPlatformId,
      platformGameId,
      name: gameData.name,
      iconUrl: gameData.icon_url || '',
    };
    
    games.push(game);
  }
  
  return { platforms, games };
}

/**
 * Transform TOML user libraries to database format
 */
export function transformUserLibraries(
  steamLibrary: SteamLibraryToml,
  userMap: Map<string, string>,
  platformMap: Map<string, string>
): NewUserLibrary[] {
  const userLibraries: NewUserLibrary[] = [];
  
  if (!steamLibrary.user_libraries) return userLibraries;
  
  const steamPlatformId = platformMap.get('steam');
  if (!steamPlatformId) return userLibraries;
  
  for (const [username, libraryData] of Object.entries(steamLibrary.user_libraries)) {
    const userId = userMap.get(username);
    if (!userId) continue;
    
    const userLibrary: NewUserLibrary = {
      userId,
      platformId: steamPlatformId,
      steamId: null, // Would need to be extracted from user data if available
    };
    
    userLibraries.push(userLibrary);
  }
  
  return userLibraries;
}

/**
 * Transform TOML user games to database format
 */
export function transformUserGames(
  steamLibrary: SteamLibraryToml,
  libraryMap: Map<string, string>,
  gameMap: Map<string, string>
): NewUserGame[] {
  const userGames: NewUserGame[] = [];
  
  if (!steamLibrary.user_libraries) return userGames;
  
  for (const [username, libraryData] of Object.entries(steamLibrary.user_libraries)) {
    const userLibraryId = libraryMap.get(username);
    if (!userLibraryId || !libraryData.games) continue;
    
    for (const gameData of libraryData.games) {
      const gameId = gameMap.get(gameData.platform_id);
      if (!gameId) continue;
      
      const userGame: NewUserGame = {
        userLibraryId,
        gameId,
        playtimeTotal: gameData.playtime_total || 0,
        playtimeLinux: gameData.playtime_linux || 0,
        lastPlayed: gameData.last_played || null,
      };
      
      userGames.push(userGame);
    }
  }
  
  return userGames;
}

/**
 * Convert string status to TaskStatus enum
 */
function validateTaskStatus(status: string): TaskStatus {
  const validStatuses: TaskStatus[] = ['IDLE', 'RUNNING', 'STOPPED', 'ERROR'];
  const upperStatus = status.toUpperCase() as TaskStatus;
  
  if (validStatuses.includes(upperStatus)) {
    return upperStatus;
  }
  
  // Default to IDLE if status is invalid
  return 'IDLE';
}

/**
 * Transform TOML tasks to database format
 */
export function transformTasks(tomlTasks: TomlTask[]): NewTask[] {
  const tasks: NewTask[] = [];
  
  for (const taskData of tomlTasks) {
    const task: NewTask = {
      name: taskData.name,
      description: taskData.description,
      schedule: taskData.schedule,
      isEnabled: taskData.is_enabled,
      status: validateTaskStatus(taskData.status),
    };
    
    tasks.push(task);
  }
  
  return tasks;
}

/**
 * Transform TOML system config to database format
 */
export function transformSystemConfig(defaultConfig: DefaultConfigToml): NewSystemConfig[] {
  const systemConfigs: NewSystemConfig[] = [];
  
  if (defaultConfig.system) {
    // Transform system name
    systemConfigs.push({
      key: 'system.name',
      value: defaultConfig.system.name,
    });
    
    // Transform system version
    systemConfigs.push({
      key: 'system.version',
      value: defaultConfig.system.version,
    });
  }
  
  return systemConfigs;
}

/**
 * Transform TOML metadata providers to database format
 */
export function transformMetadataProviders(defaultConfig: DefaultConfigToml): NewMetadataProvider[] {
  const metadataProviders: NewMetadataProvider[] = [];
  
  if (!defaultConfig.metadataProviders) return metadataProviders;
  
  for (const [providerName, providerData] of Object.entries(defaultConfig.metadataProviders)) {
    const metadataProvider: NewMetadataProvider = {
      name: providerName,
      enabled: providerData.enabled,
      config: JSON.stringify({
        apiKey: providerData.apiKey
      }),
    };
    
    metadataProviders.push(metadataProvider);
  }
  
  return metadataProviders;
}

/**
 * Create lookup maps for efficient data relationships
 */
export function createLookupMaps(data: {
  users?: NewUser[];
  platforms?: NewPlatform[];
  games?: NewGame[];
  userLibraries?: NewUserLibrary[];
}) {
  const maps = {
    usersByUsername: new Map<string, string>(),
    platformsByIdentifier: new Map<string, string>(),
    gamesByPlatformId: new Map<string, string>(),
    librariesByUsername: new Map<string, string>(),
  };
  
  // Note: Username mapping would need to be done during user creation
  // since TOML uses username as key but we need to map to database IDs
  
  if (data.platforms) {
    for (const platform of data.platforms) {
      maps.platformsByIdentifier.set(platform.id, platform.id);
    }
  }
  
  if (data.games) {
    for (const game of data.games) {
      // We'll need to generate IDs when inserting, so this map will be created after insertion
      maps.gamesByPlatformId.set(game.platformGameId, randomUUID());
    }
  }
  
  return maps;
}