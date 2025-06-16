import {
  getPlatformById,
  addPlatform,
  getGameByPlatformGameId,
  addGame,
  getUserLibraryByUserAndPlatform,
  addUserLibrary,
  updateUserLibrary,
  getUserGamesByLibrary,
  addUserGame,
  updateUserGame,
  getUserByUsername,
} from "./db/helpers";
import { logger } from "./logger";
import { LogComponent } from "./logger/types";

export interface PlatformMetadata {
  platform: string;
  last_sync: string;
  version: string;
}

export interface GameMaster {
  name: string;
  icon_url: string;
  last_updated: string;
  platform_id: string;
}

export interface UserGameEntry {
  platform_id: string;
  playtime_total: number;
  playtime_linux: number;
  last_played: number;
}

export interface UserLibrary {
  steam_id: string; // Platform-specific ID
  games: UserGameEntry[];
}

export interface LibraryConfig {
  metadata: PlatformMetadata;
  games: Record<string, GameMaster>;
  user_libraries: Record<string, UserLibrary>;
}

/**
 * Gets the library configuration for a specific platform
 */
export async function getPlatformLibrary(platformName: string): Promise<LibraryConfig> {
  try {
    const platform = await getPlatformById(platformName);
    
    if (!platform) {
      // Create default platform if it doesn't exist
      const newPlatform = await addPlatform({
        id: platformName,
        name: platformName.charAt(0).toUpperCase() + platformName.slice(1),
        version: "1.0.0",
      });
      
      return {
        metadata: {
          platform: platformName,
          last_sync: new Date().toISOString(),
          version: "1.0.0",
        },
        games: {},
        user_libraries: {},
      };
    }

    // Get all games for this platform
    // Note: This is a simplified implementation - you might want to implement pagination
    // const games = await getGamesByPlatform(platform.id);
    
    // For now, return basic structure
    return {
      metadata: {
        platform: platformName,
        last_sync: new Date().toISOString(),
        version: platform.version,
      },
      games: {}, // This would be populated from database games
      user_libraries: {}, // This would be populated from user libraries
    };
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to get platform library",
      error instanceof Error ? error : new Error(String(error)),
      { platformName }
    );
    
    // Return default configuration on error
    return {
      metadata: {
        platform: platformName,
        last_sync: new Date().toISOString(),
        version: "1.0.0",
      },
      games: {},
      user_libraries: {},
    };
  }
}

/**
 * Saves the library configuration for a specific platform
 */
export async function savePlatformLibrary(
  platformName: string,
  config: LibraryConfig
): Promise<void> {
  try {
    // Note: This is now a no-op since individual operations should update the database directly
    logger.warn(
      LogComponent.SYSTEM,
      "savePlatformLibrary is deprecated. Use specific database operations for games and libraries.",
      { platformName }
    );
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to save platform library",
      error instanceof Error ? error : new Error(String(error)),
      { platformName }
    );
    throw error;
  }
}

/**
 * Updates a game in the master games list if it doesn't exist or is outdated
 */
export async function updateMasterGame(
  platformId: string,
  platformGameId: string,
  game: { name: string; icon_url: string }
): Promise<void> {
  try {
    // Check if game already exists
    const existingGame = await getGameByPlatformGameId(platformId, platformGameId);
    
    if (!existingGame) {
      // Add new game
      await addGame({
        platformId,
        platformGameId,
        name: game.name,
        iconUrl: game.icon_url,
      });
      
      logger.info(LogComponent.SYSTEM, "Added new game to master list", {
        platformId,
        platformGameId,
        name: game.name,
      });
    } else {
      // Game exists - could update if needed
      logger.debug(LogComponent.SYSTEM, "Game already exists in master list", {
        platformId,
        platformGameId,
        existingGameId: existingGame.id,
      });
    }
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update master game",
      error instanceof Error ? error : new Error(String(error)),
      { platformId, platformGameId, gameName: game.name }
    );
    throw error;
  }
}

/**
 * Add or update a user's game library entry
 */
export async function updateUserGameLibrary(
  username: string,
  platformId: string,
  gameEntry: UserGameEntry
): Promise<void> {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    // Get or create user library for this platform
    let userLibrary = await getUserLibraryByUserAndPlatform(user.id, platformId);
    
    if (!userLibrary) {
      userLibrary = await addUserLibrary({
        userId: user.id,
        platformId,
        steamId: gameEntry.platform_id, // Assuming this is the Steam ID or similar
      });
    }

    // Get the game from master list
    const game = await getGameByPlatformGameId(platformId, gameEntry.platform_id);
    if (!game) {
      logger.warn(LogComponent.SYSTEM, "Game not found in master list when updating user library", {
        platformId,
        platformGameId: gameEntry.platform_id,
      });
      return;
    }

    // Add or update user game
    const existingUserGame = await getUserGamesByLibrary(userLibrary.id);
    const userGame = existingUserGame.find(ug => ug.gameId === game.id);

    if (!userGame) {
      await addUserGame({
        userLibraryId: userLibrary.id,
        gameId: game.id,
        playtimeTotal: gameEntry.playtime_total,
        playtimeLinux: gameEntry.playtime_linux,
        lastPlayed: gameEntry.last_played || null,
      });
    } else {
      await updateUserGame(userGame.id, {
        playtimeTotal: gameEntry.playtime_total,
        playtimeLinux: gameEntry.playtime_linux,
        lastPlayed: gameEntry.last_played || null,
        updatedAt: new Date().toISOString(),
      });
    }

    logger.debug(LogComponent.SYSTEM, "Updated user game library entry", {
      username,
      platformId,
      gameId: game.id,
    });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update user game library",
      error instanceof Error ? error : new Error(String(error)),
      { username, platformId, platformGameId: gameEntry.platform_id }
    );
    throw error;
  }
}
