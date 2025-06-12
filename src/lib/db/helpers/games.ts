import { eq, and, like } from 'drizzle-orm';
import { getDatabase } from '../index';
import { databaseConfig } from '../config';
import { logger } from '../../logger';
import { LogComponent } from '../../logger/types';
import {
  platformsSqlite,
  platformsPostgres,
  platformsMysql,
  gamesSqlite,
  gamesPostgres,
  gamesMysql,
  userLibrariesSqlite,
  userLibrariesPostgres,
  userLibrariesMysql,
  userGamesSqlite,
  userGamesPostgres,
  userGamesMysql,
  type Platform,
  type Game,
  type UserLibrary,
  type UserGame,
  type NewPlatform,
  type NewGame,
  type NewUserLibrary,
  type NewUserGame,
  type PlatformUpdate,
  type GameUpdate,
  type UserLibraryUpdate,
  type UserGameUpdate,
} from '../schema/games';

/**
 * Get the appropriate tables based on database type
 */
function getTables() {
  switch (databaseConfig.type) {
    case 'sqlite':
      return {
        platforms: platformsSqlite,
        games: gamesSqlite,
        userLibraries: userLibrariesSqlite,
        userGames: userGamesSqlite,
      };
    case 'postgresql':
      return {
        platforms: platformsPostgres,
        games: gamesPostgres,
        userLibraries: userLibrariesPostgres,
        userGames: userGamesPostgres,
      };
    case 'mysql':
      return {
        platforms: platformsMysql,
        games: gamesMysql,
        userLibraries: userLibrariesMysql,
        userGames: userGamesMysql,
      };
    default:
      throw new Error(`Unsupported database type: ${databaseConfig.type}`);
  }
}

// PLATFORM OPERATIONS

/**
 * Get platform by ID
 */
export async function getPlatformById(id: string): Promise<Platform | null> {
  try {
    const db = await getDatabase();
    const { platforms } = getTables();
    
    const [platform] = await (db as any)
      .select()
      .from(platforms)
      .where(eq(platforms.id, id))
      .limit(1);
    
    return platform || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get platform by ID', error as Error, { platformId: id });
    throw new Error('Failed to retrieve platform');
  }
}

/**
 * Get all platforms
 */
export async function getAllPlatforms(): Promise<Platform[]> {
  try {
    const db = await getDatabase();
    const { platforms } = getTables();
    
    const allPlatforms = await (db as any).select().from(platforms);
    
    return allPlatforms;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get all platforms', error as Error);
    throw new Error('Failed to retrieve platforms');
  }
}

/**
 * Add a new platform
 */
export async function addPlatform(platformData: NewPlatform): Promise<Platform> {
  try {
    const db = await getDatabase();
    const { platforms } = getTables();
    
    // Validate required fields
    if (!platformData.id || !platformData.name) {
      throw new Error('Platform ID and name are required');
    }
    
    // Check if platform already exists
    const existingPlatform = await getPlatformById(platformData.id);
    if (existingPlatform) {
      throw new Error('Platform already exists');
    }
    
    const newPlatform: Platform = {
      ...platformData,
      lastSync: new Date().toISOString(),
    };
    
    await (db as any).insert(platforms).values(newPlatform);
    
    logger.info(LogComponent.SYSTEM, 'Platform created successfully', { 
      platformId: newPlatform.id, 
      name: newPlatform.name 
    });
    
    return newPlatform;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add platform', error as Error, { 
      platformId: platformData.id,
      name: platformData.name
    });
    throw error;
  }
}

/**
 * Update platform
 */
