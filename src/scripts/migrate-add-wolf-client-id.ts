#!/usr/bin/env node

/**
 * Manual migration script to add wolfClientId column to client_devices table
 * This script handles the migration when drizzle-kit fails due to SQLite binding issues
 */

import { getDatabase } from '../lib/db';
import { logger } from '../lib/logger';
import { LogComponent } from '../lib/logger/types';

async function migrateDatabaseSchema() {
  try {
    logger.info(LogComponent.SYSTEM, 'Starting manual migration: Add wolfClientId column');
    
    const db = await getDatabase();
    
    // Check if the column already exists
    const tableInfo = await (db as any).pragma(`table_info(client_devices)`);
    const hasWolfClientId = tableInfo.some((col: any) => col.name === 'wolf_client_id');
    
    if (hasWolfClientId) {
      logger.info(LogComponent.SYSTEM, 'Migration already applied: wolfClientId column exists');
      return;
    }
    
    logger.info(LogComponent.SYSTEM, 'Adding wolfClientId column to client_devices table');
    
    // Add the new column
    await (db as any).exec(`ALTER TABLE client_devices ADD COLUMN wolf_client_id TEXT;`);
    
    // Update existing records to use a placeholder value (they will need to be re-paired)
    await (db as any).exec(`UPDATE client_devices SET wolf_client_id = 'NEEDS_REPAIRING_' || id WHERE wolf_client_id IS NULL;`);
    
    // Add index for wolf_client_id
    await (db as any).exec(`CREATE INDEX IF NOT EXISTS client_devices_wolf_client_id_idx ON client_devices(wolf_client_id);`);
    
    // Add unique constraint for user_id + wolf_client_id
    await (db as any).exec(`CREATE UNIQUE INDEX IF NOT EXISTS client_devices_user_id_wolf_client_id_unique_idx ON client_devices(user_id, wolf_client_id);`);
    
    logger.info(LogComponent.SYSTEM, 'Migration completed successfully: wolfClientId column added');
    
    // Verify the migration
    const updatedTableInfo = await (db as any).pragma(`table_info(client_devices)`);
    const wolfClientIdColumn = updatedTableInfo.find((col: any) => col.name === 'wolf_client_id');
    
    if (wolfClientIdColumn) {
      logger.info(LogComponent.SYSTEM, 'Migration verification successful', {
        columnName: wolfClientIdColumn.name,
        columnType: wolfClientIdColumn.type,
        notNull: wolfClientIdColumn.notnull
      });
    } else {
      throw new Error('Migration verification failed: wolfClientId column not found');
    }
    
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Migration failed', error as Error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateDatabaseSchema()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateDatabaseSchema };