import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import Database from "better-sqlite3";
import postgres from "postgres";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

import { logger } from "../logger";
import { LogComponent } from "../logger/types";
import { databaseConfig, DatabaseConfig } from "./config";

// Database client types
type SqliteDatabase = ReturnType<typeof drizzle<Record<string, never>>>;
type PostgresDatabase = ReturnType<typeof drizzlePostgres<Record<string, never>>>;
type MysqlDatabase = ReturnType<typeof drizzleMysql>;

export type Database = SqliteDatabase | PostgresDatabase | MysqlDatabase;

// Connection instances
let dbInstance: Database | null = null;
let sqliteConnection: Database | null = null;
let rawSqliteInstance: InstanceType<typeof Database> | null = null; // Raw better-sqlite3 instance for migrations
let postgresConnection: postgres.Sql | null = null;
let mysqlConnection: mysql.Pool | null = null;

/**
 * Ensure data directory exists for SQLite
 */
function ensureDataDirectory(filepath: string): void {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      logger.info(LogComponent.SYSTEM, "Created data directory", { dir });
    } catch (error) {
      logger.error(LogComponent.SYSTEM, "Failed to create data directory", 
        error instanceof Error ? error : new Error(String(error)), { dir });
      throw error;
    }
  }
}

/**
 * Initialize SQLite database connection
 */