export async function updatePlatform(id: string, updates: PlatformUpdate): Promise<Platform> {
  try {
    const db = await getDatabase();
    const { platforms } = getTables();
    
    // Check if platform exists
    const existingPlatform = await getPlatformById(id);
    if (!existingPlatform) {
      throw new Error('Platform not found');
    }
    
    const updatedData = {
      ...updates,
      lastSync: new Date().toISOString(),
    };
    
    await (db as any)
      .update(platforms)
      .set(updatedData)
      .where(eq(platforms.id, id));
    
    const updatedPlatform = await getPlatformById(id);
    if (!updatedPlatform) {
      throw new Error('Failed to retrieve updated platform');
    }
    
    logger.info(LogComponent.SYSTEM, 'Platform updated successfully', { platformId: id });
    
    return updatedPlatform;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update platform', error as Error, { platformId: id });
    throw error;
  }
}

// GAME OPERATIONS

/**
 * Get game by ID
 */
export async function getGameById(id: string): Promise<Game | null> {
  try {
    const db = await getDatabase();
    const { games } = getTables();
    
    const [game] = await (db as any)
      .select()
      .from(games)
      .where(eq(games.id, id))
      .limit(1);
    
    return game || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get game by ID', error as Error, { gameId: id });
    throw new Error('Failed to retrieve game');
  }
}

/**
 * Get games by platform
 */
export async function getGamesByPlatform(platformId: string): Promise<Game[]> {
  try {
    const db = await getDatabase();
    const { games } = getTables();
    
    const platformGames = await (db as any)
      .select()
      .from(games)
      .where(eq(games.platformId, platformId));
    
    return platformGames;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get games by platform', error as Error, { platformId });
    throw new Error('Failed to retrieve games');
  }
}

/**
 * Get game by platform and platform game ID
 */
export async function getGameByPlatformGameId(platformId: string, platformGameId: string): Promise<Game | null> {
  try {
    const db = await getDatabase();
    const { games } = getTables();
    
    const [game] = await (db as any)
      .select()
      .from(games)
      .where(and(eq(games.platformId, platformId), eq(games.platformGameId, platformGameId)))
      .limit(1);
    
    return game || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get game by platform game ID', error as Error, { 
      platformId, 
      platformGameId 
    });
    throw new Error('Failed to retrieve game');
  }
}

/**
 * Add a new game
 */
export async function addGame(gameData: NewGame): Promise<Game> {
  try {
    const db = await getDatabase();
    const { games } = getTables();
    
    // Validate required fields
    if (!gameData.platformId || !gameData.platformGameId || !gameData.name) {
      throw new Error('Platform ID, platform game ID, and name are required');
    }
    
    // Check if game already exists
    const existingGame = await getGameByPlatformGameId(gameData.platformId, gameData.platformGameId);
    if (existingGame) {
      throw new Error('Game already exists for this platform');
    }
    
    const newGame: Game = {
      id: crypto.randomUUID(),
      ...gameData,
      lastUpdated: new Date().toISOString(),
    };
    
    await (db as any).insert(games).values(newGame);
    
    logger.info(LogComponent.SYSTEM, 'Game created successfully', { 
      gameId: newGame.id, 
      name: newGame.name,
      platformId: newGame.platformId
    });
    
    return newGame;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add game', error as Error, { 
      platformId: gameData.platformId,
      platformGameId: gameData.platformGameId,
      name: gameData.name
    });
    throw error;
  }
}

/**
 * Update game
 */
