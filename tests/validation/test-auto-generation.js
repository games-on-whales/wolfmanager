#!/usr/bin/env node

/**
 * Comprehensive Test Suite for NEXTAUTH_SECRET Auto-Generation
 * Tests all scenarios mentioned in the validation requirements
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');

// Test configuration
const ENV_FILE_PATH = path.join(process.cwd(), '.env.local');
const BACKUP_ENV_PATH = path.join(process.cwd(), '.env.local.backup');
const TEST_RESULTS = [];

// Helper functions
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

function logResult(testName, passed, details = '') {
  const result = { testName, passed, details, timestamp: new Date().toISOString() };
  TEST_RESULTS.push(result);
  log(`${testName}: ${passed ? 'PASS' : 'FAIL'}${details ? ` - ${details}` : ''}`, passed ? 'PASS' : 'FAIL');
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
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
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

function testFreshInstallation() {
  log('\n=== Testing Fresh Installation Scenario ===');
  
  // Remove any existing env file
  if (fs.existsSync(ENV_FILE_PATH)) {
    fs.unlinkSync(ENV_FILE_PATH);
  }
  
  // Clear environment variables
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.ENCRYPTION_KEY;
  
  try {
    // Import and run the ensureSecureKeys function
    delete require.cache[require.resolve('./src/lib/env.ts')];
    const { ensureSecureKeys } = require('./src/lib/env.ts');
    
    ensureSecureKeys();
    
    // Check that environment variables are set
    const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
    const hasEncryptionKey = !!process.env.ENCRYPTION_KEY;
    
    logResult('Fresh Install - Environment Variables Set', hasNextAuthSecret && hasEncryptionKey);
    
    // Validate NEXTAUTH_SECRET format (should be 64 hex characters)
    const validNextAuthSecret = isValidHex(process.env.NEXTAUTH_SECRET, 64);
    logResult('Fresh Install - NEXTAUTH_SECRET Format', validNextAuthSecret, 
      `Length: ${process.env.NEXTAUTH_SECRET?.length}, Valid hex: ${validNextAuthSecret}`);
    
    // Validate ENCRYPTION_KEY format (should be 32 hex characters)
    const validEncryptionKey = isValidHex(process.env.ENCRYPTION_KEY, 32);
    logResult('Fresh Install - ENCRYPTION_KEY Format', validEncryptionKey,
      `Length: ${process.env.ENCRYPTION_KEY?.length}, Valid hex: ${validEncryptionKey}`);
    
    // Check that .env.local file was created
    const envFileExists = fs.existsSync(ENV_FILE_PATH);
    logResult('Fresh Install - .env.local File Created', envFileExists);
    
    if (envFileExists) {
      const envContent = readEnvFile();
      const fileHasSecrets = envContent.NEXTAUTH_SECRET && envContent.ENCRYPTION_KEY;
      logResult('Fresh Install - Secrets Saved to File', fileHasSecrets);
      
      // Verify file content matches environment variables
      const secretsMatch = envContent.NEXTAUTH_SECRET === process.env.NEXTAUTH_SECRET &&
                          envContent.ENCRYPTION_KEY === process.env.ENCRYPTION_KEY;
      logResult('Fresh Install - File Content Matches Environment', secretsMatch);
    }
    
  } catch (error) {
    logResult('Fresh Install - Function Execution', false, error.message);
  }
}

function testExistingEnvironmentVariables() {
  log('\n=== Testing Existing Environment Variables Scenario ===');
  
  // Remove env file to ensure we're testing environment variables only
  if (fs.existsSync(ENV_FILE_PATH)) {
    fs.unlinkSync(ENV_FILE_PATH);
  }
  
  // Set existing environment variables
  const existingSecret = 'existing-nextauth-secret-64-chars-' + crypto.randomBytes(16).toString('hex');
  const existingKey = crypto.randomBytes(16).toString('hex'); // 32 chars
  
  process.env.NEXTAUTH_SECRET = existingSecret;
  process.env.ENCRYPTION_KEY = existingKey;
  
  try {
    delete require.cache[require.resolve('./src/lib/env.ts')];
    const { ensureSecureKeys } = require('./src/lib/env.ts');
    
    ensureSecureKeys();
    
    // Verify existing secrets are preserved
    const secretPreserved = process.env.NEXTAUTH_SECRET === existingSecret;
    const keyPreserved = process.env.ENCRYPTION_KEY === existingKey;
    
    logResult('Existing Env - NEXTAUTH_SECRET Preserved', secretPreserved);
    logResult('Existing Env - ENCRYPTION_KEY Preserved', keyPreserved);
    
    // Verify no .env.local file was created when env vars exist
    const envFileExists = fs.existsSync(ENV_FILE_PATH);
    logResult('Existing Env - No .env.local Created When Env Vars Exist', !envFileExists);
    
  } catch (error) {
    logResult('Existing Env - Function Execution', false, error.message);
  }
}

function testPartialEnvironmentVariables() {
  log('\n=== Testing Partial Environment Variables Scenario ===');
  
  // Remove env file
  if (fs.existsSync(ENV_FILE_PATH)) {
    fs.unlinkSync(ENV_FILE_PATH);
  }
  
  // Set only NEXTAUTH_SECRET, leave ENCRYPTION_KEY undefined
  const existingSecret = 'existing-nextauth-secret-64-chars-' + crypto.randomBytes(16).toString('hex');
  process.env.NEXTAUTH_SECRET = existingSecret;
  delete process.env.ENCRYPTION_KEY;
  
  try {
    delete require.cache[require.resolve('./src/lib/env.ts')];
    const { ensureSecureKeys } = require('./src/lib/env.ts');
    
    ensureSecureKeys();
    
    // Verify existing secret is preserved
    const secretPreserved = process.env.NEXTAUTH_SECRET === existingSecret;
    logResult('Partial Env - Existing NEXTAUTH_SECRET Preserved', secretPreserved);
    
    // Verify ENCRYPTION_KEY was generated
    const keyGenerated = !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY !== existingSecret;
    const keyValid = isValidHex(process.env.ENCRYPTION_KEY, 32);
    logResult('Partial Env - ENCRYPTION_KEY Generated', keyGenerated && keyValid);
    
  } catch (error) {
    logResult('Partial Env - Function Execution', false, error.message);
  }
}

function testErrorHandling() {
  log('\n=== Testing Error Handling Scenarios ===');
  
  // Test with read-only directory (simulate container restrictions)
  const readOnlyTest = () => {
    try {
      // Create a temporary directory structure to test permissions
      const testDir = path.join(process.cwd(), 'temp-test-readonly');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      // Change to test directory and try to make it read-only
      const originalCwd = process.cwd();
      process.chdir(testDir);
      
      // Clear environment variables
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.ENCRYPTION_KEY;
      
      try {
        // Try to make directory read-only (this might not work on all systems)
        fs.chmodSync('.', 0o444);
        
        delete require.cache[require.resolve('../src/lib/env.ts')];
        const { ensureSecureKeys } = require('../src/lib/env.ts');
        
        ensureSecureKeys();
        
        // Even if file writing fails, environment variables should be set
        const hasSecrets = !!process.env.NEXTAUTH_SECRET && !!process.env.ENCRYPTION_KEY;
        logResult('Error Handling - Graceful Fallback to Environment Variables', hasSecrets);
        
      } catch (error) {
        // This is expected in read-only scenarios
        const hasSecrets = !!process.env.NEXTAUTH_SECRET && !!process.env.ENCRYPTION_KEY;
        logResult('Error Handling - Function Continues Despite File Write Errors', hasSecrets);
      } finally {
        // Restore permissions and cleanup
        try {
          fs.chmodSync('.', 0o755);
        } catch (e) {
          // Ignore permission restoration errors
        }
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      
    } catch (error) {
      logResult('Error Handling - Test Setup', false, error.message);
    }
  };
  
  readOnlyTest();
}

function testRandomnessAndSecurity() {
  log('\n=== Testing Randomness and Security ===');
  
  const secrets = [];
  const keys = [];
  
  // Generate multiple secrets to test randomness
  for (let i = 0; i < 5; i++) {
    // Clear environment and file
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.ENCRYPTION_KEY;
    if (fs.existsSync(ENV_FILE_PATH)) {
      fs.unlinkSync(ENV_FILE_PATH);
    }
    
    try {
      delete require.cache[require.resolve('./src/lib/env.ts')];
      const { ensureSecureKeys } = require('./src/lib/env.ts');
      ensureSecureKeys();
      
      secrets.push(process.env.NEXTAUTH_SECRET);
      keys.push(process.env.ENCRYPTION_KEY);
    } catch (error) {
      logResult('Security - Generation Attempt ' + (i + 1), false, error.message);
    }
  }
  
  // Test uniqueness
  const uniqueSecrets = new Set(secrets).size === secrets.length;
  const uniqueKeys = new Set(keys).size === keys.length;
  
  logResult('Security - NEXTAUTH_SECRET Uniqueness', uniqueSecrets, 
    `Generated ${secrets.length} unique secrets out of ${secrets.length} attempts`);
  logResult('Security - ENCRYPTION_KEY Uniqueness', uniqueKeys,
    `Generated ${keys.length} unique keys out of ${keys.length} attempts`);
  
  // Test entropy (simple check for distribution)
  if (secrets.length > 0) {
    const firstSecret = secrets[0];
    const hasVariedChars = /[0-9]/.test(firstSecret) && /[a-f]/.test(firstSecret);
    logResult('Security - Character Distribution', hasVariedChars,
      'Secrets contain both numbers and letters');
  }
}

function testLoggingAndDebugging() {
  log('\n=== Testing Logging and Debugging ===');
  
  // Capture console output
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => {
    logs.push(args.join(' '));
    originalLog(...args);
  };
  
  try {
    // Clear environment
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.ENCRYPTION_KEY;
    if (fs.existsSync(ENV_FILE_PATH)) {
      fs.unlinkSync(ENV_FILE_PATH);
    }
    
    delete require.cache[require.resolve('./src/lib/env.ts')];
    const { ensureSecureKeys } = require('./src/lib/env.ts');
    ensureSecureKeys();
    
    console.log = originalLog;
    
    // Check for appropriate log messages
    const hasStartupLog = logs.some(log => log.includes('[ENV] Checking and ensuring secure keys'));
    const hasGenerationLog = logs.some(log => log.includes('[ENV] Auto-generated secure keys'));
    const hasCompletionLog = logs.some(log => log.includes('[ENV] Secure environment setup completed'));
    
    logResult('Logging - Startup Message', hasStartupLog);
    logResult('Logging - Generation Message', hasGenerationLog);
    logResult('Logging - Completion Message', hasCompletionLog);
    
    // Verify no secrets are logged
    const secretsInLogs = logs.some(log => 
      (process.env.NEXTAUTH_SECRET && log.includes(process.env.NEXTAUTH_SECRET)) ||
      (process.env.ENCRYPTION_KEY && log.includes(process.env.ENCRYPTION_KEY))
    );
    
    logResult('Logging - No Secrets in Logs', !secretsInLogs);
    
  } catch (error) {
    console.log = originalLog;
    logResult('Logging - Test Execution', false, error.message);
  }
}

async function testDockerBuild() {
  log('\n=== Testing Docker Build Process ===');
  
  return new Promise((resolve) => {
    // Check if Docker is available
    exec('docker --version', (error) => {
      if (error) {
        logResult('Docker - Docker Not Available', false, 'Docker not installed or not accessible');
        resolve();
        return;
      }
      
      // Test Docker build (dry run to check Dockerfile syntax)
      const buildProcess = spawn('docker', ['build', '--dry-run', '-f', 'build/Dockerfile', '.'], {
        stdio: 'pipe'
      });
      
      let output = '';
      let errorOutput = '';
      
      buildProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      buildProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      buildProcess.on('close', (code) => {
        const buildSuccessful = code === 0;
        logResult('Docker - Dockerfile Syntax Valid', buildSuccessful, 
          buildSuccessful ? 'Build configuration valid' : errorOutput.slice(0, 200));
        
        // Check for auto-generation environment variables in Dockerfile
        fs.readFile('build/Dockerfile', 'utf-8', (err, dockerfileContent) => {
          if (!err) {
            const hasBuildTimeSecrets = dockerfileContent.includes('NEXTAUTH_SECRET=') && 
                                       dockerfileContent.includes('ENCRYPTION_KEY=');
            logResult('Docker - Build-time Secrets Present', hasBuildTimeSecrets);
            
            const hasRuntimeGeneration = dockerfileContent.includes('will-be-regenerated') ||
                                        dockerfileContent.includes('regenerated');
            logResult('Docker - Runtime Regeneration Comments', hasRuntimeGeneration);
          }
        });
        
        resolve();
      });
    });
  });
}

function printTestSummary() {
  log('\n=== TEST SUMMARY ===');
  
  const totalTests = TEST_RESULTS.length;
  const passedTests = TEST_RESULTS.filter(result => result.passed).length;
  const failedTests = totalTests - passedTests;
  
  log(`Total Tests: ${totalTests}`);
  log(`Passed: ${passedTests}`, 'PASS');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'FAIL' : 'PASS');
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    log('\nFAILED TESTS:');
    TEST_RESULTS
      .filter(result => !result.passed)
      .forEach(result => {
        log(`- ${result.testName}: ${result.details}`, 'FAIL');
      });
  }
  
  // Write detailed results to file
  const detailedResults = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%'
    },
    tests: TEST_RESULTS
  };
  
  fs.writeFileSync('test-results.json', JSON.stringify(detailedResults, null, 2));
  log('\nDetailed results saved to test-results.json');
}

// Main test execution
async function runAllTests() {
  log('Starting comprehensive NEXTAUTH_SECRET auto-generation validation tests');
  
  // Backup existing environment
  backupExistingEnv();
  
  try {
    // Run all test scenarios
    testFreshInstallation();
    testExistingEnvironmentVariables();
    testPartialEnvironmentVariables();
    testErrorHandling();
    testRandomnessAndSecurity();
    testLoggingAndDebugging();
    await testDockerBuild();
    
    // Print summary
    printTestSummary();
    
  } catch (error) {
    log(`Test execution error: ${error.message}`, 'ERROR');
  } finally {
    // Restore original environment
    restoreEnv();
    log('Test cleanup completed');
  }
}

// Execute tests
runAllTests().catch(console.error);