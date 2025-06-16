import { logger } from "../logger";
import { LogComponent } from "../logger/types";
import { getDatabase, checkDatabaseHealth, getDatabaseInfo } from "./index";
import { databaseConfig } from "./config";

/**
 * Database connection status
 */
export interface DatabaseStatus {
  connected: boolean;
  healthy: boolean;
  type: string;
  error?: string;
}

/**
 * Get comprehensive database status
 */
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    const info = getDatabaseInfo();
    const healthy = await checkDatabaseHealth();
    
    return {
      connected: info.hasConnection,
      healthy,
      type: info.config.type,
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to get database status", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      connected: false,
      healthy: false,
      type: databaseConfig.type,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Initialize database and run basic checks
 */
export async function initializeAndVerifyDatabase(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "Initializing and verifying database");
    
    // Get database instance (this will initialize if needed)
    await getDatabase();
    
    // Check health
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error("Database health check failed");
    }
    
    logger.info(LogComponent.SYSTEM, "Database initialization and verification completed successfully");
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Database initialization failed", 
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Retry database operation with exponential backoff
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        logger.error(LogComponent.SYSTEM, 
          `Database operation failed after ${maxRetries} attempts`, lastError);
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(LogComponent.SYSTEM, 
        `Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`, 
        lastError);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Execute database operation with error handling and logging
 */
export async function executeDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    logger.debug(LogComponent.SYSTEM, `Starting database operation: ${operationName}`);
    
    const result = await operation();
    const duration = Date.now() - startTime;
    
    logger.debug(LogComponent.SYSTEM, 
      `Database operation completed: ${operationName}`, { duration });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(LogComponent.SYSTEM, 
      `Database operation failed: ${operationName}`, 
      error instanceof Error ? error : new Error(String(error)), 
      { duration });
    throw error;
  }
}

/**
 * Transaction wrapper with retry logic
 */
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>
): Promise<T> {
  return retryDatabaseOperation(async () => {
    const db = await getDatabase();
    
    // Note: Actual transaction implementation will depend on the schema structure
    // This is a placeholder that will be updated when schemas are created
    return executeDatabaseOperation("transaction", async () => {
      // For now, just execute the operation without explicit transaction
      // This will be enhanced when we add schema definitions
      return operation(db);
    });
  });
}

/**
 * Get database connection string (sanitized for logging)
 */
export function getSanitizedConnectionString(): string {
  const config = databaseConfig;
  
  switch (config.type) {
    case "sqlite":
      return `sqlite:${config.sqliteOptions?.filepath || 'unknown'}`;
    case "postgresql":
    case "mysql":
      // Remove password from URL for logging
      try {
        const url = new URL(config.url);
        if (url.password) {
          url.password = "***";
        }
        return url.toString();
      } catch {
        return `${config.type}://***sanitized***`;
      }
    default:
      return `${config.type}://unknown`;
  }
}

/**
 * Database migration status check
 */
export async function getMigrationStatus(): Promise<{
  hasMigrations: boolean;
  migrationCount: number;
  lastMigration?: string;
}> {
  try {
    // This is a placeholder for migration status checking
    // Will be implemented when migration system is set up
    return {
      hasMigrations: false,
      migrationCount: 0,
    };
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to get migration status", 
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}