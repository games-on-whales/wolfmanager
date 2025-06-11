#!/usr/bin/env node

/**
 * TOML to Database Migration Script
 *
 * Standalone script to migrate TOML configuration data to the new database schema
 */

import { migrateTomlToDatabase } from '../lib/migration/migrator';
import type { MigrationOptions, MigrationResult } from '../lib/migration/types';

/**
 * Display migration results
 */
function displayResults(result: MigrationResult): void {
  console.log('\n📊 Migration Results:');
  console.log('═'.repeat(50));
  
  if (result.success) {
    console.log('✅ Status: SUCCESS');
  } else {
    console.log('❌ Status: FAILED');
  }
  
  console.log(`⏱️  Duration: ${result.duration}ms`);
  console.log(`📅 Started: ${result.startTime}`);
  console.log(`🏁 Ended: ${result.endTime}`);
  
  console.log('\n📈 Items Created:');
  console.log(`  👥 Users: ${result.usersCreated}`);
  console.log(`  📱 Client Devices: ${result.clientDevicesCreated}`);
  console.log(`  🎮 Platforms: ${result.platformsCreated}`);
  console.log(`  🎯 Games: ${result.gamesCreated}`);
  console.log(`  📚 User Libraries: ${result.userLibrariesCreated}`);
  console.log(`  🕹️  User Games: ${result.userGamesCreated}`);
  console.log(`  ⚙️  Tasks: ${result.tasksCreated}`);
  console.log(`  🔧 System Configs: ${result.systemConfigCreated}`);
  console.log(`  🏷️  Metadata Providers: ${result.metadataProvidersCreated}`);
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    result.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  console.log('═'.repeat(50));
}

/**
 * Main migration command
 */
async function runMigration(options: {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  skipErrors?: boolean;
  verbose?: boolean;
}): Promise<void> {
  try {
    console.log('🚀 Starting TOML to Database Migration');
    console.log('═'.repeat(50));
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made to the database');
    }
    
    if (options.backup) {
      console.log('💾 Database backup will be created before migration');
    }
    
    if (options.skipErrors) {
      console.log('⚠️ Skip errors mode enabled - migration will continue on non-critical errors');
    }
    
    console.log(''); // Empty line for spacing
    
    const migrationOptions: MigrationOptions = {
      dryRun: options.dryRun || false,
      force: options.force || false,
      backup: options.backup || false,
      skipErrors: options.skipErrors || false,
      verbose: options.verbose || false,
    };
    
    const result = await migrateTomlToDatabase(migrationOptions);
    
    displayResults(result);
    
    if (result.success) {
      if (options.dryRun) {
        console.log('\n✨ Dry run completed successfully! Use --execute to perform the actual migration.');
      } else {
        console.log('\n🎉 Migration completed successfully!');
      }
      process.exit(0);
    } else {
      console.log('\n💥 Migration failed! Check the errors above for details.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Fatal error during migration:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  command: string;
  options: {
    dryRun?: boolean;
    force?: boolean;
    backup?: boolean;
    skipErrors?: boolean;
    verbose?: boolean;
    help?: boolean;
  };
} {
  const args = process.argv.slice(2);
  const options: any = {};
  let command = 'migrate';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--backup':
        options.backup = true;
        break;
      case '--skip-errors':
        options.skipErrors = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case 'check':
        command = 'check';
        options.dryRun = true;
        break;
      case 'backup':
        command = 'backup';
        break;
      case 'migrate':
        command = 'migrate';
        break;
    }
  }

  return { command, options };
}

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
🚀 TOML to Database Migration Tool

USAGE:
  ts-node src/scripts/migrate-toml-to-db.ts [COMMAND] [OPTIONS]

COMMANDS:
  migrate     Perform the TOML to database migration (default)
  check       Check TOML files and preview migration without executing
  backup      Create a database backup

OPTIONS:
  --dry-run       Preview what would be migrated without making changes
  --force         Force migration even if database contains data
  --backup        Create a backup of the database before migration
  --skip-errors   Continue migration even if some operations fail
  -v, --verbose   Enable verbose output
  -h, --help      Show this help message

EXAMPLES:
  # Preview migration without making changes
  ts-node src/scripts/migrate-toml-to-db.ts check --verbose

  # Perform migration with backup
  ts-node src/scripts/migrate-toml-to-db.ts migrate --backup --verbose

  # Dry run with detailed output
  ts-node src/scripts/migrate-toml-to-db.ts --dry-run --verbose

  # Force migration and skip errors
  ts-node src/scripts/migrate-toml-to-db.ts migrate --force --skip-errors
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const { command, options } = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case 'check':
      await runMigration({
        ...options,
        dryRun: true,
      });
      break;
      
    case 'backup':
      console.log('💾 Creating database backup...');
      try {
        await runMigration({
          dryRun: true,
          backup: true,
          verbose: true,
        });
      } catch (error) {
        console.error('💥 Backup failed:', error);
        process.exit(1);
      }
      break;
      
    case 'migrate':
    default:
      await runMigration(options);
      break;
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});