/**
 * Migration System Test
 * 
 * Simple test to verify the migration system components work correctly
 */

import { 
  readAllTomlConfigs,
  getAvailableTomlFiles,
  transformUsers,
  transformGames,
  transformTasks,
  transformSystemConfig,
  transformMetadataProviders,
} from './index';

/**
 * Test TOML file reading
 */
async function testTomlReading(): Promise<void> {
  console.log('🧪 Testing TOML file reading...');
  
  try {
    const fileValidation = await getAvailableTomlFiles();
    
    console.log('📋 File validation results:');
    console.log(`  default.toml: ${fileValidation.defaultConfig.exists ? '✅' : '❌'} ${fileValidation.defaultConfig.valid ? 'Valid' : 'Invalid'}`);
    console.log(`  steam.toml: ${fileValidation.steamLibrary.exists ? '✅' : '❌'} ${fileValidation.steamLibrary.valid ? 'Valid' : 'Invalid'}`);
    console.log(`  tasks.toml: ${fileValidation.tasksConfig.exists ? '✅' : '❌'} ${fileValidation.tasksConfig.valid ? 'Valid' : 'Invalid'}`);
    
    const tomlData = await readAllTomlConfigs();
    
    console.log('📖 TOML data reading results:');
    console.log(`  Default config: ${tomlData.defaultConfig ? '✅' : '❌'}`);
    console.log(`  Steam library: ${tomlData.steamLibrary ? '✅' : '❌'}`);
    console.log(`  Tasks config: ${tomlData.tasksConfig ? '✅' : '❌'}`);
    
    return;
  } catch (error) {
    console.error('❌ TOML reading test failed:', error);
    throw error;
  }
}

/**
 * Test data transformations
 */
async function testDataTransformations(): Promise<void> {
  console.log('\n🔄 Testing data transformations...');
  
  try {
    const tomlData = await readAllTomlConfigs();
    
    // Test user transformations
    if (tomlData.defaultConfig?.users) {
      const users = transformUsers(tomlData.defaultConfig.users);
      console.log(`  ✅ Transformed ${users.length} users`);
      
      if (users.length > 0) {
        console.log(`    Sample user: ${users[0].username} (admin: ${users[0].isAdmin})`);
      }
    }
    
    // Test game transformations
    if (tomlData.steamLibrary) {
      const { platforms, games } = transformGames(tomlData.steamLibrary);
      console.log(`  ✅ Transformed ${platforms.length} platforms and ${games.length} games`);
      
      if (games.length > 0) {
        console.log(`    Sample game: ${games[0].name} (Platform: ${games[0].platformId})`);
      }
    }
    
    // Test task transformations
    if (tomlData.tasksConfig?.tasks) {
      const tasks = transformTasks(tomlData.tasksConfig.tasks);
      console.log(`  ✅ Transformed ${tasks.length} tasks`);
      
      if (tasks.length > 0) {
        console.log(`    Sample task: ${tasks[0].name} (Enabled: ${tasks[0].isEnabled})`);
      }
    }
    
    // Test system config transformations
    if (tomlData.defaultConfig?.system) {
      const systemConfigs = transformSystemConfig(tomlData.defaultConfig);
      console.log(`  ✅ Transformed ${systemConfigs.length} system configs`);
      
      if (systemConfigs.length > 0) {
        console.log(`    Sample config: ${systemConfigs[0].key} = ${systemConfigs[0].value}`);
      }
    }
    
    // Test metadata provider transformations
    if (tomlData.defaultConfig?.metadataProviders) {
      const providers = transformMetadataProviders(tomlData.defaultConfig);
      console.log(`  ✅ Transformed ${providers.length} metadata providers`);
      
      if (providers.length > 0) {
        console.log(`    Sample provider: ${providers[0].name} (Config: ${providers[0].config})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Data transformation test failed:', error);
    throw error;
  }
}

/**
 * Test migration validation
 */
async function testMigrationValidation(): Promise<void> {
  console.log('\n✅ Testing migration validation...');
  
  try {
    const tomlData = await readAllTomlConfigs();
    let totalItems = 0;
    
    if (tomlData.defaultConfig?.users) {
      const userCount = Object.keys(tomlData.defaultConfig.users).length;
      totalItems += userCount;
      console.log(`  📊 Would create ${userCount} users`);
    }
    
    if (tomlData.steamLibrary?.games) {
      const gameCount = Object.keys(tomlData.steamLibrary.games).length;
      totalItems += gameCount;
      console.log(`  📊 Would create ${gameCount} games`);
    }
    
    if (tomlData.tasksConfig?.tasks) {
      const taskCount = tomlData.tasksConfig.tasks.length;
      totalItems += taskCount;
      console.log(`  📊 Would create ${taskCount} tasks`);
    }
    
    console.log(`  📈 Total items to migrate: ${totalItems}`);
    
    if (totalItems === 0) {
      console.warn('  ⚠️ No items found to migrate - check TOML files');
    } else {
      console.log('  ✅ Migration validation passed');
    }
    
  } catch (error) {
    console.error('❌ Migration validation test failed:', error);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  console.log('🚀 Starting Migration System Tests');
  console.log('═'.repeat(50));
  
  try {
    await testTomlReading();
    await testDataTransformations();
    await testMigrationValidation();
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('\n💥 Tests failed:', error);
    console.log('═'.repeat(50));
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { runTests };