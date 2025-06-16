import { sqliteTable, text, integer, real, index, uniqueIndex, foreignKey } from 'drizzle-orm/sqlite-core';
import { pgTable, uuid, varchar, text as pgText, integer as pgInteger, real as pgReal, timestamp, index as pgIndex, uniqueIndex as pgUniqueIndex, foreignKey as pgForeignKey } from 'drizzle-orm/pg-core';
import { mysqlTable, varchar as mysqlVarchar, text as mysqlText, int as mysqlInt, double as mysqlDouble, timestamp as mysqlTimestamp, index as mysqlIndex, uniqueIndex as mysqlUniqueIndex, foreignKey as mysqlForeignKey } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// PLATFORMS TABLE
// SQLite platforms
export const platformsSqlite = sqliteTable('platforms', {
  id: text('id').primaryKey(), // e.g., "steam", "epic", etc.
  name: text('name').notNull(),
  lastSync: text('last_sync').notNull().$defaultFn(() => new Date().toISOString()),
  version: text('version').notNull().default('1.0.0'),
}, (table) => ({
  nameIdx: index('platforms_name_idx').on(table.name),
}));

// PostgreSQL platforms
export const platformsPostgres = pgTable('platforms', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  lastSync: timestamp('last_sync', { withTimezone: true }).notNull().defaultNow(),
  version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
}, (table) => ({
  nameIdx: pgIndex('platforms_name_idx').on(table.name),
}));

// MySQL platforms
export const platformsMysql = mysqlTable('platforms', {
  id: mysqlVarchar('id', { length: 50 }).primaryKey(),
  name: mysqlVarchar('name', { length: 255 }).notNull(),
  lastSync: mysqlTimestamp('last_sync').notNull().defaultNow(),
  version: mysqlVarchar('version', { length: 20 }).notNull().default('1.0.0'),
}, (table) => ({
  nameIdx: mysqlIndex('platforms_name_idx').on(table.name),
}));

// GAMES TABLE (Master catalog)
// SQLite games
export const gamesSqlite = sqliteTable('games', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  platformId: text('platform_id').notNull().references(() => platformsSqlite.id, { onDelete: 'cascade' }),
  platformGameId: text('platform_game_id').notNull(), // Steam AppID, Epic ID, etc.
  name: text('name').notNull(),
  iconUrl: text('icon_url').notNull().default(''),
  lastUpdated: text('last_updated').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  platformGameIdx: uniqueIndex('games_platform_game_idx').on(table.platformId, table.platformGameId),
  nameIdx: index('games_name_idx').on(table.name),
  platformIdx: index('games_platform_idx').on(table.platformId),
}));

// PostgreSQL games
export const gamesPostgres = pgTable('games', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  platformId: varchar('platform_id', { length: 50 }).notNull().references(() => platformsPostgres.id, { onDelete: 'cascade' }),
  platformGameId: varchar('platform_game_id', { length: 100 }).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  iconUrl: pgText('icon_url').notNull().default(''),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  platformGameIdx: pgUniqueIndex('games_platform_game_idx').on(table.platformId, table.platformGameId),
  nameIdx: pgIndex('games_name_idx').on(table.name),
  platformIdx: pgIndex('games_platform_idx').on(table.platformId),
}));

// MySQL games
export const gamesMysql = mysqlTable('games', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  platformId: mysqlVarchar('platform_id', { length: 50 }).notNull().references(() => platformsMysql.id, { onDelete: 'cascade' }),
  platformGameId: mysqlVarchar('platform_game_id', { length: 100 }).notNull(),
  name: mysqlVarchar('name', { length: 500 }).notNull(),
  iconUrl: mysqlText('icon_url').notNull().default(''),
  lastUpdated: mysqlTimestamp('last_updated').notNull().defaultNow(),
}, (table) => ({
  platformGameIdx: mysqlUniqueIndex('games_platform_game_idx').on(table.platformId, table.platformGameId),
  nameIdx: mysqlIndex('games_name_idx').on(table.name),
  platformIdx: mysqlIndex('games_platform_idx').on(table.platformId),
}));

// USER LIBRARIES TABLE (User-Platform associations)
// SQLite user libraries
export const userLibrariesSqlite = sqliteTable('user_libraries', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull().references(() => usersSqlite.id, { onDelete: 'cascade' }),
  platformId: text('platform_id').notNull().references(() => platformsSqlite.id, { onDelete: 'cascade' }),
  steamId: text('steam_id'), // User's Steam ID for this platform
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userPlatformIdx: uniqueIndex('user_libraries_user_platform_idx').on(table.userId, table.platformId),
  userIdx: index('user_libraries_user_idx').on(table.userId),
  platformIdx: index('user_libraries_platform_idx').on(table.platformId),
}));

// PostgreSQL user libraries
export const userLibrariesPostgres = pgTable('user_libraries', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: uuid('user_id').notNull().references(() => usersPostgres.id, { onDelete: 'cascade' }),
  platformId: varchar('platform_id', { length: 50 }).notNull().references(() => platformsPostgres.id, { onDelete: 'cascade' }),
  steamId: varchar('steam_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPlatformIdx: pgUniqueIndex('user_libraries_user_platform_idx').on(table.userId, table.platformId),
  userIdx: pgIndex('user_libraries_user_idx').on(table.userId),
  platformIdx: pgIndex('user_libraries_platform_idx').on(table.platformId),
}));

