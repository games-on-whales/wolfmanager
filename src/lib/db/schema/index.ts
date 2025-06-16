/**
 * Database Schema Index
 * 
 * Exports all database schemas for different database types (SQLite, PostgreSQL, MySQL)
 * and provides TypeScript types for all tables.
 * 
 * Schema files:
 * - users.ts (user accounts and authentication)
 * - clients.ts (client devices)
 * - games.ts (game library, platforms, user libraries, user games)
 * - tasks.ts (background tasks)
 * - system.ts (system configuration and metadata providers)
 */

import { relations } from 'drizzle-orm';

// Import all SQLite schemas
export {
  usersSqlite,
  usersPostgres,
  usersMysql,
  type User,
  type NewUser,
  type UserUpdate,
} from './users';

export {
  clientDevicesSqlite,
  clientDevicesPostgres,
  clientDevicesMysql,
  type ClientDevice,
  type NewClientDevice,
  type ClientDeviceUpdate,
} from './clients';

export {
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
} from './games';

export {
  tasksSqlite,
  tasksPostgres,
  tasksMysql,
  taskStatuses,
  type TaskStatus,
  type Task,
  type NewTask,
  type TaskUpdate,
  type TaskExecutionResult,
} from './tasks';

export {
  systemConfigSqlite,
  systemConfigPostgres,
  systemConfigMysql,
  metadataProvidersSqlite,
  metadataProvidersPostgres,
  metadataProvidersMysql,
  SYSTEM_CONFIG_KEYS,
  METADATA_PROVIDER_NAMES,
  type SystemConfig,
  type MetadataProvider,
  type NewSystemConfig,
  type NewMetadataProvider,
  type SystemConfigUpdate,
  type MetadataProviderUpdate,
  type SystemConfigValues,
  type MetadataProviderConfig,
} from './system';

// Re-import for relations
import { usersSqlite, usersPostgres, usersMysql } from './users';
import { clientDevicesSqlite, clientDevicesPostgres, clientDevicesMysql } from './clients';
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
  userGamesMysql
} from './games';
import { tasksSqlite, tasksPostgres, tasksMysql } from './tasks';
import {
  systemConfigSqlite,
  systemConfigPostgres,
  systemConfigMysql,
  metadataProvidersSqlite,
  metadataProvidersPostgres,
  metadataProvidersMysql
} from './system';

// Define relations for SQLite
export const usersSqliteRelations = relations(usersSqlite, ({ many }) => ({
  clientDevices: many(clientDevicesSqlite),
  userLibraries: many(userLibrariesSqlite),
}));

export const clientDevicesSqliteRelations = relations(clientDevicesSqlite, ({ one }) => ({
  user: one(usersSqlite, {
    fields: [clientDevicesSqlite.userId],
    references: [usersSqlite.id],
  }),
}));

export const platformsSqliteRelations = relations(platformsSqlite, ({ many }) => ({
  games: many(gamesSqlite),
  userLibraries: many(userLibrariesSqlite),
}));

export const gamesSqliteRelations = relations(gamesSqlite, ({ one, many }) => ({
  platform: one(platformsSqlite, {
    fields: [gamesSqlite.platformId],
    references: [platformsSqlite.id],
  }),
  userGames: many(userGamesSqlite),
}));

export const userLibrariesSqliteRelations = relations(userLibrariesSqlite, ({ one, many }) => ({
  user: one(usersSqlite, {
    fields: [userLibrariesSqlite.userId],
    references: [usersSqlite.id],
  }),
  platform: one(platformsSqlite, {
    fields: [userLibrariesSqlite.platformId],
    references: [platformsSqlite.id],
  }),
  userGames: many(userGamesSqlite),
}));

export const userGamesSqliteRelations = relations(userGamesSqlite, ({ one }) => ({
  userLibrary: one(userLibrariesSqlite, {
    fields: [userGamesSqlite.userLibraryId],
    references: [userLibrariesSqlite.id],
  }),
  game: one(gamesSqlite, {
    fields: [userGamesSqlite.gameId],
    references: [gamesSqlite.id],
  }),
}));

// Define relations for PostgreSQL
export const usersPostgresRelations = relations(usersPostgres, ({ many }) => ({
  clientDevices: many(clientDevicesPostgres),
  userLibraries: many(userLibrariesPostgres),
}));

export const clientDevicesPostgresRelations = relations(clientDevicesPostgres, ({ one }) => ({
  user: one(usersPostgres, {
    fields: [clientDevicesPostgres.userId],
    references: [usersPostgres.id],
  }),
}));

export const platformsPostgresRelations = relations(platformsPostgres, ({ many }) => ({
  games: many(gamesPostgres),
  userLibraries: many(userLibrariesPostgres),
}));

export const gamesPostgresRelations = relations(gamesPostgres, ({ one, many }) => ({
  platform: one(platformsPostgres, {
    fields: [gamesPostgres.platformId],
    references: [platformsPostgres.id],
  }),
  userGames: many(userGamesPostgres),
}));

