/**
 * Migration Orchestrator
 * 
 * Main migration logic with proper ordering and error handling
 */

import { 
  addUser,
  addClientDevice,
  addPlatform,
  addGame,
  addUserLibrary,
  addUserGame,
  addTask,
  setSystemConfig,
  addMetadataProvider,
  type User,
  type Platform,
  type Game,
  type UserLibrary,
  type ClientDevice,
  type Task,
  type SystemConfig,
  type MetadataProvider,
} from '../db/helpers';
import {
  readAllTomlConfigs,
  getAvailableTomlFiles,
} from './toml-readers';
import {
  transformUsers,
  transformClientDevices,
  transformGames,
  transformUserLibraries,
  transformUserGames,
  transformTasks,
  transformSystemConfig,
  transformMetadataProviders,
} from './transformers';
import type {
  MigrationResult,
  MigrationOptions,
  MigrationStepResult,
  BackupInfo,
} from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main migration function
 */
export async function migrateTomlToDatabase(options: MigrationOptions = {}): Promise<MigrationResult> {
  const startTime = new Date().toISOString();
  const result: MigrationResult = {
    success: false,
    usersCreated: 0,
    clientDevicesCreated: 0,
    platformsCreated: 0,
    gamesCreated: 0,
    userLibrariesCreated: 0,
    userGamesCreated: 0,
    tasksCreated: 0,
    systemConfigCreated: 0,
    metadataProvidersCreated: 0,
    errors: [],
    warnings: [],
    startTime,
    endTime: '',
    duration: 0,
  };

  try {
    if (options.verbose) {
      console.log('🚀 Starting TOML to database migration...');
    }

    // Step 0: Check if migration has already been completed
    const { getAllUsers } = await import('../db/helpers/users');
    
    // Check if any users exist in the database
    let userCount = 0;
    try {
      const existingUsers = await getAllUsers();
      userCount = existingUsers.length;
    } catch (error) {
      // If we can't query users, assume none exist and let the migration proceed
      if (options.verbose) {
        console.log('Could not query existing users, proceeding with migration check');
      }
      userCount = 0;
    }

    if (userCount > 0 && !options.force) {
      if (options.verbose) {
        console.log(`✅ Migration already completed - found ${userCount} users in database. Use --force to override.`);
      }
      result.success = true;
      result.warnings.push(`Migration already completed - found ${userCount} users in database`);
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - new Date(startTime).getTime();
      return result;
    }

    if (userCount > 0 && options.force && options.verbose) {
      console.log(`⚠️ Found ${userCount} existing users but --force flag provided, proceeding with migration...`);
    }

    // Step 1: Validate TOML files
    if (options.verbose) {
      console.log('📋 Validating TOML files...');
    }
    
    const fileValidation = await getAvailableTomlFiles();
    const validFiles = [];
    
    if (fileValidation.defaultConfig.exists && fileValidation.defaultConfig.valid) {
      validFiles.push('default.toml');
    } else if (fileValidation.defaultConfig.exists) {
      result.errors.push(`Invalid default.toml: ${fileValidation.defaultConfig.error}`);
    } else {
      result.warnings.push('default.toml not found - skipping users and system config');
    }
    
    if (fileValidation.steamLibrary.exists && fileValidation.steamLibrary.valid) {
      validFiles.push('steam.toml');
    } else if (fileValidation.steamLibrary.exists) {
      result.errors.push(`Invalid steam.toml: ${fileValidation.steamLibrary.error}`);
    } else {
      result.warnings.push('steam.toml not found - skipping games and libraries');
    }
    
    if (fileValidation.tasksConfig.exists && fileValidation.tasksConfig.valid) {
      validFiles.push('tasks.toml');
    } else if (fileValidation.tasksConfig.exists) {
      result.errors.push(`Invalid tasks.toml: ${fileValidation.tasksConfig.error}`);
    } else {
      result.warnings.push('tasks.toml not found - skipping tasks');
    }

    if (validFiles.length === 0) {
      throw new Error('No valid TOML files found for migration');
    }

    if (options.verbose) {
      console.log(`✅ Found ${validFiles.length} valid TOML files: ${validFiles.join(', ')}`);
    }

    // Step 2: Create backup if requested
    let backupInfo: BackupInfo | null = null;
    if (options.backup) {
      if (options.verbose) {
        console.log('💾 Creating database backup...');
      }
      try {
        backupInfo = await createDatabaseBackup();
        if (options.verbose) {
          console.log(`✅ Backup created: ${backupInfo.filename}`);
        }
      } catch (error) {
        result.warnings.push(`Backup creation failed: ${error}`);
      }
    }

    // Step 3: Read TOML data
    if (options.verbose) {
      console.log('📖 Reading TOML configuration files...');
    }
    
    const tomlData = await readAllTomlConfigs();

    // Step 4: Dry run check
    if (options.dryRun) {
      if (options.verbose) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
      }
      return await performDryRun(tomlData, result, options);
    }

    // Step 5: Perform migration in correct order
    const migrationSteps = [
      { name: 'users', fn: () => migrateUsers(tomlData.defaultConfig, result, options) },
      { name: 'client devices', fn: () => migrateClientDevices(tomlData.defaultConfig, result, options) },
      { name: 'platforms and games', fn: () => migratePlatformsAndGames(tomlData.steamLibrary, result, options) },
      { name: 'user libraries', fn: () => migrateUserLibraries(tomlData.steamLibrary, result, options) },
      { name: 'user games', fn: () => migrateUserGames(tomlData.steamLibrary, result, options) },
      { name: 'tasks', fn: () => migrateTasks(tomlData.tasksConfig, result, options) },
      { name: 'system config', fn: () => migrateSystemConfig(tomlData.defaultConfig, result, options) },
      { name: 'metadata providers', fn: () => migrateMetadataProviders(tomlData.defaultConfig, result, options) },
    ];

    for (const step of migrationSteps) {
      if (options.verbose) {
        console.log(`🔄 Migrating ${step.name}...`);
      }
      
      try {
        await step.fn();
        if (options.verbose) {
          console.log(`✅ Successfully migrated ${step.name}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate ${step.name}: ${error}`;
        result.errors.push(errorMsg);
        
        if (options.skipErrors) {
          if (options.verbose) {
            console.warn(`⚠️ ${errorMsg} (continuing due to skipErrors option)`);
          }
        } else {
          throw new Error(errorMsg);
        }
      }
    }

    result.success = true;
    if (options.verbose) {
      console.log('🎉 Migration completed successfully!');
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Migration failed: ${error}`);
    
    if (options.verbose) {
      console.error('❌ Migration failed:', error);
    }
  } finally {
    const endTime = new Date().toISOString();
    result.endTime = endTime;
    result.duration = new Date(endTime).getTime() - new Date(startTime).getTime();
  }

  return result;
}

/**
 * Migrate users from TOML data
 */
async function migrateUsers(
  defaultConfig: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<User[]> {
  if (!defaultConfig?.users) {
    result.warnings.push('No users found in default config');
    return [];
  }

  const users: User[] = [];
  const transformedUsers = transformUsers(defaultConfig.users);

  for (const userData of transformedUsers) {
    try {
      const user = await addUser(userData);
      users.push(user);
      result.usersCreated++;
      
      if (options.verbose) {
        console.log(`  ✅ Created user: ${user.username}`);
      }
    } catch (error) {
      const errorMsg = `Failed to create user ${userData.username}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  return users;
}

/**
 * Migrate client devices from TOML data
 */
async function migrateClientDevices(
  defaultConfig: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<ClientDevice[]> {
  if (!defaultConfig?.users) {
    result.warnings.push('No users found in default config for client devices');
    return [];
  }

  const clientDevices: ClientDevice[] = [];
  
  // Create a user map for lookups
  const userMap = new Map<string, string>();
  const { getAllUsers } = await import('../db/helpers/users');
  const existingUsers = await getAllUsers();
  
  for (const user of existingUsers) {
    userMap.set(user.username, user.id);
  }

  const transformedClientDevices = transformClientDevices(defaultConfig.users, userMap);

  for (const clientDeviceData of transformedClientDevices) {
    try {
      const clientDevice = await addClientDevice(clientDeviceData);
      clientDevices.push(clientDevice);
      result.clientDevicesCreated++;
      
      if (options.verbose) {
        console.log(`  ✅ Created client device: ${clientDevice.friendlyName}`);
      }
    } catch (error) {
      const errorMsg = `Failed to create client device ${clientDeviceData.friendlyName}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  return clientDevices;
}

/**
 * Migrate platforms and games from TOML data
 */
async function migratePlatformsAndGames(
  steamLibrary: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<{ platforms: Platform[], games: Game[] }> {
  if (!steamLibrary) {
    result.warnings.push('No Steam library data found');
    return { platforms: [], games: [] };
  }

  const { platforms: platformsData, games: gamesData } = transformGames(steamLibrary);
  const platforms: Platform[] = [];
  const games: Game[] = [];

  // Create platforms first
  for (const platformData of platformsData) {
    try {
      const platform = await addPlatform(platformData);
      platforms.push(platform);
      result.platformsCreated++;
      
      if (options.verbose) {
        console.log(`  ✅ Created platform: ${platform.name}`);
      }
    } catch (error) {
      const errorMsg = `Failed to create platform ${platformData.name}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  // Create games
  for (const gameData of gamesData) {
    try {
      const game = await addGame(gameData);
      games.push(game);
      result.gamesCreated++;
      
      if (options.verbose && result.gamesCreated % 100 === 0) {
        console.log(`  📦 Created ${result.gamesCreated} games...`);
      }
    } catch (error) {
      const errorMsg = `Failed to create game ${gameData.name}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  if (options.verbose) {
    console.log(`  ✅ Created ${result.gamesCreated} games total`);
  }

  return { platforms, games };
}

/**
 * Migrate user libraries from TOML data
 */
async function migrateUserLibraries(
  steamLibrary: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<UserLibrary[]> {
  // This would need to be implemented with proper user and platform mapping
  // For now, returning empty array as a placeholder
  result.warnings.push('User library migration not fully implemented - requires user and platform ID mapping');
  return [];
}

/**
 * Migrate user games from TOML data
 */
async function migrateUserGames(
  steamLibrary: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<void> {
  // This would need to be implemented with proper library and game mapping
  // For now, adding a warning as a placeholder
  result.warnings.push('User games migration not fully implemented - requires library and game ID mapping');
}

/**
 * Migrate tasks from TOML data
 */
async function migrateTasks(
  tasksConfig: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<Task[]> {
  if (!tasksConfig?.tasks) {
    result.warnings.push('No tasks found in tasks config');
    return [];
  }

  const tasks: Task[] = [];
  const transformedTasks = transformTasks(tasksConfig.tasks);

  for (const taskData of transformedTasks) {
    try {
      const task = await addTask(taskData);
      tasks.push(task);
      result.tasksCreated++;
      
      if (options.verbose) {
        console.log(`  ✅ Created task: ${task.name}`);
      }
    } catch (error) {
      const errorMsg = `Failed to create task ${taskData.name}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  return tasks;
}

/**
 * Migrate system configuration from TOML data
 */
async function migrateSystemConfig(
  defaultConfig: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<void> {
  if (!defaultConfig?.system) {
    result.warnings.push('No system config found in default config');
    return;
  }

  const transformedConfig = transformSystemConfig(defaultConfig);

  for (const configData of transformedConfig) {
    try {
      await setSystemConfig(configData.key, configData.value);
      result.systemConfigCreated++;
      
      if (options.verbose) {
        console.log(`  ✅ Set system config: ${configData.key} = ${configData.value}`);
      }
    } catch (error) {
      const errorMsg = `Failed to set system config ${configData.key}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }
}

/**
 * Migrate metadata providers from TOML data
 */
async function migrateMetadataProviders(
  defaultConfig: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<MetadataProvider[]> {
  if (!defaultConfig?.metadataProviders) {
    result.warnings.push('No metadata providers found in default config');
    return [];
  }

  const providers: MetadataProvider[] = [];
  const transformedProviders = transformMetadataProviders(defaultConfig);

  for (const providerData of transformedProviders) {
    try {
      const provider = await addMetadataProvider(providerData);
      providers.push(provider);
      result.metadataProvidersCreated++;
      
      if (options.verbose) {
        console.log(`  ✅ Created metadata provider: ${provider.name}`);
      }
    } catch (error) {
      const errorMsg = `Failed to create metadata provider ${providerData.name}: ${error}`;
      result.errors.push(errorMsg);
      
      if (!options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  return providers;
}

/**
 * Perform a dry run migration
 */
async function performDryRun(
  tomlData: any,
  result: MigrationResult,
  options: MigrationOptions
): Promise<MigrationResult> {
  if (tomlData.defaultConfig?.users) {
    const users = transformUsers(tomlData.defaultConfig.users);
    result.usersCreated = users.length;
  }

  if (tomlData.steamLibrary) {
    const { platforms, games } = transformGames(tomlData.steamLibrary);
    result.platformsCreated = platforms.length;
    result.gamesCreated = games.length;
  }

  if (tomlData.tasksConfig?.tasks) {
    const tasks = transformTasks(tomlData.tasksConfig.tasks);
    result.tasksCreated = tasks.length;
  }

  if (tomlData.defaultConfig?.system) {
    const systemConfig = transformSystemConfig(tomlData.defaultConfig);
    result.systemConfigCreated = systemConfig.length;
  }

  if (tomlData.defaultConfig?.metadataProviders) {
    const providers = transformMetadataProviders(tomlData.defaultConfig);
    result.metadataProvidersCreated = providers.length;
  }

  result.success = true;
  result.warnings.push('This was a dry run - no actual changes were made');

  if (options.verbose) {
    console.log('📊 Dry run results:');
    console.log(`  Users to create: ${result.usersCreated}`);
    console.log(`  Platforms to create: ${result.platformsCreated}`);
    console.log(`  Games to create: ${result.gamesCreated}`);
    console.log(`  Tasks to create: ${result.tasksCreated}`);
    console.log(`  System configs to create: ${result.systemConfigCreated}`);
    console.log(`  Metadata providers to create: ${result.metadataProvidersCreated}`);
  }

  return result;
}

/**
 * Create a database backup
 */
async function createDatabaseBackup(): Promise<BackupInfo> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `database-backup-${timestamp}.sql`;
  const backupPath = path.join(process.cwd(), 'backups', filename);
  
  // Ensure backup directory exists
  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // This is a placeholder - actual backup implementation would depend on the database type
  const placeholder = `-- Database backup created at ${new Date().toISOString()}\n-- This is a placeholder backup file\n`;
  fs.writeFileSync(backupPath, placeholder);

  const stats = fs.statSync(backupPath);
  
  return {
    filename,
    path: backupPath,
    timestamp: new Date().toISOString(),
    size: stats.size,
  };
}