import { logger } from "../logger";
import { LogComponent } from "../logger/types";

export type DatabaseType = "sqlite" | "postgresql" | "mysql";

export interface DatabaseConfig {
  type: DatabaseType;
  url: string;
  // SQLite-specific options
  sqliteOptions?: {
    filepath: string;
  };
  // PostgreSQL-specific options
  postgresOptions?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
  // MySQL-specific options
  mysqlOptions?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
}

/**
 * Parse database configuration from environment variables
 */
function getDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DATABASE_TYPE as DatabaseType) || "sqlite";
  const dbUrl = process.env.DATABASE_URL;
  
  logger.info(LogComponent.SYSTEM, "Initializing database configuration", {
    type: dbType,
    hasUrl: !!dbUrl
  });

  switch (dbType) {
    case "sqlite": {
      const defaultSqlitePath = "./config/wolfmanager.db";
      const sqliteUrl = dbUrl || `file:${defaultSqlitePath}`;
      
      return {
        type: "sqlite",
        url: sqliteUrl,
        sqliteOptions: {
          filepath: dbUrl ? extractSqliteFilepath(dbUrl) : defaultSqlitePath
        }
      };
    }
    
    case "postgresql": {
      if (!dbUrl) {
        throw new Error("DATABASE_URL is required for PostgreSQL configuration");
      }
      
      const parsed = parsePostgresUrl(dbUrl);
      return {
        type: "postgresql",
        url: dbUrl,
        postgresOptions: parsed
      };
    }
    
    case "mysql": {
      if (!dbUrl) {
        throw new Error("DATABASE_URL is required for MySQL configuration");
      }
      
      const parsed = parseMysqlUrl(dbUrl);
      return {
        type: "mysql",
        url: dbUrl,
        mysqlOptions: parsed
      };
    }
    
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * Extract filepath from SQLite URL
 */
function extractSqliteFilepath(url: string): string {
  if (url.startsWith("file:")) {
    return url.slice(5); // Remove "file:" prefix
  }
  return url;
}

/**
 * Parse PostgreSQL connection URL
 */
function parsePostgresUrl(url: string): DatabaseConfig["postgresOptions"] {
  try {
    const parsedUrl = new URL(url);
    
    return {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 5432,
      database: parsedUrl.pathname.slice(1), // Remove leading slash
      username: parsedUrl.username,
      password: parsedUrl.password,
      ssl: parsedUrl.searchParams.get("ssl") === "true" || 
           parsedUrl.searchParams.get("sslmode") === "require"
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to parse PostgreSQL URL", 
      error instanceof Error ? error : new Error(String(error)));
    throw new Error("Invalid PostgreSQL connection URL");
  }
}

/**
 * Parse MySQL connection URL
 */
function parseMysqlUrl(url: string): DatabaseConfig["mysqlOptions"] {
  try {
    const parsedUrl = new URL(url);
    
    return {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 3306,
      database: parsedUrl.pathname.slice(1), // Remove leading slash
      username: parsedUrl.username,
      password: parsedUrl.password,
      ssl: parsedUrl.searchParams.get("ssl") === "true"
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to parse MySQL URL", 
      error instanceof Error ? error : new Error(String(error)));
    throw new Error("Invalid MySQL connection URL");
  }
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.type) {
    throw new Error("Database type is required");
  }
  
  if (!config.url) {
    throw new Error("Database URL is required");
  }
  
  switch (config.type) {
    case "sqlite":
      if (!config.sqliteOptions?.filepath) {
        throw new Error("SQLite filepath is required");
      }
      break;
      
    case "postgresql":
      if (!config.postgresOptions) {
        throw new Error("PostgreSQL options are required");
      }
      const pgOpts = config.postgresOptions;
      if (!pgOpts.host || !pgOpts.database || !pgOpts.username) {
        throw new Error("PostgreSQL host, database, and username are required");
      }
      break;
      
    case "mysql":
      if (!config.mysqlOptions) {
        throw new Error("MySQL options are required");
      }
      const mysqlOpts = config.mysqlOptions;
      if (!mysqlOpts.host || !mysqlOpts.database || !mysqlOpts.username) {
        throw new Error("MySQL host, database, and username are required");
      }
      break;
      
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

// Export the database configuration
export const databaseConfig = getDatabaseConfig();

// Validate the configuration on module load
try {
  validateDatabaseConfig(databaseConfig);
  logger.info(LogComponent.SYSTEM, "Database configuration validated successfully", {
    type: databaseConfig.type
  });
} catch (error) {
  logger.error(LogComponent.SYSTEM, "Database configuration validation failed", 
    error instanceof Error ? error : new Error(String(error)));
  throw error;
}