// MySQL user libraries
export const userLibrariesMysql = mysqlTable('user_libraries', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  userId: mysqlVarchar('user_id', { length: 128 }).notNull().references(() => usersMysql.id, { onDelete: 'cascade' }),
  platformId: mysqlVarchar('platform_id', { length: 50 }).notNull().references(() => platformsMysql.id, { onDelete: 'cascade' }),
  steamId: mysqlVarchar('steam_id', { length: 100 }),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  userPlatformIdx: mysqlUniqueIndex('user_libraries_user_platform_idx').on(table.userId, table.platformId),
  userIdx: mysqlIndex('user_libraries_user_idx').on(table.userId),
  platformIdx: mysqlIndex('user_libraries_platform_idx').on(table.platformId),
}));

// USER GAMES TABLE (User game ownership and statistics)
// SQLite user games
export const userGamesSqlite = sqliteTable('user_games', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userLibraryId: text('user_library_id').notNull().references(() => userLibrariesSqlite.id, { onDelete: 'cascade' }),
  gameId: text('game_id').notNull().references(() => gamesSqlite.id, { onDelete: 'cascade' }),
  playtimeTotal: integer('playtime_total').notNull().default(0), // minutes
  playtimeLinux: integer('playtime_linux').notNull().default(0), // minutes
  lastPlayed: integer('last_played'), // Unix timestamp
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userLibraryGameIdx: uniqueIndex('user_games_library_game_idx').on(table.userLibraryId, table.gameId),
  userLibraryIdx: index('user_games_library_idx').on(table.userLibraryId),
  gameIdx: index('user_games_game_idx').on(table.gameId),
  lastPlayedIdx: index('user_games_last_played_idx').on(table.lastPlayed),
}));

// PostgreSQL user games
export const userGamesPostgres = pgTable('user_games', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  userLibraryId: uuid('user_library_id').notNull().references(() => userLibrariesPostgres.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id').notNull().references(() => gamesPostgres.id, { onDelete: 'cascade' }),
  playtimeTotal: pgInteger('playtime_total').notNull().default(0),
  playtimeLinux: pgInteger('playtime_linux').notNull().default(0),
  lastPlayed: pgInteger('last_played'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userLibraryGameIdx: pgUniqueIndex('user_games_library_game_idx').on(table.userLibraryId, table.gameId),
  userLibraryIdx: pgIndex('user_games_library_idx').on(table.userLibraryId),
  gameIdx: pgIndex('user_games_game_idx').on(table.gameId),
  lastPlayedIdx: pgIndex('user_games_last_played_idx').on(table.lastPlayed),
}));

// MySQL user games
export const userGamesMysql = mysqlTable('user_games', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  userLibraryId: mysqlVarchar('user_library_id', { length: 128 }).notNull().references(() => userLibrariesMysql.id, { onDelete: 'cascade' }),
  gameId: mysqlVarchar('game_id', { length: 128 }).notNull().references(() => gamesMysql.id, { onDelete: 'cascade' }),
  playtimeTotal: mysqlInt('playtime_total').notNull().default(0),
  playtimeLinux: mysqlInt('playtime_linux').notNull().default(0),
  lastPlayed: mysqlInt('last_played'),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  userLibraryGameIdx: mysqlUniqueIndex('user_games_library_game_idx').on(table.userLibraryId, table.gameId),
  userLibraryIdx: mysqlIndex('user_games_library_idx').on(table.userLibraryId),
  gameIdx: mysqlIndex('user_games_game_idx').on(table.gameId),
  lastPlayedIdx: mysqlIndex('user_games_last_played_idx').on(table.lastPlayed),
}));

// TypeScript types
export type Platform = {
  id: string;
  name: string;
  lastSync: string;
  version: string;
};

export type Game = {
  id: string;
  platformId: string;
  platformGameId: string;
  name: string;
  iconUrl: string;
  lastUpdated: string;
};

export type UserLibrary = {
  id: string;
  userId: string;
  platformId: string;
  steamId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserGame = {
  id: string;
  userLibraryId: string;
  gameId: string;
  playtimeTotal: number;
  playtimeLinux: number;
  lastPlayed?: number | null;
  createdAt: string;
  updatedAt: string;
};

// New types
export type NewPlatform = Omit<Platform, 'lastSync'>;
export type NewGame = Omit<Game, 'id' | 'lastUpdated'>;
export type NewUserLibrary = Omit<UserLibrary, 'id' | 'createdAt' | 'updatedAt'>;
export type NewUserGame = Omit<UserGame, 'id' | 'createdAt' | 'updatedAt'>;

// Update types
export type PlatformUpdate = Partial<Omit<Platform, 'id'>>;
export type GameUpdate = Partial<Omit<Game, 'id' | 'platformId' | 'platformGameId'>>;
export type UserLibraryUpdate = Partial<Omit<UserLibrary, 'id' | 'userId' | 'platformId' | 'createdAt'>>;
export type UserGameUpdate = Partial<Omit<UserGame, 'id' | 'userLibraryId' | 'gameId' | 'createdAt'>>;

// Import users for references
import { usersSqlite, usersPostgres, usersMysql } from './users';