async function initializeSqlite(config: DatabaseConfig): Promise<SqliteDatabase> {
  try {
    if (!config.sqliteOptions?.filepath) {
      throw new Error("SQLite filepath is required");
    }

    const filepath = config.sqliteOptions.filepath;
    ensureDataDirectory(filepath);

    logger.info(LogComponent.SYSTEM, "Initializing SQLite database", { filepath });
    
    const sqlite = new Database(filepath);
    
    // Store raw SQLite instance for migration operations
    rawSqliteInstance = sqlite;
    
    // Enable foreign keys
    sqlite.pragma("foreign_keys = ON");
    
    // Enable WAL mode for better concurrency (Context7 best practice)
    sqlite.pragma("journal_mode = WAL");
    
    // Set reasonable timeout
    sqlite.pragma("busy_timeout = 5000");
    
    // SQLite optimizations from Context7 documentation
    sqlite.pragma("cache_size = -16000"); // 16MB cache
    sqlite.pragma("synchronous = NORMAL"); // Faster writes with WAL mode
    sqlite.pragma("temp_store = MEMORY"); // Store temp tables in memory
    
    const db = drizzle(sqlite);
    
    logger.info(LogComponent.SYSTEM, "SQLite database initialized successfully with WAL mode and optimizations");
    return db;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to initialize SQLite database", 
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Initialize PostgreSQL database connection
 */
async function initializePostgres(config: DatabaseConfig): Promise<PostgresDatabase> {
  try {
    if (!config.url) {
      throw new Error("PostgreSQL connection URL is required");
    }

    logger.info(LogComponent.SYSTEM, "Initializing PostgreSQL database");
    
    const sql = postgres(config.url, {
      max: 10, // Maximum number of connections
      idle_timeout: 20,
      connect_timeout: 10,
    });
    
    // Test the connection
    await sql`SELECT 1`;
    
    postgresConnection = sql;
    const db = drizzlePostgres(sql);
    
    logger.info(LogComponent.SYSTEM, "PostgreSQL database initialized successfully");
    return db;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to initialize PostgreSQL database", 
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Initialize MySQL database connection
 */
async function initializeMysql(config: DatabaseConfig): Promise<MysqlDatabase> {
  try {
    if (!config.url) {
      throw new Error("MySQL connection URL is required");
    }

    logger.info(LogComponent.SYSTEM, "Initializing MySQL database");
    
    // Create connection pool with promise support
    const pool = mysql.createPool(config.url);
    
    // Test the connection
    await pool.execute("SELECT 1");
    
    mysqlConnection = pool;
    const db = drizzleMysql(pool as any);
    
    logger.info(LogComponent.SYSTEM, "MySQL database initialized successfully");
    return db as MysqlDatabase;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to initialize MySQL database",
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Initialize database connection based on configuration
 */
async function initializeDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    logger.info(LogComponent.SYSTEM, "Initializing database connection", {
      type: databaseConfig.type
    });

    let database: Database;

    switch (databaseConfig.type) {
      case "sqlite":
        database = await initializeSqlite(databaseConfig);
        break;
      case "postgresql":
        database = await initializePostgres(databaseConfig);
        break;
      case "mysql":
        database = await initializeMysql(databaseConfig);
        break;
      default:
        throw new Error(`Unsupported database type: ${databaseConfig.type}`);
    }

    dbInstance = database;
    logger.info(LogComponent.SYSTEM, "Database connection established successfully");
    
    // Database connection established successfully
    // Note: Database initialization is handled explicitly in app/layout.tsx
    return database;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to initialize database connection",
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get database instance (lazy initialization)
 */
export async function getDatabase(): Promise<Database> {
  logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: getDatabase called', {
    hasInstance: !!dbInstance,
    databaseType: databaseConfig.type,
    timestamp: new Date().toISOString()
  });

  if (!dbInstance) {
    logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: getDatabase initializing new connection', {
      databaseType: databaseConfig.type,
      timestamp: new Date().toISOString()
    });
    dbInstance = await initializeDatabase();
  }
  
  logger.debug(LogComponent.SYSTEM, 'DIAGNOSIS: getDatabase returning instance', {
    hasInstance: !!dbInstance,
    timestamp: new Date().toISOString()
  });
  
  return dbInstance;
}

/**
 * Get raw SQLite instance for migration operations
 * Only available when using SQLite database
 */
export function getRawSqliteInstance(): InstanceType<typeof Database> | null {
  if (databaseConfig.type !== 'sqlite') {
    throw new Error('Raw SQLite instance only available when using SQLite database');
  }
  return rawSqliteInstance;
}

/**
 * Close database connections gracefully
 */
export async function closeDatabase(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "Closing database connections");

    if (postgresConnection) {
      await postgresConnection.end();
      postgresConnection = null;
      logger.info(LogComponent.SYSTEM, "PostgreSQL connection closed");
    }

    if (mysqlConnection) {
      await mysqlConnection.end();
      mysqlConnection = null;
      logger.info(LogComponent.SYSTEM, "MySQL connection closed");
    }

    // SQLite connections are automatically closed when the Database instance is destroyed
    if (sqliteConnection) {
      sqliteConnection = null;
      logger.info(LogComponent.SYSTEM, "SQLite connection closed");
    }

    dbInstance = null;
    logger.info(LogComponent.SYSTEM, "All database connections closed");
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Error closing database connections", 
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = await getDatabase();
    
    switch (databaseConfig.type) {
      case "sqlite":
        // SQLite simple query
        await (db as SqliteDatabase).run("SELECT 1");
        break;
      case "postgresql":
        if (!postgresConnection) throw new Error("PostgreSQL connection not initialized");
        await postgresConnection`SELECT 1`;
        break;
      case "mysql":
        if (!mysqlConnection) throw new Error("MySQL connection not initialized");
        await mysqlConnection.execute("SELECT 1");
        break;
    }
    
    return true;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Database health check failed", 
      error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Get database configuration information
 */
export function getDatabaseInfo() {
  return {
    type: databaseConfig.type,
    hasConnection: dbInstance !== null,
    config: {
      type: databaseConfig.type,
      // Don't expose sensitive connection details
      ...(databaseConfig.type === "sqlite" && {
        filepath: databaseConfig.sqliteOptions?.filepath
      })
    }
  };
}

// Export the database instance getter as default
export default getDatabase;

// Handle graceful shutdown
if (typeof process !== "undefined") {
  process.on("SIGINT", async () => {
    logger.info(LogComponent.SYSTEM, "Received SIGINT, closing database connections");
    await closeDatabase();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info(LogComponent.SYSTEM, "Received SIGTERM, closing database connections");
    await closeDatabase();
    process.exit(0);
  });
}