export async function updateGame(id: string, updates: GameUpdate): Promise<Game> {
  try {
    const db = await getDatabase();
    const { games } = getTables();
    
    // Check if game exists
    const existingGame = await getGameById(id);
    if (!existingGame) {
      throw new Error('Game not found');
    }
    
    const updatedData = {
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    
    await (db as any)
      .update(games)
      .set(updatedData)
      .where(eq(games.id, id));
    
    const updatedGame = await getGameById(id);
    if (!updatedGame) {
      throw new Error('Failed to retrieve updated game');
    }
    
    logger.info(LogComponent.SYSTEM, 'Game updated successfully', { gameId: id });
    
    return updatedGame;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update game', error as Error, { gameId: id });
    throw error;
  }
}

/**
 * Search games
 */
export async function searchGames(query: string): Promise<Game[]> {
  try {
    const db = await getDatabase();
    const { games } = getTables();
    
    const searchResults = await (db as any)
      .select()
      .from(games)
      .where(like(games.name, `%${query}%`));
    
    return searchResults;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to search games', error as Error, { query });
    throw new Error('Failed to search games');
  }
}

// USER LIBRARY OPERATIONS

/**
 * Get user library by ID
 */
export async function getUserLibraryById(id: string): Promise<UserLibrary | null> {
  try {
    const db = await getDatabase();
    const { userLibraries } = getTables();
    
    const [library] = await (db as any)
      .select()
      .from(userLibraries)
      .where(eq(userLibraries.id, id))
      .limit(1);
    
    return library || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user library by ID', error as Error, { libraryId: id });
    throw new Error('Failed to retrieve user library');
  }
}

/**
 * Get user libraries by user ID
 */
export async function getUserLibrariesByUserId(userId: string): Promise<UserLibrary[]> {
  try {
    const db = await getDatabase();
    const { userLibraries } = getTables();
    
    const libraries = await (db as any)
      .select()
      .from(userLibraries)
      .where(eq(userLibraries.userId, userId));
    
    return libraries;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user libraries by user ID', error as Error, { userId });
    throw new Error('Failed to retrieve user libraries');
  }
}

/**
 * Get user library by user and platform
 */
export async function getUserLibraryByUserAndPlatform(userId: string, platformId: string): Promise<UserLibrary | null> {
  try {
    const db = await getDatabase();
    const { userLibraries } = getTables();
    
    const [library] = await (db as any)
      .select()
      .from(userLibraries)
      .where(and(eq(userLibraries.userId, userId), eq(userLibraries.platformId, platformId)))
      .limit(1);
    
    return library || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user library by user and platform', error as Error, { 
      userId, 
      platformId 
    });
    throw new Error('Failed to retrieve user library');
  }
}

/**
 * Add a new user library
 */
export async function addUserLibrary(libraryData: NewUserLibrary): Promise<UserLibrary> {
  try {
    const db = await getDatabase();
    const { userLibraries } = getTables();
    
    // Validate required fields
    if (!libraryData.userId || !libraryData.platformId) {
      throw new Error('User ID and platform ID are required');
    }
    
    // Check if library already exists
    const existingLibrary = await getUserLibraryByUserAndPlatform(libraryData.userId, libraryData.platformId);
    if (existingLibrary) {
      throw new Error('User library already exists for this platform');
    }
    
    const newLibrary: UserLibrary = {
      id: crypto.randomUUID(),
      ...libraryData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any).insert(userLibraries).values(newLibrary);
    
    logger.info(LogComponent.SYSTEM, 'User library created successfully', { 
      libraryId: newLibrary.id, 
      userId: newLibrary.userId,
      platformId: newLibrary.platformId
    });
    
    return newLibrary;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add user library', error as Error, { 
      userId: libraryData.userId,
      platformId: libraryData.platformId
    });
    throw error;
  }
}

/**
 * Update user library
 */
export async function updateUserLibrary(id: string, updates: UserLibraryUpdate): Promise<UserLibrary> {
  try {
    const db = await getDatabase();
    const { userLibraries } = getTables();
    
    // Check if library exists
    const existingLibrary = await getUserLibraryById(id);
    if (!existingLibrary) {
      throw new Error('User library not found');
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(userLibraries)
      .set(updatedData)
      .where(eq(userLibraries.id, id));
    
    const updatedLibrary = await getUserLibraryById(id);
    if (!updatedLibrary) {
      throw new Error('Failed to retrieve updated user library');
    }
    
    logger.info(LogComponent.SYSTEM, 'User library updated successfully', { libraryId: id });
    
    return updatedLibrary;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update user library', error as Error, { libraryId: id });
    throw error;
  }
}

// USER GAME OPERATIONS

/**
 * Get user game by ID
 */
export async function getUserGameById(id: string): Promise<UserGame | null> {
  try {
    const db = await getDatabase();
    const { userGames } = getTables();
    
    const [userGame] = await (db as any)
      .select()
      .from(userGames)
      .where(eq(userGames.id, id))
      .limit(1);
    
    return userGame || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user game by ID', error as Error, { userGameId: id });
    throw new Error('Failed to retrieve user game');
  }
}

/**
 * Get user games by library
 */
export async function getUserGamesByLibrary(userLibraryId: string): Promise<UserGame[]> {
  try {
    const db = await getDatabase();
    const { userGames } = getTables();
    
    const games = await (db as any)
      .select()
      .from(userGames)
      .where(eq(userGames.userLibraryId, userLibraryId));
    
    return games;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user games by library', error as Error, { userLibraryId });
    throw new Error('Failed to retrieve user games');
  }
}

/**
 * Get user games by user ID
 */
export async function getUserGamesByUserId(userId: string): Promise<UserGame[]> {
  try {
    const db = await getDatabase();
    const { userGames, userLibraries } = getTables();
    
    const games = await (db as any)
      .select()
      .from(userGames)
      .innerJoin(userLibraries, eq(userGames.userLibraryId, userLibraries.id))
      .where(eq(userLibraries.userId, userId));
    
    return games.map((row: any) => row.user_games);
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user games by user ID', error as Error, { userId });
    throw new Error('Failed to retrieve user games');
  }
}

/**
 * Add a new user game
 */
export async function addUserGame(gameData: NewUserGame): Promise<UserGame> {
  try {
    const db = await getDatabase();
    const { userGames } = getTables();
    
    // Validate required fields
    if (!gameData.userLibraryId || !gameData.gameId) {
      throw new Error('User library ID and game ID are required');
    }
    
    const newUserGame: UserGame = {
      id: crypto.randomUUID(),
      ...gameData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any).insert(userGames).values(newUserGame);
    
    logger.info(LogComponent.SYSTEM, 'User game created successfully', { 
      userGameId: newUserGame.id, 
      userLibraryId: newUserGame.userLibraryId,
      gameId: newUserGame.gameId
    });
    
    return newUserGame;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add user game', error as Error, { 
      userLibraryId: gameData.userLibraryId,
      gameId: gameData.gameId
    });
    throw error;
  }
}

/**
 * Update user game
 */
export async function updateUserGame(id: string, updates: UserGameUpdate): Promise<UserGame> {
  try {
    const db = await getDatabase();
    const { userGames } = getTables();
    
    // Check if user game exists
    const existingUserGame = await getUserGameById(id);
    if (!existingUserGame) {
      throw new Error('User game not found');
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(userGames)
      .set(updatedData)
      .where(eq(userGames.id, id));
    
    const updatedUserGame = await getUserGameById(id);
    if (!updatedUserGame) {
      throw new Error('Failed to retrieve updated user game');
    }
    
    logger.info(LogComponent.SYSTEM, 'User game updated successfully', { userGameId: id });
    
    return updatedUserGame;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update user game', error as Error, { userGameId: id });
    throw error;
  }
}

/**
 * Get user game with details (joined with game and platform info)
 */
export async function getUserGameWithDetails(userId: string, gameId: string): Promise<any | null> {
  try {
    const db = await getDatabase();
    const { userGames, userLibraries, games, platforms } = getTables();
    
    const [result] = await (db as any)
      .select({
        userGame: userGames,
        game: games,
        platform: platforms,
        userLibrary: userLibraries
      })
      .from(userGames)
      .innerJoin(userLibraries, eq(userGames.userLibraryId, userLibraries.id))
      .innerJoin(games, eq(userGames.gameId, games.id))
      .innerJoin(platforms, eq(games.platformId, platforms.id))
      .where(and(eq(userLibraries.userId, userId), eq(userGames.gameId, gameId)))
      .limit(1);
    
    return result || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user game with details', error as Error, { 
      userId, 
      gameId 
    });
    throw new Error('Failed to retrieve user game details');
  }
}