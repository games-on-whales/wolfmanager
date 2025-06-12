/**
 * Migration Module Index
 * 
 * Exports all migration functionality
 */

// Main migration function
export { migrateTomlToDatabase } from './migrator';

// TOML readers
export {
  readDefaultConfig,
  readSteamLibrary,
  readTasksConfig,
  validateTomlData,
  validateTomlFile,
  getAvailableTomlFiles,
  readAllTomlConfigs,
} from './toml-readers';

// Data transformers
export {
  transformUsers,
  transformClientDevices,
  transformGames,
  transformUserLibraries,
  transformUserGames,
  transformTasks,
  transformSystemConfig,
  transformMetadataProviders,
  createLookupMaps,
} from './transformers';

// Types
export type {
  DefaultConfigToml,
  SteamLibraryToml,
  TasksConfigToml,
  TomlSystemConfig,
  TomlUser,
  TomlClientDevice,
  TomlMetadataProvider,
  TomlPlatformMetadata,
  TomlGameMaster,
  TomlUserLibrary,
  TomlUserGame,
  TomlTask,
  MigrationResult,
  MigrationOptions,
  MigrationStepResult,
  FileValidationResult,
  BackupInfo,
} from './types';