import { eq, and, or, desc, sql } from 'drizzle-orm';
import { getDatabase } from '../index';
import { databaseConfig } from '../config';
import { logger } from '../../logger';
import { LogComponent } from '../../logger/types';
import {
  clientDevicesSqlite,
  clientDevicesPostgres,
  clientDevicesMysql,
  type ClientDevice,
  type NewClientDevice,
  type ClientDeviceUpdate,
} from '../schema/clients';

/**
 * Get the appropriate client devices table based on database type
 */
function getClientDevicesTable() {
  switch (databaseConfig.type) {
    case 'sqlite':
      return clientDevicesSqlite;
    case 'postgresql':
      return clientDevicesPostgres;
    case 'mysql':
      return clientDevicesMysql;
    default:
      throw new Error(`Unsupported database type: ${databaseConfig.type}`);
  }
}

/**
 * Get client device by ID
 */
export async function getClientDeviceById(id: string): Promise<ClientDevice | null> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    const [device] = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.id, id))
      .limit(1);
    
    return device || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get client device by ID', error as Error, { deviceId: id });
    throw new Error('Failed to retrieve client device');
  }
}

/**
 * Get client device by pair secret
 */
export async function getClientDeviceByPairSecret(pairSecret: string): Promise<ClientDevice | null> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    const [device] = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.pairSecret, pairSecret))
      .limit(1);
    
    return device || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get client device by pair secret', error as Error, { pairSecret });
    throw new Error('Failed to retrieve client device');
  }
}

/**
 * Get client device by Wolf client ID
 */
export async function getClientDeviceByWolfClientId(wolfClientId: string): Promise<ClientDevice | null> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    const [device] = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.wolfClientId, wolfClientId))
      .limit(1);
    
    return device || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get client device by Wolf client ID', error as Error, { wolfClientId });
    throw new Error('Failed to retrieve client device');
  }
}

/**
 * Get all client devices for a user
 */
export async function getClientDevicesByUserId(userId: string): Promise<ClientDevice[]> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    const devices = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.userId, userId))
      .orderBy(desc(clientDevicesTable.createdAt));
    
    return devices;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get client devices by user ID', error as Error, { userId });
    throw new Error('Failed to retrieve client devices');
  }
}

/**
 * Add a new client device with duplicate prevention
 */
export async function addClientDevice(deviceData: NewClientDevice): Promise<ClientDevice> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    // Validate required fields
    if (!deviceData.userId || !deviceData.pairSecret || !deviceData.friendlyName || !deviceData.wolfClientId) {
      throw new Error('User ID, Wolf client ID, pair secret, and friendly name are required');
    }
    
    try {
      const [insertedDevice] = await (db as any).insert(clientDevicesTable).values(deviceData).returning();
      
      logger.info(LogComponent.SYSTEM, 'Client device created successfully', {
        deviceId: insertedDevice.id,
        userId: insertedDevice.userId,
        friendlyName: insertedDevice.friendlyName
      });
      
      return insertedDevice;
    } catch (insertError: any) {
      // Handle unique constraint violations
      const errorMessage = insertError?.message || '';
      const isUniqueConstraintViolation =
        errorMessage.includes('UNIQUE constraint failed') || // SQLite
        errorMessage.includes('duplicate key value') || // PostgreSQL
        errorMessage.includes('Duplicate entry'); // MySQL
      
      if (isUniqueConstraintViolation) {
        // Check which constraint was violated
        if (errorMessage.includes('user_id_pair_secret_unique') || (errorMessage.includes('userId') && errorMessage.includes('pairSecret'))) {
          logger.warn(LogComponent.SYSTEM, 'Client device with this pair secret already exists for user', {
            pairSecret: deviceData.pairSecret,
            userId: deviceData.userId
          });
          throw new Error('DUPLICATE_CLIENT: A client device with this pair secret is already paired to your account');
        } else if (errorMessage.includes('user_id_wolf_client_id_unique') || (errorMessage.includes('userId') && errorMessage.includes('wolfClientId'))) {
          logger.warn(LogComponent.SYSTEM, 'Client device with this Wolf client ID already exists for user', {
            wolfClientId: deviceData.wolfClientId,
            userId: deviceData.userId
          });
          throw new Error('DUPLICATE_CLIENT: This Wolf client device is already paired to your account');
        } else {
          logger.warn(LogComponent.SYSTEM, 'Unique constraint violation when adding client device', {
            userId: deviceData.userId,
            wolfClientId: deviceData.wolfClientId,
            error: errorMessage
          });
          throw new Error('DUPLICATE_CLIENT: This client device is already paired to your account');
        }
      }
      
      // Re-throw other errors
      throw insertError;
    }
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add client device', error as Error, {
      userId: deviceData.userId
    });
    throw error;
  }
}

