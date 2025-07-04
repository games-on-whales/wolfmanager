/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically called by Next.js when the server starts.
 * It's the proper place for server-side initialization in App Router.
 *
 * Optimized for Docker-level secret generation with local development fallback.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log("[INSTRUMENTATION] DIAGNOSIS: register() called at", new Date().toISOString());
    console.log("[INSTRUMENTATION] DIAGNOSIS: Environment before ensureSecureKeys", {
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      nextauthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
      isDockerContainer: process.env.DOCKER_CONTAINER === 'true',
      hasDockerEnvFile: require('fs').existsSync('/.dockerenv'),
    });
    
    try {
      // Ensure secure keys are validated/generated before any other initialization
      // In container environments: validates pre-generated secrets
      // In local development: generates secrets if needed
      // This MUST happen before any NextAuth imports or configuration evaluation
      const { ensureSecureKeys } = await import('./lib/env');
      ensureSecureKeys();
      
      console.log("[INSTRUMENTATION] DIAGNOSIS: Environment after ensureSecureKeys", {
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextauthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
        hasInternalToken: !!process.env.INTERNAL_SERVICE_TOKEN,
        internalTokenLength: process.env.INTERNAL_SERVICE_TOKEN?.length || 0,
        hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
        encryptionKeyLength: process.env.ENCRYPTION_KEY?.length || 0,
      });
      
      // Skip validation during Next.js build phase
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        console.log('Skipping secret validation during build phase');
        return;
      }

      // Validate that secrets are properly set with correct lengths (only during runtime)
      if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length !== 128) {
        throw new Error("NEXTAUTH_SECRET not properly initialized (expected 128 hex chars)");
      }
      if (!process.env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_TOKEN.length !== 128) {
        throw new Error("INTERNAL_SERVICE_TOKEN not properly initialized (expected 128 hex chars)");
      }
      if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
        throw new Error("ENCRYPTION_KEY not properly initialized (expected 64 hex chars)");
      }
      
      // Import and run startup initialization using singleton pattern
      const { getInitializationPromise } = await import('./lib/startup');
      await getInitializationPromise();
      
      console.log("[INSTRUMENTATION] DIAGNOSIS: Initialization completed successfully at", new Date().toISOString());
      
    } catch (error) {
      console.error("[INSTRUMENTATION] CRITICAL: Initialization failed", error);
      
      // Provide helpful error context based on the error type
      if (error instanceof Error) {
        if (error.message.includes('pre-generated secrets')) {
          console.error("[INSTRUMENTATION] 💡 Hint: Docker secret generation may not be working properly");
          console.error("[INSTRUMENTATION] 💡 Check build/docker-entrypoint.sh and secret generation scripts");
        } else if (error.message.includes('not properly initialized')) {
          console.error("[INSTRUMENTATION] 💡 Hint: Secret validation failed - check secret format and length");
          console.error("[INSTRUMENTATION] 💡 Expected: NEXTAUTH_SECRET (128 hex), INTERNAL_SERVICE_TOKEN (128 hex), ENCRYPTION_KEY (64 hex)");
        }
      }
      
      // Don't throw here as it would crash the entire application
      // The auth system will handle missing secrets gracefully
    }
  }
}