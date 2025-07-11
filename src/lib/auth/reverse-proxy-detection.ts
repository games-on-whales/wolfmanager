import { logger } from "../logger";
import { LogComponent } from "../logger/types";

/**
 * Detects if the application is running behind a reverse proxy
 * by checking for common reverse proxy headers and environment variables
 */
export function detectReverseProxy(headers?: Record<string, string>): boolean {
  // Check for common reverse proxy headers in both env vars and request headers
  const envProxyIndicators = [
    // Explicit proxy configuration
    'TRUST_PROXY',
    'PROXY_MODE',
    'BEHIND_PROXY'
  ];

  const requestProxyHeaders = [
    // Standard forwarded headers (in request headers)
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-port',
    'x-real-ip',
    'x-forwarded-ssl',
    
    // Cloudflare headers
    'cf-connecting-ip',
    'cf-ipcountry',
    
    // AWS Load Balancer
    'x-amzn-trace-id',
    
    // Other common reverse proxy headers
    'x-original-forwarded-for',
    'x-forwarded-protocol',
    'forwarded',
  ];

  // Check environment variables for explicit proxy configuration
  const hasProxyEnvVars = envProxyIndicators.some(header =>
    process.env[header] !== undefined
  );

  // Check request headers for reverse proxy indicators
  const hasProxyHeaders = headers ? requestProxyHeaders.some(header =>
    headers[header] !== undefined
  ) : false;

  // Check for container environments (likely to use reverse proxy)
  const isContainer = !!(
    process.env.DOCKER_CONTAINER === 'true' ||
    process.env.KUBERNETES_SERVICE_HOST ||
    existsSync('/.dockerenv')
  );

  // Check if NEXTAUTH_URL differs from default localhost (indicates external access)
  const nextauthUrl = process.env.NEXTAUTH_URL;
  const hasExternalUrl = !!(nextauthUrl &&
    !nextauthUrl.includes('localhost') &&
    !nextauthUrl.includes('127.0.0.1') &&
    !nextauthUrl.includes('0.0.0.0'));

  const isReverseProxy = hasProxyEnvVars || hasProxyHeaders || (isContainer && hasExternalUrl);

  logger.debug(LogComponent.AUTH, "Reverse proxy detection", {
    hasProxyEnvVars,
    hasProxyHeaders,
    isContainer,
    hasExternalUrl,
    nextauthUrl,
    isReverseProxy,
    detectedEnvVars: envProxyIndicators.filter((header: string) => process.env[header]),
    detectedHeaders: headers ? requestProxyHeaders.filter((header: string) => headers[header]) : [],
  });

  return isReverseProxy;
}

/**
 * Determines if secure cookies should be used based on environment and reverse proxy detection
 */
export function shouldUseSecureCookies(headers?: Record<string, string>): boolean {
  // Always use insecure cookies in development
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  // Explicit override takes precedence (only if explicitly set to 'true')
  if (process.env.INSECURE_COOKIES_IN_PRODUCTION === 'true') {
    return false;
  }

  // If explicitly set to 'false', still allow auto-detection for reverse proxy
  // Only skip auto-detection if set to 'force-secure' (new override)
  if (process.env.INSECURE_COOKIES_IN_PRODUCTION === 'force-secure') {
    return true;
  }

  // Auto-detect reverse proxy and use insecure cookies if detected
  const isReverseProxy = detectReverseProxy(headers);
  const useSecureCookies = !isReverseProxy;
  
  logger.debug(LogComponent.AUTH, "Cookie security configuration", {
    nodeEnv: process.env.NODE_ENV,
    explicitOverride: process.env.INSECURE_COOKIES_IN_PRODUCTION,
    isReverseProxy,
    useSecureCookies,
  });

  return useSecureCookies;
}

/**
 * Helper function to check if a file exists (for container detection)
 */
function existsSync(path: string): boolean {
  try {
    return require('fs').existsSync(path);
  } catch {
    return false;
  }
}