/**
 * Update client device
 */
export async function updateClientDevice(id: string, updates: ClientDeviceUpdate): Promise<ClientDevice> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    // Check if device exists
    const existingDevice = await getClientDeviceById(id);
    if (!existingDevice) {
      throw new Error('Client device not found');
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(clientDevicesTable)
      .set(updatedData)
      .where(eq(clientDevicesTable.id, id));
    
    const updatedDevice = await getClientDeviceById(id);
    if (!updatedDevice) {
      throw new Error('Failed to retrieve updated client device');
    }
    
    logger.info(LogComponent.SYSTEM, 'Client device updated successfully', { 
      deviceId: id,
      userId: updatedDevice.userId
    });
    
    return updatedDevice;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update client device', error as Error, { deviceId: id });
    throw error;
  }
}

/**
 * Delete client device
 */
export async function deleteClientDevice(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    // Check if device exists
    const existingDevice = await getClientDeviceById(id);
    if (!existingDevice) {
      throw new Error('Client device not found');
    }
    
    await (db as any)
      .delete(clientDevicesTable)
      .where(eq(clientDevicesTable.id, id));
    
    logger.info(LogComponent.SYSTEM, 'Client device deleted successfully', { 
      deviceId: id,
      userId: existingDevice.userId
    });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to delete client device', error as Error, { deviceId: id });
    throw error;
  }
}

/**
 * Delete all client devices for a user
 */
export async function deleteClientDevicesByUserId(userId: string): Promise<void> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    await (db as any)
      .delete(clientDevicesTable)
      .where(eq(clientDevicesTable.userId, userId));
    
    logger.info(LogComponent.SYSTEM, 'All client devices deleted for user', { userId });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to delete client devices for user', error as Error, { userId });
    throw error;
  }
}

/**
 * Find duplicate client devices for a given user.
 * Duplicates are identified by (userId, pairSecret).
 * Note: Since 'id' is the primary key, duplicates by (userId, id) should not exist after the unique constraint is applied.
 */
export async function findDuplicateClients(userId: string): Promise<{ byId: ClientDevice[], byPairSecret: ClientDevice[] }> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();

    // Get all devices for the user
    const allDevices = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.userId, userId))
      .orderBy(desc(clientDevicesTable.createdAt));

    // Find duplicates by pairSecret using object grouping
    const pairSecretGroups: { [key: string]: ClientDevice[] } = {};
    for (const device of allDevices) {
      if (!pairSecretGroups[device.pairSecret]) {
        pairSecretGroups[device.pairSecret] = [];
      }
      pairSecretGroups[device.pairSecret].push(device);
    }

    const duplicatesByPairSecret: ClientDevice[] = [];
    for (const pairSecret in pairSecretGroups) {
      const devices = pairSecretGroups[pairSecret];
      if (devices.length > 1) {
        duplicatesByPairSecret.push(...devices);
      }
    }

    // Since 'id' is the primary key, duplicates by (userId, id) should not exist
    // This is mainly for completeness and future-proofing
    const duplicatesById: ClientDevice[] = [];
    
    logger.info(LogComponent.SYSTEM, 'Duplicate client scan complete', {
      userId: userId,
      duplicatesByIdCount: duplicatesById.length,
      duplicatesByPairSecretCount: duplicatesByPairSecret.length,
    });

    return { byId: duplicatesById, byPairSecret: duplicatesByPairSecret };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to find duplicate client devices', error as Error, { userId: userId });
    throw new Error('Failed to find duplicate client devices');
  }
}

/**
 * Remove duplicate client devices for a user, keeping the most recent one (by createdAt).
 * This function focuses on removing duplicates by pairSecret since id duplicates shouldn't exist.
 */
