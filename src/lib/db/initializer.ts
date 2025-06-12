/**
 * Database Initializer
 *
 * Handles automatic database initialization including:
 * - Schema creation via raw SQLite migrations (Context7 best practices)
 * - TOML data migration if available
 * - Default admin user creation
 */

import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migrateMysql } from 'drizzle-orm/mysql2/migrator';
import { logger } from '../logger';
import { LogComponent } from '../logger/types';
import { getDatabase, getDatabaseInfo, getRawSqliteInstance } from './index';
import { databaseConfig } from './config';
import { migrateTomlToDatabase } from '../migration/migrator';
import { addUser } from './helpers/users';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

/**
 * Check if database tables exist using raw SQLite instance
 */
async function checkTablesExist(): Promise<boolean> {
  try {
    if (databaseConfig.type !== 'sqlite') {
      // For non-SQLite databases, try to query users table
      const { getAllUsers } = await import('./helpers/users');
      await getAllUsers();
      return true;
    }

    // For SQLite, ensure database connection is established first
    try {
      await getDatabase();
      const rawDb = getRawSqliteInstance();
      if (!rawDb) {
        logger.warn(LogComponent.SYSTEM, "Raw SQLite instance not available for table check");
        return false;
      }

      const result = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      return result !== undefined;
    } catch (error) {
      // If database connection fails, tables definitely don't exist
      return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Validate database connection before performing operations
 */
async function validateDatabaseConnection(): Promise<void> {
  try {
    if (databaseConfig.type === 'sqlite') {
      // Ensure database connection is established first
      await getDatabase();
      const rawDb = getRawSqliteInstance();
      if (!rawDb) {
        throw new Error("Raw SQLite instance not available");
      }
      
      // Test basic connectivity with a simple query
      rawDb.prepare("SELECT 1").get();
      logger.debug(LogComponent.SYSTEM, "SQLite database connection validated");
    } else {
      // For other databases, use Drizzle instance
      const db = await getDatabase();
      // Connection validation is handled by the respective database drivers
      logger.debug(LogComponent.SYSTEM, `${databaseConfig.type} database connection validated`);
    }
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Database connection validation failed",
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Execute SQLite migration using raw better-sqlite3 instance with Context7 best practices
 */
async function executeSqliteMigration(sqlContent: string): Promise<void> {
  // Ensure database connection is established first
  await getDatabase();
  
  const rawDb = getRawSqliteInstance();
  if (!rawDb) {
    throw new Error("Raw SQLite instance not available for migration");
  }

  try {
    logger.info(LogComponent.SYSTEM, "Executing SQLite migration using better-sqlite3 exec() method");
    
    // Validate connection first
    await validateDatabaseConnection();
    
    // Check if migration already applied by looking for users table
    // The check for existing tables is now handled at a higher level.
    // This function will now execute any provided SQL content.
    
    // Begin transaction for atomic migration (Context7 best practice)
    const transaction = rawDb.transaction(() => {
      // Execute the migration SQL using exec() for multi-statement execution
      rawDb.exec(sqlContent);
      
      // Verify migration success by checking if users table was created
      const verifyResult = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      if (!verifyResult) {
        throw new Error("Migration verification failed: users table not created");
      }
      
      logger.info(LogComponent.SYSTEM, "SQLite migration executed and verified successfully");
    });
    
    // Execute transaction
    transaction();
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Enhanced error handling for common SQLite issues
    if (errorMsg.includes('already exists')) {
      logger.warn(LogComponent.SYSTEM, "Database objects already exist, migration may have been partially applied");
      return;
    }
    
    if (errorMsg.includes('no such table')) {
      logger.error(LogComponent.SYSTEM, "Migration failed due to missing dependency tables",
        error instanceof Error ? error : new Error(String(error)));
    } else {
      logger.error(LogComponent.SYSTEM, "SQLite migration execution failed",
        error instanceof Error ? error : new Error(String(error)));
    }
    
    throw error;
  }
}

/**
 * Run Drizzle schema migrations with enhanced error handling and validation
 */
async function runSchemaMigrations(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "Running database schema migrations");
    
    // Validate database connection first
    await validateDatabaseConnection();
    
    const db = await getDatabase();
    const info = getDatabaseInfo();
    const migrationsFolder = path.join(process.cwd(), 'src/lib/db/migrations');
    
    switch (info.config.type) {
      case 'sqlite':
        // Enhanced SQLite migration with raw instance and better error handling
        const migrationFiles = fs.readdirSync(migrationsFolder).filter(file => file.endsWith('.sql')).sort();
        if (migrationFiles.length === 0) {
          logger.warn(LogComponent.SYSTEM, "No SQLite migration files found");
          return;
        }

        for (const migrationFile of migrationFiles) {
          const filePath = path.join(migrationsFolder, migrationFile);
          logger.info(LogComponent.SYSTEM, "Applying SQLite migration file", { migrationFile });
          const sqlContent = fs.readFileSync(filePath, 'utf-8');
          
          // Log migration content size for debugging
          logger.debug(LogComponent.SYSTEM, "Migration file loaded", {
            file: migrationFile,
            fileSize: sqlContent.length,
            statementCount: sqlContent.split(';').filter(s => s.trim()).length
          });
          
          await executeSqliteMigration(sqlContent);
        }
        break;
        
      case 'postgresql':
        logger.info(LogComponent.SYSTEM, "Running PostgreSQL migrations");
        await migratePostgres(db as any, { migrationsFolder });
        break;
        
      case 'mysql':
        logger.info(LogComponent.SYSTEM, "Running MySQL migrations");
        await migrateMysql(db as any, { migrationsFolder });
        break;
        
      default:
        throw new Error(`Unsupported database type for migrations: ${info.config.type}`);
    }
    
    logger.info(LogComponent.SYSTEM, "Database schema migrations completed successfully");
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to run schema migrations",
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Check if TOML configuration files exist
 */
function checkTomlFilesExist(): boolean {
  const configPath = '/app/config';
  const files = [
    path.join(configPath, 'default.toml'),
    path.join(configPath, 'steam-library.toml'),
    path.join(configPath, 'tasks.toml')
  ];
  
  return files.some(file => fs.existsSync(file));
}

/**
 * Run TOML to database migration
 */
async function runTomlMigration(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "Running TOML to database migration");
    
    const result = await migrateTomlToDatabase({
      dryRun: false,
      force: false,
      backup: true,
      skipErrors: false,
      verbose: true
    });
    
    if (result.success) {
      logger.info(LogComponent.SYSTEM, "TOML migration completed successfully", {
        usersCreated: result.usersCreated,
        clientDevicesCreated: result.clientDevicesCreated,
        platformsCreated: result.platformsCreated,
        gamesCreated: result.gamesCreated,
        tasksCreated: result.tasksCreated
      });
    } else {
      logger.warn(LogComponent.SYSTEM, "TOML migration completed with issues", {
        errors: result.errors,
        warnings: result.warnings
      });
    }
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to run TOML migration", 
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Create default admin user if no users exist
 */
async function createDefaultAdminUser(): Promise<void> {
  try {
    const { getAllUsers } = await import('./helpers/users');
    const users = await getAllUsers();
    
    if (users.length === 0) {
      logger.info(LogComponent.SYSTEM, "No users found, creating default admin user");
      
      const defaultPassword = 'admin';
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      
      await addUser({
        username: 'admin',
        passwordHash,
        isAdmin: true,
        hasChangedPassword: false,
        steamId: null,
        steamApiKey: null,
      });
      
      logger.info(LogComponent.SYSTEM, "Default admin user created successfully", {
        username: 'admin',
        password: defaultPassword,
        message: "Please change the default password after first login!"
      });
    } else {
      logger.info(LogComponent.SYSTEM, `Found ${users.length} existing user(s), skipping default admin creation`);
    }
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to create default admin user",
      error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Initialize database with automatic schema creation and data migration
 * Enhanced with Context7 best practices and proper error handling
 */
export async function initializeDatabaseWithMigration(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "Starting enhanced database initialization", {
      databaseType: databaseConfig.type,
      timestamp: new Date().toISOString()
    });
    
    // Step 1: Check if database tables exist (connection validation happens inside)
    const tablesExist = await checkTablesExist();
    logger.info(LogComponent.SYSTEM, "Database table existence check", { tablesExist });
    
    if (!tablesExist) {
      logger.info(LogComponent.SYSTEM, "Database tables not found, running schema migrations");
      await runSchemaMigrations();
      
      // Verify migration success
      const tablesExistAfterMigration = await checkTablesExist();
      if (!tablesExistAfterMigration) {
        throw new Error("Schema migration appeared to succeed but tables still don't exist");
      }
      
      logger.info(LogComponent.SYSTEM, "Schema migrations completed and verified successfully");
    } else {
      logger.info(LogComponent.SYSTEM, "Database tables already exist, skipping schema migration");
    }
    
    // Step 2: Check if users already exist in database before attempting TOML migration
    const { getAllUsers } = await import('./helpers/users');
    
    // Check if any users exist in the database
    let userCount = 0;
    try {
      const existingUsers = await getAllUsers();
      userCount = existingUsers.length;
    } catch (error) {
      // If we can't query users, assume none exist and let the migration proceed
      logger.warn(LogComponent.SYSTEM, "Could not query existing users, proceeding with migration check",
        error instanceof Error ? error : new Error(String(error)));
      userCount = 0;
    }
    
    logger.info(LogComponent.SYSTEM, "Database user count check", { userCount });
    
    if (userCount > 0) {
      logger.info(LogComponent.SYSTEM, "Users already exist in database, skipping TOML migration");
    } else {
      // Step 2a: Check if TOML files exist and migrate if needed
      const tomlFilesExist = checkTomlFilesExist();
      logger.info(LogComponent.SYSTEM, "TOML configuration check", { tomlFilesExist });
      
      if (tomlFilesExist) {
        logger.info(LogComponent.SYSTEM, "TOML configuration files found, running migration");
        await runTomlMigration();
        logger.info(LogComponent.SYSTEM, "TOML migration completed successfully");
      } else {
        logger.info(LogComponent.SYSTEM, "No TOML configuration files found, skipping TOML migration");
        
        // Step 3: Create default admin user if no TOML data was migrated
        await createDefaultAdminUser();
      }
    }
    
    // Step 4: Final validation
    logger.info(LogComponent.SYSTEM, "Performing final database validation");
    const finalTablesExist = await checkTablesExist();
    if (!finalTablesExist) {
      throw new Error("Database initialization completed but tables are missing");
    }
    
    logger.info(LogComponent.SYSTEM, "Database initialization completed successfully", {
      databaseType: databaseConfig.type,
      tablesExist: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Database initialization failed",
      error instanceof Error ? error : new Error(String(error)), {
      databaseType: databaseConfig.type,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Initialize database (alias for backward compatibility)
 */
export const initializeDatabase = initializeDatabaseWithMigration;