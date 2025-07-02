export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const { WolfEventService } = await import('./src/lib/services/wolf-event.service');
            const { logger, LogComponent } = await import('./src/lib/logger');
            
            logger.info(LogComponent.WOLF_EVENTS, 'Initializing WolfEventService during application startup');
            
            const wolfEventService = WolfEventService.getInstance();
            
            // Wait for the service to initialize with a reasonable timeout
            const initTimeout = 10000; // 10 seconds
            const checkInterval = 100; // Check every 100ms
            let elapsed = 0;
            
            while (!wolfEventService.getIsInitialized() && elapsed < initTimeout) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                elapsed += checkInterval;
            }
            
            if (wolfEventService.getIsInitialized()) {
                logger.info(LogComponent.WOLF_EVENTS, 'WolfEventService successfully initialized and connected');
            } else {
                logger.warn(LogComponent.WOLF_EVENTS, 'WolfEventService initialization timed out, but service will continue trying to connect in background');
            }
            
        } catch (error) {
            // Import logger here in case the main import failed
            try {
                const { logger, LogComponent } = await import('./src/lib/logger');
                logger.error(LogComponent.WOLF_EVENTS, 'Failed to initialize WolfEventService during startup', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
            } catch (loggerError) {
                // Fallback to console if logger initialization also fails
                console.error('WolfEventService initialization failed:', error);
                console.error('Logger initialization also failed:', loggerError);
            }
            
            // Don't throw here as we don't want to crash the entire application
            // The service will remain uninitialized but the app can still function
        }
    }
}