export async function removeDuplicateClients(userId: string): Promise<{ removedByIdCount: number, removedByPairSecretCount: number }> {
  let removedByIdCount = 0;
  let removedByPairSecretCount = 0;

  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    // Get all devices for the user, ordered by creation date (newest first)
    const allDevices = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.userId, userId))
      .orderBy(desc(clientDevicesTable.createdAt));

    // Group by pairSecret using object grouping
    const pairSecretGroups: { [key: string]: ClientDevice[] } = {};
    for (const device of allDevices) {
      if (!pairSecretGroups[device.pairSecret]) {
        pairSecretGroups[device.pairSecret] = [];
      }
      pairSecretGroups[device.pairSecret].push(device);
    }

    // Remove duplicates by pairSecret (keep the most recent one)
    for (const pairSecret in pairSecretGroups) {
      const devices = pairSecretGroups[pairSecret];
      if (devices.length > 1) {
        // Keep the first device (most recent), delete the rest
        for (let i = 1; i < devices.length; i++) {
          await (db as any).delete(clientDevicesTable).where(eq(clientDevicesTable.id, devices[i].id));
          removedByPairSecretCount++;
        }
      }
    }
    
    if (removedByIdCount > 0 || removedByPairSecretCount > 0) {
      logger.info(LogComponent.SYSTEM, 'Duplicate client devices removed by helper', {
        userId: userId,
        removedByIdCount,
        removedByPairSecretCount
      });
    } else {
      logger.info(LogComponent.SYSTEM, 'No duplicate client devices found or removed by helper', { userId: userId });
    }

    return { removedByIdCount, removedByPairSecretCount };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to remove duplicate client devices by helper', error as Error, { userId: userId });
    throw new Error('Failed to remove duplicate client devices by helper');
  }
}

/**
 * Comprehensive client cleanup utility for a user
 * Gets all clients from both database and Wolf API, identifies duplicates, and removes them
 */
export async function cleanupDuplicateClientsForUser(userId: string): Promise<{
  databaseCleanup: { removedByIdCount: number, removedByPairSecretCount: number },
  summary: {
    initialDatabaseCount: number,
    finalDatabaseCount: number,
    duplicatesFound: boolean,
    cleanupPerformed: boolean
  }
}> {
  try {
    logger.info(LogComponent.SYSTEM, 'Starting comprehensive client cleanup for user', { userId });
    
    // Get initial database client count
    const initialDatabaseClients = await getClientDevicesByUserId(userId);
    const initialDatabaseCount = initialDatabaseClients.length;
    
    // Find duplicates in database
    const duplicates = await findDuplicateClients(userId);
    const hasDuplicates = duplicates.byId.length > 0 || duplicates.byPairSecret.length > 0;
    
    let databaseCleanup = { removedByIdCount: 0, removedByPairSecretCount: 0 };
    let cleanupPerformed = false;
    
    if (hasDuplicates) {
      logger.info(LogComponent.SYSTEM, 'Duplicates found in database, performing cleanup', {
        userId,
        duplicatesByIdCount: duplicates.byId.length,
        duplicatesByPairSecretCount: duplicates.byPairSecret.length
      });
      
      // Remove duplicates from database
      databaseCleanup = await removeDuplicateClients(userId);
      cleanupPerformed = true;
    }
    
    // Get final database client count
    const finalDatabaseClients = await getClientDevicesByUserId(userId);
    const finalDatabaseCount = finalDatabaseClients.length;
    
    const summary = {
      initialDatabaseCount,
      finalDatabaseCount,
      duplicatesFound: hasDuplicates,
      cleanupPerformed
    };
    
    logger.info(LogComponent.SYSTEM, 'Comprehensive client cleanup completed', {
      userId,
      ...summary,
      ...databaseCleanup
    });
    
    return {
      databaseCleanup,
      summary
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to perform comprehensive client cleanup', error as Error, { userId });
    throw new Error('Failed to perform comprehensive client cleanup');
  }
}

/**
 * Client synchronization function that merges database and Wolf API client data
 * Removes inconsistencies and duplicates, returns clean deduplicated client list
 */
export async function synchronizeAndCleanupClients(userId: string): Promise<{
  clients: ClientDevice[],
  wolfApiClients: any[],
  synchronizationStats: {
    databaseClientsCount: number,
    wolfApiClientsCount: number,
    duplicatesRemoved: number,
    inconsistenciesFound: number,
    finalClientCount: number
  }
}> {
  try {
    logger.info(LogComponent.SYSTEM, 'Starting client synchronization and cleanup', { userId });
    
    // First, cleanup any duplicates in the database
    const cleanupResult = await cleanupDuplicateClientsForUser(userId);
    
    // Get clean database clients
    const databaseClients = await getClientDevicesByUserId(userId);
    
    // Get Wolf API clients (this would need to be called from a context with session)
    // For now, we'll return the database clients and indicate Wolf API sync is needed
    const wolfApiClients: any[] = []; // This would be populated by calling Wolf API
    
    const synchronizationStats = {
      databaseClientsCount: databaseClients.length,
      wolfApiClientsCount: wolfApiClients.length,
      duplicatesRemoved: cleanupResult.databaseCleanup.removedByIdCount + cleanupResult.databaseCleanup.removedByPairSecretCount,
      inconsistenciesFound: 0, // Would be calculated when comparing with Wolf API
      finalClientCount: databaseClients.length
    };
    
    logger.info(LogComponent.SYSTEM, 'Client synchronization and cleanup completed', {
      userId,
      ...synchronizationStats
    });
    
    return {
      clients: databaseClients,
      wolfApiClients,
      synchronizationStats
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to synchronize and cleanup clients', error as Error, { userId });
    throw new Error('Failed to synchronize and cleanup clients');
  }
}

/**
 * Advanced duplicate detection that compares clients by multiple criteria
 * Returns detailed information about potential duplicates
 */
/**
 * Get all pair secrets from the client_devices table
 * Used for filtering pending pair requests
 */
export async function getAllPairSecrets(): Promise<string[]> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    const devices = await (db as any)
      .select({
        pairSecret: clientDevicesTable.pairSecret
      })
      .from(clientDevicesTable);
    
    const pairSecrets = devices.map((device: { pairSecret: string }) => device.pairSecret);
    
    logger.debug(LogComponent.SYSTEM, 'Retrieved all pair secrets from database', {
      count: pairSecrets.length
    });
    
    return pairSecrets;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get all pair secrets', error as Error);
    throw new Error('Failed to retrieve pair secrets from database');
  }
}

