/**
 * Configuration Migration Helper
 * 
 * This file contains functions to migrate existing TOML configuration
 * data to the database during the upgrade process.
 */

import fs from 'fs';
import path from 'path';
import TOML from 'toml';
import bcrypt from 'bcryptjs';
import { logger } from '../logger';
import { LogComponent } from '../logger/types';
import { decrypt } from '../crypto';
import {
  addUser,
  getUserByUsername,
  addClientDevice,
  setSystemConfig,
  getSystemConfig,
  updateMetadataProvider,
  getMetadataProviderByName,
  addTask,
  getTaskByName,
  SYSTEM_CONFIG_KEYS,
} from './helpers';

interface LegacyUserConfig {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  has_changed_password: boolean;
  display_name?: string;
  steam_id?: string;
  steam_api_key?: string;
  clients: Array<{
    id: string;
    friendly_name: string;
    pair_secret: string;
  }>;
}

interface LegacyConfig {
  system: {
    name: string;
    version: string;
  };
  users: { [username: string]: LegacyUserConfig };
  clients: any[];
  metadataProviders?: {
    steamgridDb?: {
      enabled: boolean;
      apiKey: string;
    };
  };
}

interface LegacyTaskConfig {
  tasks: Array<{
    id: string;
    name: string;
    description: string;
    schedule: string;
    is_enabled: boolean;
    status: string;
    last_run_at?: string | null;
    next_run_at?: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

function isEncryptedString(str: string): boolean {
  // Check if the string matches our encryption format (base64:base64:base64)
  const parts = str.split(":");
  return (
    parts.length === 3 &&
    parts.every((part) => /^[A-Za-z0-9+/]*={0,2}$/.test(part))
  );
}

/**
 * Check if legacy TOML config files exist
 */
export function hasLegacyConfig(): boolean {
  const configPath = path.join(process.cwd(), "config", "default.toml");
  return fs.existsSync(configPath);
}

/**
 * Check if legacy tasks config exists
 */
export function hasLegacyTasksConfig(): boolean {
  const tasksPath = path.join(process.cwd(), "config", "tasks.toml");
  return fs.existsSync(tasksPath);
}

/**
 * Load legacy TOML configuration
 */
function loadLegacyConfig(): LegacyConfig | null {
  try {
    const configPath = path.join(process.cwd(), "config", "default.toml");
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const configFile = fs.readFileSync(configPath, "utf-8");
    const config = TOML.parse(configFile) as unknown as LegacyConfig;
    
    logger.info(LogComponent.SYSTEM, "Loaded legacy TOML configuration", {
      userCount: Object.keys(config.users || {}).length,
      hasMetadataProviders: !!config.metadataProviders,
    });
    
    return config;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load legacy TOML configuration",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

/**
 * Load legacy tasks configuration
 */
function loadLegacyTasksConfig(): LegacyTaskConfig | null {
  try {
    const tasksPath = path.join(process.cwd(), "config", "tasks.toml");
    if (!fs.existsSync(tasksPath)) {
      return null;
    }

    const tasksFile = fs.readFileSync(tasksPath, "utf-8");
    const config = TOML.parse(tasksFile) as unknown as LegacyTaskConfig;
    
    logger.info(LogComponent.SYSTEM, "Loaded legacy tasks configuration", {
      taskCount: config.tasks?.length || 0,
    });
    
    return config;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load legacy tasks configuration",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

/**
 * Migrate system configuration
 */
async function migrateSystemConfig(systemConfig: { name: string; version: string }): Promise<void> {
  try {
    await setSystemConfig("system.name", systemConfig.name);
    await setSystemConfig("system.version", systemConfig.version);
    
    logger.info(LogComponent.SYSTEM, "Migrated system configuration", {
      name: systemConfig.name,
      version: systemConfig.version,
    });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to migrate system configuration",
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Migrate users and their client devices
 */
async function migrateUsers(users: { [username: string]: LegacyUserConfig }): Promise<void> {
  for (const [username, legacyUser] of Object.entries(users)) {
    try {
      // Check if user already exists
      const existingUser = await getUserByUsername(username);
      if (existingUser) {
        logger.info(LogComponent.SYSTEM, "User already exists, skipping migration", { username });
        continue;
      }

      // Decrypt sensitive data if encrypted
      let steamId = legacyUser.steam_id || null;
      let steamApiKey = legacyUser.steam_api_key || null;
      
      if (steamId && isEncryptedString(steamId)) {
        try {
          steamId = decrypt(steamId);
        } catch (error) {
          logger.warn(LogComponent.SYSTEM, "Failed to decrypt steam_id, clearing value", { username });
          steamId = null;
        }
      }
      
      if (steamApiKey && isEncryptedString(steamApiKey)) {
        try {
          steamApiKey = decrypt(steamApiKey);
        } catch (error) {
          logger.warn(LogComponent.SYSTEM, "Failed to decrypt steam_api_key, clearing value", { username });
          steamApiKey = null;
        }
      }

      // Create user in database
      const newUser = await addUser({
        username: legacyUser.username,
        passwordHash: legacyUser.password_hash,
        isAdmin: legacyUser.is_admin,
        hasChangedPassword: legacyUser.has_changed_password,
        displayName: legacyUser.display_name || null,
        steamId: steamId,
        steamApiKey: steamApiKey,
      });

      logger.info(LogComponent.SYSTEM, "Migrated user", {
        username: newUser.username,
        isAdmin: newUser.isAdmin,
        clientCount: legacyUser.clients?.length || 0,
      });

      // Migrate client devices
      if (legacyUser.clients && Array.isArray(legacyUser.clients)) {
        for (const client of legacyUser.clients) {
          try {
            await addClientDevice({
              userId: newUser.id,
              friendlyName: client.friendly_name,
              pairSecret: client.pair_secret,
              wolfClientId: `legacy-${client.friendly_name}-${Date.now()}`, // Generate legacy ID for migrated clients
            });
            
            logger.debug(LogComponent.SYSTEM, "Migrated client device", {
              username,
              deviceName: client.friendly_name,
            });
          } catch (error) {
            logger.error(
              LogComponent.SYSTEM,
              "Failed to migrate client device",
              error instanceof Error ? error : new Error(String(error)),
              { username, deviceName: client.friendly_name }
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        LogComponent.SYSTEM,
        "Failed to migrate user",
        error instanceof Error ? error : new Error(String(error)),
        { username }
      );
      // Continue with other users even if one fails
    }
  }
}

/**
 * Migrate metadata providers configuration
 */
async function migrateMetadataProviders(metadataProviders: LegacyConfig['metadataProviders']): Promise<void> {
  if (!metadataProviders) {
    return;
  }

  try {
    if (metadataProviders.steamgridDb) {
      const provider = await getMetadataProviderByName("steamgriddb");
      if (provider) {
        let apiKey = metadataProviders.steamgridDb.apiKey || null;
        
        // Decrypt API key if encrypted
        if (apiKey && isEncryptedString(apiKey)) {
          try {
            apiKey = decrypt(apiKey);
          } catch (error) {
            logger.warn(LogComponent.SYSTEM, "Failed to decrypt SteamGridDB API key, clearing value");
            apiKey = null;
          }
        }

        await updateMetadataProvider(provider.id, {
          enabled: metadataProviders.steamgridDb.enabled,
          apiKey: apiKey,
          updatedAt: new Date().toISOString(),
        });

        logger.info(LogComponent.SYSTEM, "Migrated SteamGridDB metadata provider", {
          enabled: metadataProviders.steamgridDb.enabled,
          hasApiKey: !!apiKey,
        });
      }
    }
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to migrate metadata providers",
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Migrate task configurations
 */
async function migrateTasks(tasksConfig: LegacyTaskConfig): Promise<void> {
  if (!tasksConfig.tasks || !Array.isArray(tasksConfig.tasks)) {
    return;
  }

  for (const legacyTask of tasksConfig.tasks) {
    try {
      // Check if task already exists
      const existingTask = await getTaskByName(legacyTask.name);
      if (existingTask) {
        logger.info(LogComponent.SYSTEM, "Task already exists, skipping migration", { 
          taskName: legacyTask.name 
        });
        continue;
      }

      // Create task in database
      await addTask({
        name: legacyTask.name,
        description: legacyTask.description,
        schedule: legacyTask.schedule,
        isEnabled: legacyTask.is_enabled,
        status: legacyTask.status as any,
      });

      logger.info(LogComponent.SYSTEM, "Migrated task", {
        taskName: legacyTask.name,
        isEnabled: legacyTask.is_enabled,
        status: legacyTask.status,
      });
    } catch (error) {
      logger.error(
        LogComponent.SYSTEM,
        "Failed to migrate task",
        error instanceof Error ? error : new Error(String(error)),
        { taskName: legacyTask.name }
      );
      // Continue with other tasks even if one fails
    }
  }
}

/**
 * Create backup of legacy configuration files
 */
function backupLegacyConfig(): void {
  try {
    const configDir = path.join(process.cwd(), "config");
    const backupDir = path.join(configDir, "backup");
    
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup main config
    const configPath = path.join(configDir, "default.toml");
    if (fs.existsSync(configPath)) {
      const backupPath = path.join(backupDir, `default-${timestamp}.toml`);
      fs.copyFileSync(configPath, backupPath);
      logger.info(LogComponent.SYSTEM, "Backed up legacy config", { backupPath });
    }

    // Backup tasks config
    const tasksPath = path.join(configDir, "tasks.toml");
    if (fs.existsSync(tasksPath)) {
      const backupPath = path.join(backupDir, `tasks-${timestamp}.toml`);
      fs.copyFileSync(tasksPath, backupPath);
      logger.info(LogComponent.SYSTEM, "Backed up legacy tasks config", { backupPath });
    }
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to backup legacy configuration",
      error instanceof Error ? error : new Error(String(error))
    );
    // Don't throw - backup failure shouldn't stop migration
  }
}

/**
 * Main migration function
 */
export async function migrateLegacyConfigToDatabase(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "Starting legacy configuration migration");

    // Check if migration has already been completed
    const migrationComplete = await getSystemConfig(SYSTEM_CONFIG_KEYS.FIRST_TIME_SETUP_COMPLETE);
    if (migrationComplete && JSON.parse(migrationComplete.value) === true) {
      logger.info(LogComponent.SYSTEM, "Migration already completed, skipping");
      return;
    }

    let migrationPerformed = false;

    // Backup existing config files
    if (hasLegacyConfig() || hasLegacyTasksConfig()) {
      backupLegacyConfig();
    }

    // Migrate main configuration
    if (hasLegacyConfig()) {
      const legacyConfig = loadLegacyConfig();
      if (legacyConfig) {
        await migrateSystemConfig(legacyConfig.system);
        await migrateUsers(legacyConfig.users || {});
        await migrateMetadataProviders(legacyConfig.metadataProviders);
        migrationPerformed = true;
        
        logger.info(LogComponent.SYSTEM, "Main configuration migration completed");
      }
    }

    // Migrate tasks configuration
    if (hasLegacyTasksConfig()) {
      const legacyTasksConfig = loadLegacyTasksConfig();
      if (legacyTasksConfig) {
        await migrateTasks(legacyTasksConfig);
        migrationPerformed = true;
        
        logger.info(LogComponent.SYSTEM, "Tasks configuration migration completed");
      }
    }

    // Mark migration as complete if any migration was performed
    if (migrationPerformed) {
      await setSystemConfig(SYSTEM_CONFIG_KEYS.FIRST_TIME_SETUP_COMPLETE, true);
      logger.info(LogComponent.SYSTEM, "Legacy configuration migration completed successfully");
    } else {
      logger.info(LogComponent.SYSTEM, "No legacy configuration found to migrate");
    }
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to migrate legacy configuration",
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded(): Promise<boolean> {
  try {
    // Check if we have legacy config files
    const hasLegacy = hasLegacyConfig() || hasLegacyTasksConfig();
    
    if (!hasLegacy) {
      return false;
    }

    // Check if migration has been completed
    const migrationComplete = await getSystemConfig(SYSTEM_CONFIG_KEYS.FIRST_TIME_SETUP_COMPLETE);
    return !migrationComplete || JSON.parse(migrationComplete.value) !== true;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to check if migration is needed",
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}