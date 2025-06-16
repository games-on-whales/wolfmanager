/**
 * Application startup initialization
 * 
 * This module handles server-side initialization that should run
 * when the Node.js process starts, not when React components render.
 */

import { logger } from './logger';
import { LogComponent } from './logger/types';
import { initializeDatabaseWithMigration } from './db/initializer';
import { startScheduler } from './scheduler';

/**
 * Initialize the application on server startup
 */
export async function initializeApplication(): Promise<void> {
  try {
    logger.info(LogComponent.SYSTEM, "WolfUI application starting");
    
    // Initialize database first
    await initializeDatabaseWithMigration();
    logger.info(LogComponent.SYSTEM, "Database initialized successfully");
    
    // Start the scheduler service after database is ready
    logger.info(LogComponent.SYSTEM, "Starting task scheduler");
    await startScheduler();
    logger.info(LogComponent.SYSTEM, "Task scheduler started successfully");
    
    logger.info(LogComponent.SYSTEM, "WolfUI application startup completed");
  } catch (error) {
    logger.error(LogComponent.WOLF_SERVER, "Failed to initialize application", error as Error);
    throw error;
  }
}

// Global initialization tracker to prevent duplicate runs
let globalInitializationPromise: Promise<void> | null = null;

/**
 * Get or create the initialization promise to ensure single execution
 */
export function getInitializationPromise(): Promise<void> {
  if (!globalInitializationPromise) {
    globalInitializationPromise = initializeApplication();
  }
  return globalInitializationPromise;
}

// Note: Auto-initialization removed to prevent duplicate execution
// Initialization is now only triggered via instrumentation hook