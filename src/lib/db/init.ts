/**
 * Database Initialization and Migration Functions
 * 
 * This file contains functions for initializing the database,
 * running migrations, and seeding initial data.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDatabase, checkDatabaseHealth } from './index';
import { databaseConfig } from './config';
import { logger } from '../logger';
import { LogComponent } from '../logger/types';
import {
  setSystemConfig,
  getSystemConfig,
  addPlatform,
  getPlatformById,
  addMetadataProvider,
  getMetadataProviderByName,
  SYSTEM_CONFIG_KEYS,
  METADATA_PROVIDER_NAMES,
} from './helpers';
import { migrateLegacyConfigToDatabase, isMigrationNeeded } from './migrate-config';

/**
 * Check if database exists and is accessible
 */
export async function checkDatabaseExists(): Promise<boolean> {
  try {
    return await checkDatabaseHealth();
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to check database existence', error as Error);
    return false;
  }
}

/**
 * Create database if it doesn't exist (mainly for SQLite)
 */
export async function createDatabaseIfNotExists(): Promise<void> {
  try {
    // For SQLite, the database file is created automatically when we connect
    // For PostgreSQL/MySQL, the database should already exist
    const db = await getDatabase();
    
    logger.info(LogComponent.SYSTEM, 'Database connection established');
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to create database connection', error as Error);
    throw error;
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, 'Starting database migrations');
    
    const db = await getDatabase();
    const migrationsPath = join(process.cwd(), 'src/lib/db/migrations');
    
    // For SQLite, we'll run the SQL file directly
    if (databaseConfig.type === 'sqlite') {
      const migrationFile = join(migrationsPath, '0000_initial_schema.sql');
      
      if (existsSync(migrationFile)) {
        const sql = readFileSync(migrationFile, 'utf-8');
        
        // Split by semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
          try {
            await (db as any).run(statement);
          } catch (error) {
            // Ignore "table already exists" errors
            if (!(error as Error).message.includes('already exists')) {
              throw error;
            }
          }
        }
        
        logger.info(LogComponent.SYSTEM, 'SQLite migration completed successfully');
      } else {
        logger.warn(LogComponent.SYSTEM, 'Migration file not found', { migrationFile });
      }
    } else {
      // For PostgreSQL/MySQL, you would typically use drizzle-kit migrate
      logger.info(LogComponent.SYSTEM, 'For PostgreSQL/MySQL, run: npm run db:migrate');
    }
    
    logger.info(LogComponent.SYSTEM, 'Database migrations completed');
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to run database migrations', error as Error);
    throw error;
  }
}

/**
 * Seed initial data
 */