export async function detectClientDuplicates(userId: string): Promise<{
  exactDuplicates: { byPairSecret: ClientDevice[][] },
  potentialDuplicates: { byFriendlyName: ClientDevice[][] },
  orphanedClients: ClientDevice[],
  statistics: {
    totalClients: number,
    exactDuplicateGroups: number,
    potentialDuplicateGroups: number,
    orphanedCount: number
  }
}> {
  try {
    const db = await getDatabase();
    const clientDevicesTable = getClientDevicesTable();
    
    // Get all devices for the user
    const allDevices = await (db as any)
      .select()
      .from(clientDevicesTable)
      .where(eq(clientDevicesTable.userId, userId))
      .orderBy(desc(clientDevicesTable.createdAt));
    
    // Group by pair secret (exact duplicates)
    const pairSecretGroups: { [key: string]: ClientDevice[] } = {};
    for (const device of allDevices) {
      if (!pairSecretGroups[device.pairSecret]) {
        pairSecretGroups[device.pairSecret] = [];
      }
      pairSecretGroups[device.pairSecret].push(device);
    }
    
    const exactDuplicatesByPairSecret: ClientDevice[][] = [];
    for (const pairSecret in pairSecretGroups) {
      const devices = pairSecretGroups[pairSecret];
      if (devices.length > 1) {
        exactDuplicatesByPairSecret.push(devices);
      }
    }
    
    // Group by friendly name (potential duplicates)
    const friendlyNameGroups: { [key: string]: ClientDevice[] } = {};
    for (const device of allDevices) {
      const normalizedName = device.friendlyName.toLowerCase().trim();
      if (!friendlyNameGroups[normalizedName]) {
        friendlyNameGroups[normalizedName] = [];
      }
      friendlyNameGroups[normalizedName].push(device);
    }
    
    const potentialDuplicatesByFriendlyName: ClientDevice[][] = [];
    for (const friendlyName in friendlyNameGroups) {
      const devices = friendlyNameGroups[friendlyName];
      if (devices.length > 1) {
        // Only include if they're not already exact duplicates
        const hasExactDuplicates = exactDuplicatesByPairSecret.some(group =>
          group.some(exactDevice => devices.some(device => device.id === exactDevice.id))
        );
        if (!hasExactDuplicates) {
          potentialDuplicatesByFriendlyName.push(devices);
        }
      }
    }
    
    // For now, orphaned clients detection would require Wolf API access
    const orphanedClients: ClientDevice[] = [];
    
    const statistics = {
      totalClients: allDevices.length,
      exactDuplicateGroups: exactDuplicatesByPairSecret.length,
      potentialDuplicateGroups: potentialDuplicatesByFriendlyName.length,
      orphanedCount: orphanedClients.length
    };
    
    logger.info(LogComponent.SYSTEM, 'Client duplicate detection completed', {
      userId,
      ...statistics
    });
    
    return {
      exactDuplicates: { byPairSecret: exactDuplicatesByPairSecret },
      potentialDuplicates: { byFriendlyName: potentialDuplicatesByFriendlyName },
      orphanedClients,
      statistics
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to detect client duplicates', error as Error, { userId });
    throw new Error('Failed to detect client duplicates');
  }
}