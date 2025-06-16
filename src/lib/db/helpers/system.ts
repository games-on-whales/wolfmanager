import { eq } from 'drizzle-orm';
import { getDatabase } from '../index';
import { databaseConfig } from '../config';
import { logger } from '../../logger';
import { LogComponent } from '../../logger/types';
import {
  systemConfigSqlite,
  systemConfigPostgres,
  systemConfigMysql,
  metadataProvidersSqlite,
  metadataProvidersPostgres,
  metadataProvidersMysql,
  type SystemConfig,
  type MetadataProvider,
  type NewSystemConfig,
  type NewMetadataProvider,
  type SystemConfigUpdate,
  type MetadataProviderUpdate,
} from '../schema/system';

/**
 * Get the appropriate tables based on database type
 */
function getTables() {
  switch (databaseConfig.type) {
    case 'sqlite':
      return {
        systemConfig: systemConfigSqlite,
        metadataProviders: metadataProvidersSqlite,
      };
    case 'postgresql':
      return {
        systemConfig: systemConfigPostgres,
        metadataProviders: metadataProvidersPostgres,
      };
    case 'mysql':
      return {
        systemConfig: systemConfigMysql,
        metadataProviders: metadataProvidersMysql,
      };
    default:
      throw new Error(`Unsupported database type: ${databaseConfig.type}`);
  }
}

// SYSTEM CONFIG OPERATIONS

/**
 * Get system config by key
 */
export async function getSystemConfig(key: string): Promise<SystemConfig | null> {
  try {
    const db = await getDatabase();
    const { systemConfig } = getTables();
    
    const [config] = await (db as any)
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key))
      .limit(1);
    
    return config || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get system config', error as Error, { key });
    throw new Error('Failed to retrieve system config');
  }
}

/**
 * Get all system config
 */
export async function getAllSystemConfig(): Promise<SystemConfig[]> {
  try {
    const db = await getDatabase();
    const { systemConfig } = getTables();
    
    const configs = await (db as any).select().from(systemConfig);
    
    return configs;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get all system config', error as Error);
    throw new Error('Failed to retrieve system configs');
  }
}

/**
 * Set system config (create or update)
 */
export async function setSystemConfig(key: string, value: any): Promise<SystemConfig> {
  try {
    const db = await getDatabase();
    const { systemConfig } = getTables();
    
    if (!key) {
      throw new Error('Config key is required');
    }
    
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();
    
    // Check if config already exists
    const existingConfig = await getSystemConfig(key);
    
    if (existingConfig) {
      // Update existing config
      const updatedData = {
        value: stringValue,
        updatedAt: now,
      };
      
      await (db as any)
        .update(systemConfig)
        .set(updatedData)
        .where(eq(systemConfig.key, key));
      
      const updatedConfig = await getSystemConfig(key);
      if (!updatedConfig) {
        throw new Error('Failed to retrieve updated system config');
      }
      
      logger.info(LogComponent.SYSTEM, 'System config updated successfully', { key });
      return updatedConfig;
    } else {
      // Create new config
      const newConfig: SystemConfig = {
        id: crypto.randomUUID(),
        key,
        value: stringValue,
        createdAt: now,
        updatedAt: now,
      };
      
      await (db as any).insert(systemConfig).values(newConfig);
      
      logger.info(LogComponent.SYSTEM, 'System config created successfully', { key });
      return newConfig;
    }
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to set system config', error as Error, { key });
    throw error;
  }
}

/**
 * Delete system config
 */
export async function deleteSystemConfig(key: string): Promise<void> {
  try {
    const db = await getDatabase();
    const { systemConfig } = getTables();
    
    // Check if config exists
    const existingConfig = await getSystemConfig(key);
    if (!existingConfig) {
      throw new Error('System config not found');
    }
    
    await (db as any).delete(systemConfig).where(eq(systemConfig.key, key));
    
    logger.info(LogComponent.SYSTEM, 'System config deleted successfully', { key });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to delete system config', error as Error, { key });
    throw error;
  }
}

