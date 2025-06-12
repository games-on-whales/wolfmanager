import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { pgTable, uuid, varchar, text as pgText, boolean, timestamp, index as pgIndex, uniqueIndex as pgUniqueIndex } from 'drizzle-orm/pg-core';
import { mysqlTable, varchar as mysqlVarchar, text as mysqlText, boolean as mysqlBoolean, timestamp as mysqlTimestamp, index as mysqlIndex, uniqueIndex as mysqlUniqueIndex } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// SYSTEM CONFIG TABLE
// SQLite system config
export const systemConfigSqlite = sqliteTable('system_config', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  keyIdx: uniqueIndex('system_config_key_idx').on(table.key),
}));

// PostgreSQL system config
export const systemConfigPostgres = pgTable('system_config', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: pgText('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyIdx: pgUniqueIndex('system_config_key_idx').on(table.key),
}));

// MySQL system config
export const systemConfigMysql = mysqlTable('system_config', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  key: mysqlVarchar('key', { length: 255 }).notNull().unique(),
  value: mysqlText('value').notNull(),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  keyIdx: mysqlUniqueIndex('system_config_key_idx').on(table.key),
}));

// METADATA PROVIDERS TABLE
// SQLite metadata providers
export const metadataProvidersSqlite = sqliteTable('metadata_providers', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull().unique(), // e.g., "steamgridDb", "igdb"
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  apiKey: text('api_key'), // Encrypted API key
  config: text('config').notNull().default('{}'), // Additional config as JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  nameIdx: uniqueIndex('metadata_providers_name_idx').on(table.name),
  enabledIdx: index('metadata_providers_enabled_idx').on(table.enabled),
}));

// PostgreSQL metadata providers
export const metadataProvidersPostgres = pgTable('metadata_providers', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  name: varchar('name', { length: 100 }).notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  apiKey: pgText('api_key'),
  config: pgText('config').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameIdx: pgUniqueIndex('metadata_providers_name_idx').on(table.name),
  enabledIdx: pgIndex('metadata_providers_enabled_idx').on(table.enabled),
}));

// MySQL metadata providers
export const metadataProvidersMysql = mysqlTable('metadata_providers', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  name: mysqlVarchar('name', { length: 100 }).notNull().unique(),
  enabled: mysqlBoolean('enabled').notNull().default(true),
  apiKey: mysqlText('api_key'),
  config: mysqlText('config').notNull().default('{}'),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  nameIdx: mysqlUniqueIndex('metadata_providers_name_idx').on(table.name),
  enabledIdx: mysqlIndex('metadata_providers_enabled_idx').on(table.enabled),
}));

// TypeScript types
export type SystemConfig = {
  id: string;
  key: string;
  value: string; // JSON string
  createdAt: string;
  updatedAt: string;
};

export type MetadataProvider = {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string | null;
  config: string; // JSON string
  createdAt: string;
  updatedAt: string;
};

// New types
export type NewSystemConfig = Omit<SystemConfig, 'id' | 'createdAt' | 'updatedAt'>;
export type NewMetadataProvider = Omit<MetadataProvider, 'id' | 'createdAt' | 'updatedAt'>;

// Update types
export type SystemConfigUpdate = Partial<Omit<SystemConfig, 'id' | 'key' | 'createdAt'>>;
export type MetadataProviderUpdate = Partial<Omit<MetadataProvider, 'id' | 'name' | 'createdAt'>>;

// Common system configuration keys
export const SYSTEM_CONFIG_KEYS = {
  FIRST_TIME_SETUP_COMPLETE: 'first_time_setup_complete',
  DEFAULT_ADMIN_PASSWORD_CHANGED: 'default_admin_password_changed',
  STEAM_API_RATE_LIMIT: 'steam_api_rate_limit',
  LIBRARY_SYNC_INTERVAL: 'library_sync_interval',
  METADATA_CACHE_TTL: 'metadata_cache_ttl',
  LOG_LEVEL: 'log_level',
  MAX_LOG_FILES: 'max_log_files',
  LOG_RETENTION_DAYS: 'log_retention_days',
  WOLF_SOCKET_TIMEOUT: 'wolf_socket_timeout',
  WOLF_SOCKET_RETRY_ATTEMPTS: 'wolf_socket_retry_attempts',
} as const;

// Common metadata provider names
export const METADATA_PROVIDER_NAMES = {
  STEAMGRID_DB: 'steamgridDb',
  IGDB: 'igdb',
  RAWG: 'rawg',
  MOBYGAMES: 'mobygames',
} as const;

// System configuration value types for type safety
export type SystemConfigValues = {
  [SYSTEM_CONFIG_KEYS.FIRST_TIME_SETUP_COMPLETE]: boolean;
  [SYSTEM_CONFIG_KEYS.DEFAULT_ADMIN_PASSWORD_CHANGED]: boolean;
  [SYSTEM_CONFIG_KEYS.STEAM_API_RATE_LIMIT]: number;
  [SYSTEM_CONFIG_KEYS.LIBRARY_SYNC_INTERVAL]: number;
  [SYSTEM_CONFIG_KEYS.METADATA_CACHE_TTL]: number;
  [SYSTEM_CONFIG_KEYS.LOG_LEVEL]: 'debug' | 'info' | 'warn' | 'error';
  [SYSTEM_CONFIG_KEYS.MAX_LOG_FILES]: number;
  [SYSTEM_CONFIG_KEYS.LOG_RETENTION_DAYS]: number;
  [SYSTEM_CONFIG_KEYS.WOLF_SOCKET_TIMEOUT]: number;
  [SYSTEM_CONFIG_KEYS.WOLF_SOCKET_RETRY_ATTEMPTS]: number;
};

// Metadata provider configuration types
export type MetadataProviderConfig = {
  [METADATA_PROVIDER_NAMES.STEAMGRID_DB]: {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
    imageTypes?: string[];
  };
  [METADATA_PROVIDER_NAMES.IGDB]: {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
    fieldsToFetch?: string[];
  };
  [METADATA_PROVIDER_NAMES.RAWG]: {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
  };
  [METADATA_PROVIDER_NAMES.MOBYGAMES]: {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
  };
};