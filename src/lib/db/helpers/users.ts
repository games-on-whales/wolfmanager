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
  const isAdminUpdate = updates.isAdmin !== undefined;
  const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Database updateUser called', {
      operationId,
      userId: id,
      isAdminUpdate,
      targetAdminState: updates.isAdmin,
      updateFields: Object.keys(updates),
      timestamp: new Date().toISOString()
    });

    const db = await getDatabase();
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Database connection obtained', {
      operationId,
      userId: id,
      hasDatabase: !!db,
      timestamp: new Date().toISOString()
    });

    const usersTable = getUsersTable();
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Users table reference obtained', {
      operationId,
      userId: id,
      tableType: typeof usersTable,
      timestamp: new Date().toISOString()
    });
    
    // Check if user exists with enhanced logging
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Checking if user exists', {
      operationId,
      userId: id,
      timestamp: new Date().toISOString()
    });

    const existingUser = await getUserById(id);
    
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: User existence check result', {
      operationId,
      userId: id,
      userExists: !!existingUser,
      currentState: existingUser ? {
        id: existingUser.id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin,
        updatedAt: existingUser.updatedAt
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!existingUser) {
      logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: User not found in database', undefined, {
        operationId,
        userId: id,
        timestamp: new Date().toISOString()
      });
      throw new Error('User not found');
    }
    
    // If updating username, check if it's already taken
    if (updates.username && updates.username !== existingUser.username) {
      logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Checking username availability', {
        operationId,
        userId: id,
        newUsername: updates.username,
        currentUsername: existingUser.username,
        timestamp: new Date().toISOString()
      });

      const userWithUsername = await getUserByUsername(updates.username);
      if (userWithUsername) {
        logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Username already exists', undefined, {
          operationId,
          userId: id,
          conflictingUsername: updates.username,
          conflictingUserId: userWithUsername.id,
          timestamp: new Date().toISOString()
        });
        throw new Error('Username already exists');
      }
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Prepared update data', {
      operationId,
      userId: id,
      updateFields: Object.keys(updatedData),
      isAdminUpdate,
      adminStateChange: isAdminUpdate ? {
        from: existingUser.isAdmin,
        to: updates.isAdmin
      } : null,
      sanitizedData: {
        ...updatedData,
        passwordHash: updatedData.passwordHash ? '[REDACTED]' : undefined
      },
      timestamp: new Date().toISOString()
    });
    
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Executing database update query', {
      operationId,
      userId: id,
      databaseType: databaseConfig.type,
      timestamp: new Date().toISOString()
    });

    let updateResult;
    try {
      // Log the exact SQL that would be generated (for debugging)
      const query = (db as any)
        .update(usersTable)
        .set(updatedData)
        .where(eq(usersTable.id, id));
      
      logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: SQL Query preparation', {
        operationId,
        userId: id,
        queryType: 'UPDATE',
        tableName: 'users',
        updateDataKeys: Object.keys(updatedData),
        isAdminFieldPresent: 'isAdmin' in updatedData,
        isAdminValue: updatedData.isAdmin,
        timestamp: new Date().toISOString()
      });

      updateResult = await query;
      
      logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Database update query executed', {
        operationId,
        userId: id,
        updateResult: updateResult,
        hasResult: !!updateResult,
        resultType: typeof updateResult,
        timestamp: new Date().toISOString()
      });
    } catch (updateError) {
      logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Database update query failed', updateError as Error, {
        operationId,
        userId: id,
        updateData: {
          ...updatedData,
          passwordHash: updatedData.passwordHash ? '[REDACTED]' : undefined
        },
        errorMessage: updateError instanceof Error ? updateError.message : String(updateError),
        errorStack: updateError instanceof Error ? updateError.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw updateError;
    }
    
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Retrieving updated user', {
      operationId,
      userId: id,
      timestamp: new Date().toISOString()
    });

    // Add a small delay to ensure database write is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const updatedUser = await getUserById(id);
    
    logger.debug(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Updated user retrieved', {
      operationId,
      userId: id,
      hasUpdatedUser: !!updatedUser,
      originalUserState: existingUser ? {
        id: existingUser.id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin,
        updatedAt: existingUser.updatedAt
      } : null,
      updatedUserState: updatedUser ? {
        id: updatedUser.id,
        username: updatedUser.username,
        isAdmin: updatedUser.isAdmin,
        updatedAt: updatedUser.updatedAt
      } : null,
      adminStateComparison: isAdminUpdate ? {
        originalAdminState: existingUser?.isAdmin,
        expectedAdminState: updates.isAdmin,
        actualAdminState: updatedUser?.isAdmin,
        updateSuccessful: updatedUser?.isAdmin === updates.isAdmin,
        timestampChanged: existingUser?.updatedAt !== updatedUser?.updatedAt
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!updatedUser) {
      logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Failed to retrieve updated user', undefined, {
        operationId,
        userId: id,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to retrieve updated user');
    }

    // Additional validation for admin updates
    if (isAdminUpdate && updatedUser.isAdmin !== updates.isAdmin) {
      // Try direct database query to check the actual value
      try {
        const directResult = await (db as any)
          .select({
            id: usersTable.id,
            username: usersTable.username,
            isAdmin: usersTable.isAdmin,
            updatedAt: usersTable.updatedAt
          })
          .from(usersTable)
          .where(eq(usersTable.id, id))
          .limit(1);

        const directUser = directResult[0];
        
        logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Admin state update verification failed - direct query', undefined, {
          operationId,
          userId: id,
          expectedAdminState: updates.isAdmin,
          getUserByIdResult: updatedUser.isAdmin,
          directQueryResult: directUser?.isAdmin,
          directQueryUser: directUser,
          possibleCachingIssue: directUser?.isAdmin === updates.isAdmin,
          timestamp: new Date().toISOString()
        });

        // If direct query shows the correct value, there might be a caching issue
        if (directUser?.isAdmin === updates.isAdmin) {
          logger.warn(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Possible caching issue detected - using direct query result', {
            operationId,
            userId: id,
            getUserByIdCached: updatedUser.isAdmin,
            directQueryCorrect: directUser.isAdmin,
            timestamp: new Date().toISOString()
          });
          // Return the direct query result instead
          return directUser as User;
        }
      } catch (directQueryError) {
        logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Direct query failed', directQueryError as Error, {
          operationId,
          userId: id,
          timestamp: new Date().toISOString()
        });
      }

      logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Admin state update verification failed', undefined, {
        operationId,
        userId: id,
        expectedAdminState: updates.isAdmin,
        actualAdminState: updatedUser.isAdmin,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Admin state update failed - expected ${updates.isAdmin}, got ${updatedUser.isAdmin}`);
    }
    
    logger.info(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: User updated successfully in database', {
      operationId,
      userId: id,
      isAdminUpdate,
      finalState: {
        username: updatedUser.username,
        isAdmin: updatedUser.isAdmin,
        updatedAt: updatedUser.updatedAt
      },
      timestamp: new Date().toISOString()
    });
    
    return updatedUser;
  } catch (error) {
    const errorDetails = {
      operationId,
      userId: id,
      isAdminUpdate,
      targetAdminState: updates.isAdmin,
      updateFields: Object.keys(updates),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString()
    };

    logger.error(LogComponent.SYSTEM, 'ADMIN_TOGGLE_DEBUG: Failed to update user in database', error as Error, errorDetails);
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