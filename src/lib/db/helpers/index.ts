/**
 * Database Helper Functions Index
 * 
 * This file exports all database helper functions from a single entry point,
 * organized by domain (users, clients, games, tasks, system).
 */

// User helpers
export {
  getUserById,
  getUserByUsername,
  getUserBySteamId,
  addUser,
  updateUser,
  deleteUser,
  getAllUsers,
  verifyUserPassword,
} from './users';

// Client device helpers
export {
  getClientDeviceById,
  getClientDeviceByWolfClientId,
  getClientDevicesByUserId,
  addClientDevice,
  updateClientDevice,
  deleteClientDevice,
  getClientDeviceByPairSecret,
  findDuplicateClients,
  removeDuplicateClients,
  cleanupDuplicateClientsForUser,
  synchronizeAndCleanupClients,
  detectClientDuplicates,
} from './clients';

// Game helpers
export {
  // Platform operations
  getPlatformById,
  getAllPlatforms,
  addPlatform,
  updatePlatform,
  
  // Game operations
  getGameById,
  getGamesByPlatform,
  getGameByPlatformGameId,
  addGame,
  updateGame,
  searchGames,
  
  // User library operations
  getUserLibraryById,
  getUserLibrariesByUserId,
  getUserLibraryByUserAndPlatform,
  addUserLibrary,
  updateUserLibrary,
  
  // User game operations
  getUserGameById,
  getUserGamesByLibrary,
  getUserGamesByUserId,
  addUserGame,
  updateUserGame,
  getUserGameWithDetails,
} from './games';

// Task helpers
export {
  getTaskById,
  getTaskByName,
  getAllTasks,
  getEnabledTasks,
  getTasksByStatus,
  addTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskExecution,
} from './tasks';

// System helpers
export {
  // System configuration operations
  getSystemConfig,
  getAllSystemConfig,
  setSystemConfig,
  deleteSystemConfig,
  
  // Metadata provider operations
  getMetadataProviderById,
  getMetadataProviderByName,
  getAllMetadataProviders,
  getEnabledMetadataProviders,
  addMetadataProvider,
  updateMetadataProvider,
  deleteMetadataProvider,
} from './system';

// Re-export types for convenience
export type {
  // User types
  User,
  NewUser,
  UserUpdate,
} from '../schema/users';

export type {
  // Client types
  ClientDevice,
  NewClientDevice,
  ClientDeviceUpdate,
} from '../schema/clients';

export type {
  // Game types
  Platform,
  Game,
  UserLibrary,
  UserGame,
  NewPlatform,
  NewGame,
  NewUserLibrary,
  NewUserGame,
  PlatformUpdate,
  GameUpdate,
  UserLibraryUpdate,
  UserGameUpdate,
} from '../schema/games';

export type {
  // Task types
  Task,
  TaskStatus,
  NewTask,
  TaskUpdate,
  TaskExecutionResult,
} from '../schema/tasks';

export type {
  // System types
  SystemConfig,
  MetadataProvider,
  NewSystemConfig,
  NewMetadataProvider,
  SystemConfigUpdate,
  MetadataProviderUpdate,
  SystemConfigValues,
  MetadataProviderConfig,
} from '../schema/system';

// Export constants
export {
  SYSTEM_CONFIG_KEYS,
  METADATA_PROVIDER_NAMES,
} from '../schema/system';

export {
  taskStatuses,
} from '../schema/tasks';

export {
  TABLE_NAMES,
} from '../schema/index';

// Export additional helper types
export type {
  UserGameWithDetails,
  PaginatedResult,
  SearchOptions,
  DatabaseResult,
  TransactionCallback,
  DatabaseStats,
} from './types';