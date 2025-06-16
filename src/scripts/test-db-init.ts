/**
 * Test script for database initialization
 */

import { initializeDatabase, checkDatabaseExists } from '../lib/db/init';
import { logger } from '../lib/logger';
import { LogComponent } from '../lib/logger/types';

async function testDatabaseInit() {
  try {
    console.log('Starting database initialization test...');
    
    // Check if database exists
    const exists = await checkDatabaseExists();
    console.log(`Database exists: ${exists}`);
    
    // Initialize database
    await initializeDatabase();
    
    console.log('Database initialization completed successfully!');
    
    // Test some basic operations
    const { getAllPlatforms } = await import('../lib/db/helpers');
    const platforms = await getAllPlatforms();
    console.log(`Found ${platforms.length} platforms in database`);
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization test failed:', error);
    process.exit(1);
  }
}

testDatabaseInit();