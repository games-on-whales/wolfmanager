import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { pgTable, uuid, varchar, text as pgText, boolean, timestamp, index as pgIndex } from 'drizzle-orm/pg-core';
import { mysqlTable, varchar as mysqlVarchar, text as mysqlText, boolean as mysqlBoolean, timestamp as mysqlTimestamp, index as mysqlIndex } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Task status enum
export const taskStatuses = ['IDLE', 'RUNNING', 'STOPPED', 'ERROR'] as const;
export type TaskStatus = typeof taskStatuses[number];

// SQLite tasks
export const tasksSqlite = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  schedule: text('schedule').notNull(), // Cron expression
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('IDLE').$type<TaskStatus>(),
  lastRunAt: text('last_run_at'), // ISO 8601 timestamp
  nextRunAt: text('next_run_at'), // ISO 8601 timestamp
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  nameIdx: index('tasks_name_idx').on(table.name),
  statusIdx: index('tasks_status_idx').on(table.status),
  isEnabledIdx: index('tasks_enabled_idx').on(table.isEnabled),
  nextRunAtIdx: index('tasks_next_run_idx').on(table.nextRunAt),
}));

// PostgreSQL tasks
export const tasksPostgres = pgTable('tasks', {
  id: uuid('id').primaryKey().$defaultFn(() => randomUUID()),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: pgText('description').notNull(),
  schedule: varchar('schedule', { length: 100 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  status: varchar('status', { length: 20 }).notNull().default('IDLE').$type<TaskStatus>(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameIdx: pgIndex('tasks_name_idx').on(table.name),
  statusIdx: pgIndex('tasks_status_idx').on(table.status),
  isEnabledIdx: pgIndex('tasks_enabled_idx').on(table.isEnabled),
  nextRunAtIdx: pgIndex('tasks_next_run_idx').on(table.nextRunAt),
}));

// MySQL tasks
export const tasksMysql = mysqlTable('tasks', {
  id: mysqlVarchar('id', { length: 128 }).primaryKey().$defaultFn(() => randomUUID()),
  name: mysqlVarchar('name', { length: 255 }).notNull().unique(),
  description: mysqlText('description').notNull(),
  schedule: mysqlVarchar('schedule', { length: 100 }).notNull(),
  isEnabled: mysqlBoolean('is_enabled').notNull().default(true),
  status: mysqlVarchar('status', { length: 20 }).notNull().default('IDLE').$type<TaskStatus>(),
  lastRunAt: mysqlTimestamp('last_run_at'),
  nextRunAt: mysqlTimestamp('next_run_at'),
  createdAt: mysqlTimestamp('created_at').notNull().defaultNow(),
  updatedAt: mysqlTimestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  nameIdx: mysqlIndex('tasks_name_idx').on(table.name),
  statusIdx: mysqlIndex('tasks_status_idx').on(table.status),
  isEnabledIdx: mysqlIndex('tasks_enabled_idx').on(table.isEnabled),
  nextRunAtIdx: mysqlIndex('tasks_next_run_idx').on(table.nextRunAt),
}));

// TypeScript types
export type Task = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  isEnabled: boolean;
  status: TaskStatus;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'>;
export type TaskUpdate = Partial<Omit<Task, 'id' | 'name' | 'createdAt'>>;

// Task execution result type
export type TaskExecutionResult = {
  success: boolean;
  message?: string;
  duration?: number;
  error?: string;
};