// METADATA PROVIDER OPERATIONS

/**
 * Get metadata provider by ID
 */
export async function getMetadataProviderById(id: string): Promise<MetadataProvider | null> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    const [provider] = await (db as any)
      .select()
      .from(metadataProviders)
      .where(eq(metadataProviders.id, id))
      .limit(1);
    
    return provider || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get metadata provider by ID', error as Error, { providerId: id });
    throw new Error('Failed to retrieve metadata provider');
  }
}

/**
 * Get metadata provider by name
 */
export async function getMetadataProviderByName(name: string): Promise<MetadataProvider | null> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    const [provider] = await (db as any)
      .select()
      .from(metadataProviders)
      .where(eq(metadataProviders.name, name))
      .limit(1);
    
    return provider || null;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get metadata provider by name', error as Error, { name });
    throw new Error('Failed to retrieve metadata provider');
  }
}

/**
 * Get all metadata providers
 */
export async function getAllMetadataProviders(): Promise<MetadataProvider[]> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    const providers = await (db as any).select().from(metadataProviders);
    
    return providers;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get all metadata providers', error as Error);
    throw new Error('Failed to retrieve metadata providers');
  }
}

/**
 * Get enabled metadata providers
 */
export async function getEnabledMetadataProviders(): Promise<MetadataProvider[]> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    const providers = await (db as any)
      .select()
      .from(metadataProviders)
      .where(eq(metadataProviders.enabled, true));
    
    return providers;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to get enabled metadata providers', error as Error);
    throw new Error('Failed to retrieve enabled metadata providers');
  }
}

/**
 * Add a new metadata provider
 */
export async function addMetadataProvider(providerData: NewMetadataProvider): Promise<MetadataProvider> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    // Validate required fields
    if (!providerData.name) {
      throw new Error('Provider name is required');
    }
    
    // Check if provider name already exists
    const existingProvider = await getMetadataProviderByName(providerData.name);
    if (existingProvider) {
      throw new Error('Metadata provider name already exists');
    }
    
    const newProvider: MetadataProvider = {
      id: crypto.randomUUID(),
      ...providerData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any).insert(metadataProviders).values(newProvider);
    
    logger.info(LogComponent.SYSTEM, 'Metadata provider created successfully', { 
      providerId: newProvider.id, 
      name: newProvider.name 
    });
    
    return newProvider;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to add metadata provider', error as Error, { 
      name: providerData.name 
    });
    throw error;
  }
}

/**
 * Update metadata provider
 */
export async function updateMetadataProvider(id: string, updates: MetadataProviderUpdate): Promise<MetadataProvider> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    // Check if provider exists
    const existingProvider = await getMetadataProviderById(id);
    if (!existingProvider) {
      throw new Error('Metadata provider not found');
    }
    
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    await (db as any)
      .update(metadataProviders)
      .set(updatedData)
      .where(eq(metadataProviders.id, id));
    
    const updatedProvider = await getMetadataProviderById(id);
    if (!updatedProvider) {
      throw new Error('Failed to retrieve updated metadata provider');
    }
    
    logger.info(LogComponent.SYSTEM, 'Metadata provider updated successfully', { providerId: id });
    
    return updatedProvider;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to update metadata provider', error as Error, { providerId: id });
    throw error;
  }
}

/**
 * Delete metadata provider
 */
export async function deleteMetadataProvider(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    const { metadataProviders } = getTables();
    
    // Check if provider exists
    const existingProvider = await getMetadataProviderById(id);
    if (!existingProvider) {
      throw new Error('Metadata provider not found');
    }
    
    await (db as any).delete(metadataProviders).where(eq(metadataProviders.id, id));
    
    logger.info(LogComponent.SYSTEM, 'Metadata provider deleted successfully', { providerId: id });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to delete metadata provider', error as Error, { providerId: id });
    throw error;
  }
}