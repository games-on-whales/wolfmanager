import { initializeDatabase } from '../lib/db/initializer';
import { logger } from '../lib/logger';
import { LogComponent } from '../lib/logger/types';

async function forceMigrate() {
  try {
    logger.info(LogComponent.SYSTEM, 'Forcing database migration...');
    // By calling initializeDatabase, we trigger the migration logic.
    // The updated initializer should now apply all pending migrations.
    await initializeDatabase();
    logger.info(LogComponent.SYSTEM, 'Database migration completed successfully.');
  } catch (error) {
    logger.error(LogComponent.SYSTEM, 'Failed to force database migration', error as Error);
    process.exit(1);
  }
}

forceMigrate();