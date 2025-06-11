import { eq } from 'drizzle-orm';
import { getDatabase } from '../index';
import { databaseConfig } from '../config';
import { logger } from '../../logger';
import { LogComponent } from '../../logger/types';
import bcrypt from 'bcryptjs';
import {
  usersSqlite,
  usersPostgres,
  usersMysql,
  type User,
  type NewUser,
  type UserUpdate,
} from '../schema/users';

/**
 * Get the appropriate users table based on database type
 */
function getUsersTable() {
  switch (databaseConfig.type) {
    case 'sqlite':
      return usersSqlite;
    case 'postgresql':
      return usersPostgres;
    case 'mysql':
      return usersMysql;
    default:
      throw new Error(`Unsupported database type: ${databaseConfig.type}`);
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const db = await getDatabase();
    const usersTable = getUsersTable();
    
    const [user] = await (db as any)
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    
    return user || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user by ID', error as Error, { userId: id });
    throw new Error('Failed to retrieve user');
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const db = await getDatabase();
    const usersTable = getUsersTable();
    
    const [user] = await (db as any)
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    
    return user || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user by username', error as Error, { username });
    throw new Error('Failed to retrieve user');
  }
}

/**
 * Get user by Steam ID
 */
export async function getUserBySteamId(steamId: string): Promise<User | null> {
  try {
    const db = await getDatabase();
    const usersTable = getUsersTable();
    
    const [user] = await (db as any)
      .select()
      .from(usersTable)
      .where(eq(usersTable.steamId, steamId))
      .limit(1);
    
    return user || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get user by Steam ID', error as Error, { steamId });
    throw new Error('Failed to retrieve user');
  }
}

/**
 * Add a new user
 */
export async function addUser(userData: NewUser): Promise<User> {
  try {
    const db = await getDatabase();
    const usersTable = getUsersTable();
    
    // Validate required fields
    if (!userData.username || !userData.passwordHash) {
      throw new Error('Username and password hash are required');
    }
    
    // Check if username already exists
    const existingUser = await getUserByUsername(userData.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }
    
    const newUser: User = {
      id: crypto.randomUUID(),
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any).insert(usersTable).values(newUser);
    
    logger.info(LogComponent.SYSTEM, 'User created successfully', { 
      userId: newUser.id, 
      username: newUser.username 
    });
    
    return newUser;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add user', error as Error, { username: userData.username });
    throw error;
  }
}

/**
 * Update user
 */
export async function updateUser(id: string, updates: UserUpdate): Promise<User> {
  try {
    const db = await getDatabase();
    const usersTable = getUsersTable();
    
    // Check if user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }
    
    // If updating username, check if it's already taken
    if (updates.username && updates.username !== existingUser.username) {
      const userWithUsername = await getUserByUsername(updates.username);
      if (userWithUsername) {
        throw new Error('Username already exists');
      }
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(usersTable)
      .set(updatedData)
      .where(eq(usersTable.id, id));
    
    const updatedUser = await getUserById(id);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }
    
    logger.info(LogComponent.SYSTEM, 'User updated successfully', { userId: id });
    
    return updatedUser;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update user', error as Error, { userId: id });
    throw error;
  }
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<void> {
  logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser database helper called', {
    userId: id,
    timestamp: new Date().toISOString()
  });

  try {
    const db = await getDatabase();
    logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser got database connection', {
      userId: id,
      hasDb: !!db,
      timestamp: new Date().toISOString()
    });

    const usersTable = getUsersTable();
    logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser got users table', {
      userId: id,
      tableName: 'users',
      timestamp: new Date().toISOString()
    });
    
    // Check if user exists
    const existingUser = await getUserById(id);
    logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser existence check', {
      userId: id,
      userExists: !!existingUser,
      userDetails: existingUser ? {
        id: existingUser.id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!existingUser) {
      logger.error(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser - user not found in database', undefined, {
        userId: id,
        timestamp: new Date().toISOString()
      });
      throw new Error('User not found');
    }
    
    logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser executing delete query', {
      userId: id,
      timestamp: new Date().toISOString()
    });

    const result = await (db as any).delete(usersTable).where(eq(usersTable.id, id));
    
    logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: deleteUser delete query completed', {
      userId: id,
      result: result,
      timestamp: new Date().toISOString()
    });
    
    logger.info(LogComponent.SYSTEM, 'DIAGNOSIS: User deleted successfully', {
      userId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'DIAGNOSIS: Failed to delete user in database helper', error as Error, {
      userId: id,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const db = await getDatabase();
    const usersTable = getUsersTable();
    
    const users = await (db as any).select().from(usersTable);
    
    return users;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get all users', error as Error);
    throw new Error('Failed to retrieve users');
  }
}

/**
 * Verify user password
 */
export async function verifyUserPassword(username: string, password: string): Promise<User | null> {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return null;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }
    
    return user;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to verify user password', error as Error, { username });
    throw new Error('Failed to verify password');
  }
}