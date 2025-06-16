import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { pgTable, uuid, varchar, text as pgText, boolean, timestamp, index as pgIndex, uniqueIndex as pgUniqueIndex } from 'drizzle-orm/pg-core';
import { mysqlTable, varchar as mysqlVarchar, text as mysqlText, boolean as mysqlBoolean, timestamp as mysqlTimestamp, index as mysqlIndex, uniqueIndex as mysqlUniqueIndex } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// SQLite schema
export const usersSqlite = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  hasChangedPassword: integer('has_changed_password', { mode: 'boolean' }).notNull().default(false),
  displayName: text('display_name'),
  steamId: text('steam_id'),
  steamApiKey: text('steam_api_key'), // Encrypted
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
  steamIdIdx: index('users_steam_id_idx').on(table.steamId),
}));

// PostgreSQL schema
export const usersPostgres = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  hasChangedPassword: boolean('has_changed_password').notNull().default(false),
  displayName: varchar('display_name', { length: 255 }),
  steamId: varchar('steam_id', { length: 100 }),
  steamApiKey: pgText('steam_api_key'), // Encrypted
}, (table) => ({
  usernameIdx: pgUniqueIndex('users_username_idx').on(table.username),
  steamIdIdx: pgIndex('users_steam_id_idx').on(table.steamId),
}));

// MySQL schema
export const usersMysql = mysqlTable('users', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  username: mysqlVarchar('username', { length: 255 }).notNull().unique(),
  passwordHash: mysqlVarchar('password_hash', { length: 255 }).notNull(),
  isAdmin: mysqlBoolean('is_admin').notNull().default(false),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  hasChangedPassword: mysqlBoolean('has_changed_password').notNull().default(false),
  displayName: mysqlVarchar('display_name', { length: 255 }),
  steamId: mysqlVarchar('steam_id', { length: 100 }),
  steamApiKey: mysqlText('steam_api_key'), // Encrypted
}, (table) => ({
  usernameIdx: mysqlUniqueIndex('users_username_idx').on(table.username),
  steamIdIdx: mysqlIndex('users_steam_id_idx').on(table.steamId),
}));

// Relations are defined in index.ts to avoid circular imports

// TypeScript types
export type User = {
  id: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  hasChangedPassword: boolean;
  displayName?: string | null;
  steamId?: string | null;
  steamApiKey?: string | null;
};

export type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type UserUpdate = Partial<Omit<User, 'id' | 'createdAt'>>;