export const userLibrariesPostgresRelations = relations(userLibrariesPostgres, ({ one, many }) => ({
  user: one(usersPostgres, {
    fields: [userLibrariesPostgres.userId],
    references: [usersPostgres.id],
  }),
  platform: one(platformsPostgres, {
    fields: [userLibrariesPostgres.platformId],
    references: [platformsPostgres.id],
  }),
  userGames: many(userGamesPostgres),
}));

export const userGamesPostgresRelations = relations(userGamesPostgres, ({ one }) => ({
  userLibrary: one(userLibrariesPostgres, {
    fields: [userGamesPostgres.userLibraryId],
    references: [userLibrariesPostgres.id],
  }),
  game: one(gamesPostgres, {
    fields: [userGamesPostgres.gameId],
    references: [gamesPostgres.id],
  }),
}));

// Define relations for MySQL
export const usersMysqlRelations = relations(usersMysql, ({ many }) => ({
  clientDevices: many(clientDevicesMysql),
  userLibraries: many(userLibrariesMysql),
}));

export const clientDevicesMysqlRelations = relations(clientDevicesMysql, ({ one }) => ({
  user: one(usersMysql, {
    fields: [clientDevicesMysql.userId],
    references: [usersMysql.id],
  }),
}));

export const platformsMysqlRelations = relations(platformsMysql, ({ many }) => ({
  games: many(gamesMysql),
  userLibraries: many(userLibrariesMysql),
}));

export const gamesMysqlRelations = relations(gamesMysql, ({ one, many }) => ({
  platform: one(platformsMysql, {
    fields: [gamesMysql.platformId],
    references: [platformsMysql.id],
  }),
  userGames: many(userGamesMysql),
}));

export const userLibrariesMysqlRelations = relations(userLibrariesMysql, ({ one, many }) => ({
  user: one(usersMysql, {
    fields: [userLibrariesMysql.userId],
    references: [usersMysql.id],
  }),
  platform: one(platformsMysql, {
    fields: [userLibrariesMysql.platformId],
    references: [platformsMysql.id],
  }),
  userGames: many(userGamesMysql),
}));

export const userGamesMysqlRelations = relations(userGamesMysql, ({ one }) => ({
  userLibrary: one(userLibrariesMysql, {
    fields: [userGamesMysql.userLibraryId],
    references: [userLibrariesMysql.id],
  }),
  game: one(gamesMysql, {
    fields: [userGamesMysql.gameId],
    references: [gamesMysql.id],
  }),
}));

// Create comprehensive schema objects for each database type
export const sqliteSchema = {
  users: usersSqlite,
  clientDevices: clientDevicesSqlite,
  platforms: platformsSqlite,
  games: gamesSqlite,
  userLibraries: userLibrariesSqlite,
  userGames: userGamesSqlite,
  tasks: tasksSqlite,
  systemConfig: systemConfigSqlite,
  metadataProviders: metadataProvidersSqlite,
  // Relations
  usersRelations: usersSqliteRelations,
  clientDevicesRelations: clientDevicesSqliteRelations,
  platformsRelations: platformsSqliteRelations,
  gamesRelations: gamesSqliteRelations,
  userLibrariesRelations: userLibrariesSqliteRelations,
  userGamesRelations: userGamesSqliteRelations,
};

export const postgresSchema = {
  users: usersPostgres,
  clientDevices: clientDevicesPostgres,
  platforms: platformsPostgres,
  games: gamesPostgres,
  userLibraries: userLibrariesPostgres,
  userGames: userGamesPostgres,
  tasks: tasksPostgres,
  systemConfig: systemConfigPostgres,
  metadataProviders: metadataProvidersPostgres,
  // Relations
  usersRelations: usersPostgresRelations,
  clientDevicesRelations: clientDevicesPostgresRelations,
  platformsRelations: platformsPostgresRelations,
  gamesRelations: gamesPostgresRelations,
  userLibrariesRelations: userLibrariesPostgresRelations,
  userGamesRelations: userGamesPostgresRelations,
};

export const mysqlSchema = {
  users: usersMysql,
  clientDevices: clientDevicesMysql,
  platforms: platformsMysql,
  games: gamesMysql,
  userLibraries: userLibrariesMysql,
  userGames: userGamesMysql,
  tasks: tasksMysql,
  systemConfig: systemConfigMysql,
  metadataProviders: metadataProvidersMysql,
  // Relations
  usersRelations: usersMysqlRelations,
  clientDevicesRelations: clientDevicesMysqlRelations,
  platformsRelations: platformsMysqlRelations,
  gamesRelations: gamesMysqlRelations,
  userLibrariesRelations: userLibrariesMysqlRelations,
  userGamesRelations: userGamesMysqlRelations,
};

// Export type for the complete schema
export type DatabaseSchema = typeof sqliteSchema;

// Mark schemas as ready
export const SCHEMAS_READY = true;

// Database table names for reference
export const TABLE_NAMES = {
  USERS: 'users',
  CLIENT_DEVICES: 'client_devices',
  PLATFORMS: 'platforms',
  GAMES: 'games',
  USER_LIBRARIES: 'user_libraries',
  USER_GAMES: 'user_games',
  TASKS: 'tasks',
  SYSTEM_CONFIG: 'system_config',
  METADATA_PROVIDERS: 'metadata_providers',
} as const;

export type TableName = typeof TABLE_NAMES[keyof typeof TABLE_NAMES];