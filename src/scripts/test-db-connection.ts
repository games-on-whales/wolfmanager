#!/usr/bin/env tsx

/**
 * Database Connection Test Script
 * 
 * This script tests the database connection and initialization
 * to help debug database-related issues.
 */

import { logger } from '../lib/logger';
import { LogComponent } from '../lib/logger/types';
import { getDatabase, checkDatabaseHealth, getDatabaseInfo } from '../lib/db/index';
import { initializeDatabaseWithMigration } from '../lib/db/initializer';
import { getAllUsers } from '../lib/db/helpers/users';
import { getClientDevicesByUserId } from '../lib/db/helpers/clients';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection and initialization...\n');
    
    // 1. Test basic database info
    console.log('📊 Database Configuration:');
    const dbInfo = getDatabaseInfo();
    console.log(`  Type: ${dbInfo.type}`);
    console.log(`  Has Connection: ${dbInfo.hasConnection}`);
    console.log(`  Config: ${JSON.stringify(dbInfo.config, null, 2)}\n`);
    
    // 2. Test database health
    console.log('🏥 Testing database health...');
    const isHealthy = await checkDatabaseHealth();
    console.log(`  Database Health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);
    
    // 3. Test database initialization
    console.log('🚀 Testing database initialization...');
    await initializeDatabaseWithMigration();
    console.log('  Database Initialization: ✅ Completed\n');
    
    // 4. Test basic database operations
    console.log('👥 Testing user operations...');
    const users = await getAllUsers();
    console.log(`  Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`    - ${user.username} (${user.isAdmin ? 'Admin' : 'User'})`);
    });
    console.log();
    
    // 5. Test client device operations for each user
    console.log('📱 Testing client device operations...');
    for (const user of users) {
      try {
        const clientDevices = await getClientDevicesByUserId(user.id);
        console.log(`  User ${user.username}: ${clientDevices.length} client devices`);
        clientDevices.forEach(device => {
          console.log(`    - ${device.friendlyName} (${device.id})`);
        });
      } catch (error) {
        console.log(`  User ${user.username}: ❌ Error getting client devices - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log();
    
    console.log('✅ Database connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection().catch(console.error);