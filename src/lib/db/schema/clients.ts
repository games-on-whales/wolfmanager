import { sqliteTable, text, index, foreignKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { pgTable, uuid, varchar, timestamp, index as pgIndex, foreignKey as pgForeignKey, uniqueIndex as pgUniqueIndex } from 'drizzle-orm/pg-core';
import { mysqlTable, varchar as mysqlVarchar, timestamp as mysqlTimestamp, index as mysqlIndex, foreignKey as mysqlForeignKey, unique } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// SQLite schema
export const clientDevicesSqlite = sqliteTable('client_devices', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  wolfClientId: text('wolf_client_id').notNull(),
  userId: text('user_id').notNull().references(() => usersSqlite.id, { onDelete: 'cascade' }),
  friendlyName: text('friendly_name').notNull(),
  pairSecret: text('pair_secret').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastSeen: text('last_seen'),
}, (table) => ({
  userIdIdx: index('client_devices_user_id_idx').on(table.userId),
  pairSecretIdx: index('client_devices_pair_secret_idx').on(table.pairSecret),
  wolfClientIdIdx: index('client_devices_wolf_client_id_idx').on(table.wolfClientId),
  userIdWolfClientIdUnique: uniqueIndex('client_devices_user_id_wolf_client_id_unique_idx').on(table.userId, table.wolfClientId),
  userIdPairSecretUnique: uniqueIndex('client_devices_user_id_pair_secret_unique_idx').on(table.userId, table.pairSecret),
}));

// PostgreSQL schema
export const clientDevicesPostgres = pgTable('client_devices', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  wolfClientId: varchar('wolf_client_id', { length: 255 }).notNull(),
  userId: uuid('user_id').notNull().references(() => usersPostgres.id, { onDelete: 'cascade' }),
  friendlyName: varchar('friendly_name', { length: 255 }).notNull(),
  pairSecret: varchar('pair_secret', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
}, (table) => ({
  userIdIdx: pgIndex('client_devices_user_id_idx').on(table.userId),
  pairSecretIdx: pgIndex('client_devices_pair_secret_idx').on(table.pairSecret),
  wolfClientIdIdx: pgIndex('client_devices_wolf_client_id_idx').on(table.wolfClientId),
  userIdWolfClientIdUnique: pgUniqueIndex('client_devices_user_id_wolf_client_id_unique_idx').on(table.userId, table.wolfClientId),
  userIdPairSecretUnique: pgUniqueIndex('client_devices_user_id_pair_secret_unique_idx').on(table.userId, table.pairSecret),
}));

// MySQL schema
export const clientDevicesMysql = mysqlTable('client_devices', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  wolfClientId: mysqlVarchar('wolf_client_id', { length: 255 }).notNull(),
  userId: mysqlVarchar('user_id', { length: 128 }).notNull().references(() => usersMysql.id, { onDelete: 'cascade' }),
  friendlyName: mysqlVarchar('friendly_name', { length: 255 }).notNull(),
  pairSecret: mysqlVarchar('pair_secret', { length: 255 }).notNull(),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  lastSeen: mysqlTimestamp('last_seen'),
}, (table) => ({
  userIdIdx: mysqlIndex('client_devices_user_id_idx').on(table.userId),
  pairSecretIdx: mysqlIndex('client_devices_pair_secret_idx').on(table.pairSecret),
  wolfClientIdIdx: mysqlIndex('client_devices_wolf_client_id_idx').on(table.wolfClientId),
  userIdWolfClientIdUnique: unique('client_devices_user_id_wolf_client_id_unique_idx').on(table.userId, table.wolfClientId),
  userIdPairSecretUnique: unique('client_devices_user_id_pair_secret_unique_idx').on(table.userId, table.pairSecret),
}));

// TypeScript types
export type ClientDevice = {
  id: string;
  wolfClientId: string;
  userId: string;
  friendlyName: string;
  pairSecret: string;
  createdAt: string;
  updatedAt: string;
  lastSeen: string | null;
};

export type NewClientDevice = Omit<ClientDevice, 'id' | 'createdAt' | 'updatedAt'>;
export type ClientDeviceUpdate = Partial<Omit<ClientDevice, 'id' | 'userId' | 'createdAt'>>;

// Import users for references (will be defined in users.ts)
import { usersSqlite, usersPostgres, usersMysql } from './users';