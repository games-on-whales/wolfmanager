/**
 * Centralized URL resolution utility for handling both internal and external URL contexts
 * Prioritizes NEXTAUTH_URL for external-facing URLs and provides appropriate fallbacks
 */

/**
 * Get the base URL for external-facing requests (like authentication callbacks)
 * Uses NEXTAUTH_URL as primary source, falls back to NEXT_PUBLIC_APP_URL, then localhost in development
 */
export function getExternalBaseUrl(): string {
  // Priority 1: NEXTAUTH_URL (used for authentication and external URLs)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // Priority 2: NEXT_PUBLIC_APP_URL (client-side accessible)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Priority 3: Development fallback
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // Production fallback - should not happen in properly configured environments
  throw new Error('No base URL configured. Please set NEXTAUTH_URL or NEXT_PUBLIC_APP_URL environment variable.');
}

/**
 * Get the base URL for internal server-side requests within the same container/process
 * Uses NEXTAUTH_URL as primary source, but falls back to localhost for container communication
 */
export function getInternalBaseUrl(): string {
  // Priority 1: NEXTAUTH_URL (for consistency)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // Priority 2: Internal container communication fallback
  return 'http://localhost:3000';
}

/**
 * Create an absolute URL for external-facing requests (like authentication callbacks)
 * @param path - The path to append to the base URL
 * @returns Complete absolute URL
 */
export function getExternalUrl(path: string): string {
  const baseUrl = getExternalBaseUrl();
  return `${baseUrl}${path}`;
}

/**
 * Create an absolute URL for internal server-side requests
 * @param path - The path to append to the base URL
 * @returns Complete absolute URL
 */
export function getInternalUrl(path: string): string {
  const baseUrl = getInternalBaseUrl();
  return `${baseUrl}${path}`;
}

/**
 * Determine if we're running in a development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}