export async function seedInitialData(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, 'Starting initial data seeding');
    
    // Check if initial setup is already complete
    const setupComplete = await getSystemConfig(SYSTEM_CONFIG_KEYS.FIRST_TIME_SETUP_COMPLETE);
    if (setupComplete && JSON.parse(setupComplete.value) === true) {
      logger.info(LogComponent.SYSTEM, 'Initial setup already complete, skipping seed');
      return;
    }
    
    // Create default platforms
    const defaultPlatforms = [
      { id: 'steam', name: 'Steam', version: '1.0.0' },
      { id: 'epic', name: 'Epic Games Store', version: '1.0.0' },
      { id: 'gog', name: 'GOG Galaxy', version: '1.0.0' },
    ];
    
    for (const platform of defaultPlatforms) {
      const existing = await getPlatformById(platform.id);
      if (!existing) {
        await addPlatform(platform);
        logger.info(LogComponent.SYSTEM, 'Created default platform', { platformId: platform.id });
      }
    }
    
    // Create default metadata providers
    const defaultProviders = [
      {
        name: METADATA_PROVIDER_NAMES.STEAMGRID_DB,
        enabled: true,
        apiKey: null,
        config: JSON.stringify({
          baseUrl: 'https://www.steamgriddb.com/api/v2',
          timeout: 10000,
          retryAttempts: 3,
          imageTypes: ['grid', 'hero', 'logo', 'icon']
        })
      },
      {
        name: METADATA_PROVIDER_NAMES.IGDB,
        enabled: false,
        apiKey: null,
        config: JSON.stringify({
          baseUrl: 'https://api.igdb.com/v4',
          timeout: 10000,
          retryAttempts: 3,
          fieldsToFetch: ['name', 'summary', 'cover', 'genres', 'platforms']
        })
      }
    ];
    
    for (const provider of defaultProviders) {
      const existing = await getMetadataProviderByName(provider.name);
      if (!existing) {
        await addMetadataProvider(provider);
        logger.info(LogComponent.SYSTEM, 'Created default metadata provider', { providerName: provider.name });
      }
    }
    
    // Set default system configuration
    const defaultConfigs = [
      { key: SYSTEM_CONFIG_KEYS.FIRST_TIME_SETUP_COMPLETE, value: false },
      { key: SYSTEM_CONFIG_KEYS.DEFAULT_ADMIN_PASSWORD_CHANGED, value: false },
      { key: SYSTEM_CONFIG_KEYS.STEAM_API_RATE_LIMIT, value: 100000 }, // 100 requests per day
      { key: SYSTEM_CONFIG_KEYS.LIBRARY_SYNC_INTERVAL, value: 3600000 }, // 1 hour in ms
      { key: SYSTEM_CONFIG_KEYS.METADATA_CACHE_TTL, value: 86400000 }, // 24 hours in ms
      { key: SYSTEM_CONFIG_KEYS.LOG_LEVEL, value: 'info' },
      { key: SYSTEM_CONFIG_KEYS.MAX_LOG_FILES, value: 10 },
      { key: SYSTEM_CONFIG_KEYS.LOG_RETENTION_DAYS, value: 30 },
      { key: SYSTEM_CONFIG_KEYS.WOLF_SOCKET_TIMEOUT, value: 30000 }, // 30 seconds
      { key: SYSTEM_CONFIG_KEYS.WOLF_SOCKET_RETRY_ATTEMPTS, value: 3 },
    ];
    
    for (const config of defaultConfigs) {
      const existing = await getSystemConfig(config.key);
      if (!existing) {
        await setSystemConfig(config.key, config.value);
        logger.info(LogComponent.SYSTEM, 'Set default system config', { key: config.key });
      }
    }
    
    logger.info(LogComponent.SYSTEM, 'Initial data seeding completed');
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to seed initial data', error as Error);
    throw error;
  }
}

/**
 * Initialize database (run migrations and seed data)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, 'Starting database initialization');
    
    // Check if database exists
    const dbExists = await checkDatabaseExists();
    if (!dbExists) {
      logger.info(LogComponent.SYSTEM, 'Database not found, creating new database');
      await createDatabaseIfNotExists();
    }
    
    // Run migrations
    await runMigrations();
    
    // Seed initial data
    await seedInitialData();
    
    // Check if legacy configuration migration is needed
    const migrationNeeded = await isMigrationNeeded();
    if (migrationNeeded) {
      logger.info(LogComponent.SYSTEM, 'Legacy configuration detected, starting migration');
      await migrateLegacyConfigToDatabase();
    }
    
    // Verify database health
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error('Database health check failed after initialization');
    }
    
    logger.info(LogComponent.SYSTEM, 'Database initialization completed successfully');
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Database initialization failed', error as Error);
    throw error;
  }
}

/**
 * Reset database (for development/testing)
 */
export async function resetDatabase(): Promise<void> {
  try {
    logger.warn(LogComponent.SYSTEM, 'Starting database reset - ALL DATA WILL BE LOST');
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production');
    }
    
    const db = await getDatabase();
    
    if (databaseConfig.type === 'sqlite') {
      // For SQLite, drop all tables
      const tables = [
        'metadata_providers',
        'system_config',
        'tasks',
        'user_games',
        'user_libraries',
        'games',
        'platforms',
        'client_devices',
        'users'
      ];
      
      for (const table of tables) {
        try {
          await (db as any).run(`DROP TABLE IF EXISTS ${table}`);
        } catch (error) {
          // Ignore errors for non-existent tables
        }
      }
    }
    
    // Re-initialize
    await initializeDatabase();
    
    logger.info(LogComponent.SYSTEM, 'Database reset completed');
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Database reset failed', error as Error);
    throw error;
  }
}