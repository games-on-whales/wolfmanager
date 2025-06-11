/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically called by Next.js when the server starts.
 * It's the proper place for server-side initialization in App Router.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and run startup initialization using singleton pattern
    const { getInitializationPromise } = await import('./lib/startup');
    await getInitializationPromise();
  }
}