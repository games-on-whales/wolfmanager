#!/usr/bin/env node

/**
 * Direct test of the ensureSecureKeys function by compiling TypeScript first
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_FILE_PATH = path.join(process.cwd(), '.env.local');
const BACKUP_ENV_PATH = path.join(process.cwd(), '.env.local.backup');

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

function backupExistingEnv() {
  if (fs.existsSync(ENV_FILE_PATH)) {
    fs.copyFileSync(ENV_FILE_PATH, BACKUP_ENV_PATH);
    log('Backed up existing .env.local file');
  }
}

function restoreEnv() {
  if (fs.existsSync(BACKUP_ENV_PATH)) {
    fs.copyFileSync(BACKUP_ENV_PATH, ENV_FILE_PATH);
    fs.unlinkSync(BACKUP_ENV_PATH);
    log('Restored original .env.local file');
  } else if (fs.existsSync(ENV_FILE_PATH)) {
    fs.unlinkSync(ENV_FILE_PATH);
    log('Removed test .env.local file');
  }
}

function readEnvFile() {
  try {
    if (!fs.existsSync(ENV_FILE_PATH)) return {};
    
    const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    const env = {};
    
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return env;
  } catch (error) {
    log(`Error reading env file: ${error.message}`, 'ERROR');
    return {};
  }
}

function isValidHex(str, expectedLength) {
  return str && str.length === expectedLength && /^[0-9a-f]+$/.test(str);
}

async function testFreshInstallation() {
  log('\n=== Testing Fresh Installation Scenario ===');
  
  // Remove any existing env file
  if (fs.existsSync(ENV_FILE_PATH)) {
    fs.unlinkSync(ENV_FILE_PATH);
  }
  
  // Clear environment variables
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.ENCRYPTION_KEY;
  
  try {
    // Run the instrumentation directly which calls ensureSecureKeys
    const result = execSync('node -e "require(\'./src/instrumentation.ts\').register()"', {
      encoding: 'utf-8',
      env: { ...process.env, NEXT_RUNTIME: 'nodejs' }
    });
    
    log('Fresh Install - Function executed successfully');
    
    // Check if .env.local file was created
    const envFileExists = fs.existsSync(ENV_FILE_PATH);
    log(`Fresh Install - .env.local File Created: ${envFileExists ? 'PASS' : 'FAIL'}`);
    
    if (envFileExists) {
      const envContent = readEnvFile();
      
      // Validate NEXTAUTH_SECRET
      const hasNextAuthSecret = !!envContent.NEXTAUTH_SECRET;
      const validNextAuthSecret = isValidHex(envContent.NEXTAUTH_SECRET, 64);
      log(`Fresh Install - NEXTAUTH_SECRET Present: ${hasNextAuthSecret ? 'PASS' : 'FAIL'}`);
      log(`Fresh Install - NEXTAUTH_SECRET Format (64 hex chars): ${validNextAuthSecret ? 'PASS' : 'FAIL'} (Length: ${envContent.NEXTAUTH_SECRET?.length})`);
      
      // Validate ENCRYPTION_KEY
      const hasEncryptionKey = !!envContent.ENCRYPTION_KEY;
      const validEncryptionKey = isValidHex(envContent.ENCRYPTION_KEY, 32);
      log(`Fresh Install - ENCRYPTION_KEY Present: ${hasEncryptionKey ? 'PASS' : 'FAIL'}`);
      log(`Fresh Install - ENCRYPTION_KEY Format (32 hex chars): ${validEncryptionKey ? 'PASS' : 'FAIL'} (Length: ${envContent.ENCRYPTION_KEY?.length})`);
      
      // Check NEXTAUTH_URL in development
      const hasNextAuthUrl = !!envContent.NEXTAUTH_URL;
      log(`Fresh Install - NEXTAUTH_URL Generated: ${hasNextAuthUrl ? 'PASS' : 'FAIL'} (${envContent.NEXTAUTH_URL || 'Not set'})`);
    }
    
  } catch (error) {
    log(`Fresh Install - Function Execution: FAIL - ${error.message}`, 'ERROR');
  }
}

async function testExistingSecrets() {
  log('\n=== Testing Existing Secrets Preservation ===');
  
  // Create .env.local with existing secrets
  const existingSecret = 'a'.repeat(64);
  const existingKey = 'b'.repeat(32);
  
  const envContent = `NEXTAUTH_SECRET=${existingSecret}\nENCRYPTION_KEY=${existingKey}`;
  fs.writeFileSync(ENV_FILE_PATH, envContent);
  
  try {
    const result = execSync('node -e "require(\'./src/instrumentation.ts\').register()"', {
      encoding: 'utf-8',
      env: { ...process.env, NEXT_RUNTIME: 'nodejs' }
    });
    
    const newEnvContent = readEnvFile();
    
    const secretPreserved = newEnvContent.NEXTAUTH_SECRET === existingSecret;
    const keyPreserved = newEnvContent.ENCRYPTION_KEY === existingKey;
    
    log(`Existing Secrets - NEXTAUTH_SECRET Preserved: ${secretPreserved ? 'PASS' : 'FAIL'}`);
    log(`Existing Secrets - ENCRYPTION_KEY Preserved: ${keyPreserved ? 'PASS' : 'FAIL'}`);
    
  } catch (error) {
    log(`Existing Secrets - Test Failed: ${error.message}`, 'ERROR');
  }
}

async function testEnvironmentVariables() {
  log('\n=== Testing Environment Variable Priority ===');
  
  // Remove .env.local file
  if (fs.existsSync(ENV_FILE_PATH)) {
    fs.unlinkSync(ENV_FILE_PATH);
  }
  
  const envSecret = 'c'.repeat(64);
  const envKey = 'd'.repeat(32);
  
  try {
    const result = execSync('node -e "require(\'./src/instrumentation.ts\').register()"', {
      encoding: 'utf-8',
      env: { 
        ...process.env, 
        NEXT_RUNTIME: 'nodejs',
        NEXTAUTH_SECRET: envSecret,
        ENCRYPTION_KEY: envKey
      }
    });
    
    // With environment variables set, no .env.local should be created
    const envFileExists = fs.existsSync(ENV_FILE_PATH);
    log(`Environment Variables - No .env.local Created: ${!envFileExists ? 'PASS' : 'FAIL'}`);
    
  } catch (error) {
    log(`Environment Variables - Test Failed: ${error.message}`, 'ERROR');
  }
}

async function testRandomnessAndUniqueness() {
  log('\n=== Testing Randomness and Uniqueness ===');
  
  const secrets = [];
  const keys = [];
  
  for (let i = 0; i < 3; i++) {
    if (fs.existsSync(ENV_FILE_PATH)) {
      fs.unlinkSync(ENV_FILE_PATH);
    }
    
    try {
      const result = execSync('node -e "require(\'./src/instrumentation.ts\').register()"', {
        encoding: 'utf-8',
        env: { ...process.env, NEXT_RUNTIME: 'nodejs' }
      });
      
      const envContent = readEnvFile();
      if (envContent.NEXTAUTH_SECRET && envContent.ENCRYPTION_KEY) {
        secrets.push(envContent.NEXTAUTH_SECRET);
        keys.push(envContent.ENCRYPTION_KEY);
      }
      
    } catch (error) {
      log(`Randomness Test ${i + 1} - Failed: ${error.message}`, 'ERROR');
    }
  }
  
  const uniqueSecrets = new Set(secrets).size === secrets.length;
  const uniqueKeys = new Set(keys).size === keys.length;
  
  log(`Randomness - NEXTAUTH_SECRET Uniqueness: ${uniqueSecrets ? 'PASS' : 'FAIL'} (${secrets.length} generated, ${new Set(secrets).size} unique)`);
  log(`Randomness - ENCRYPTION_KEY Uniqueness: ${uniqueKeys ? 'PASS' : 'FAIL'} (${keys.length} generated, ${new Set(keys).size} unique)`);
}

async function runTests() {
  log('Starting NEXTAUTH_SECRET auto-generation validation tests');
  
  backupExistingEnv();
  
  try {
    await testFreshInstallation();
    await testExistingSecrets();
    await testEnvironmentVariables();
    await testRandomnessAndUniqueness();
    
    log('\n=== Test Summary ===');
    log('Core functionality tests completed. Check output above for individual test results.');
    
  } catch (error) {
    log(`Test execution error: ${error.message}`, 'ERROR');
  } finally {
    restoreEnv();
    log('Test cleanup completed');
  }
}

runTests().catch(console.error);