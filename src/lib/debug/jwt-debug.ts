import { logger } from "../logger";
import { LogComponent } from "../logger/types";

/**
 * Enhanced JWT debugging utility to track URL context mismatches
 * in NextAuth reverse proxy configurations
 */
export class JWTDebugger {
  private static instance: JWTDebugger;
  
  static getInstance(): JWTDebugger {
    if (!JWTDebugger.instance) {
      JWTDebugger.instance = new JWTDebugger();
    }
    return JWTDebugger.instance;
  }

  /**
   * Log comprehensive JWT generation context
   */
  async logJWTGeneration(context: {
    userId: string;
    userName: string;
    userRole?: string;
    trigger?: string;
    requestUrl?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    const debugData = {
      ...context,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextauthUrl: process.env.NEXTAUTH_URL,
        nextauthSecret: process.env.NEXTAUTH_SECRET ? `${process.env.NEXTAUTH_SECRET.substring(0, 8)}...` : 'NOT_SET',
        nextauthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
        dockerContainer: process.env.DOCKER_CONTAINER,
        insecureCookies: process.env.INSECURE_COOKIES_IN_PRODUCTION,
      },
      urlContext: {
        processedNextauthUrl: this.getProcessedNextAuthUrl(),
        externalBaseUrl: this.getExternalBaseUrl(),
        internalBaseUrl: this.getInternalBaseUrl(),
        isProduction: process.env.NODE_ENV === 'production',
        isContainer: process.env.DOCKER_CONTAINER === 'true',
      },
      cookieSettings: {
        sessionTokenName: this.getSessionTokenName(),
        cookieSecure: this.getCookieSecure(),
        cookieSameSite: 'lax',
        cookiePath: '/',
      }
    };

    await logger.info(LogComponent.AUTH, "JWT_DEBUG: Token generation context", debugData);
  }

  /**
   * Log JWT validation context
   */
  async logJWTValidation(context: {
    hasToken: boolean;
    tokenKeys?: string[];
    validationResult?: 'success' | 'failed' | 'expired';
    errorMessage?: string;
    requestUrl?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    const debugData = {
      ...context,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextauthUrl: process.env.NEXTAUTH_URL,
        nextauthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
      },
      urlContext: {
        processedNextauthUrl: this.getProcessedNextAuthUrl(),
        externalBaseUrl: this.getExternalBaseUrl(),
        internalBaseUrl: this.getInternalBaseUrl(),
        urlMismatch: this.detectUrlMismatch(),
      },
      cookieContext: {
        sessionTokenName: this.getSessionTokenName(),
        expectedCookieNames: this.getExpectedCookieNames(),
      }
    };

    await logger.info(LogComponent.AUTH, "JWT_DEBUG: Token validation context", debugData);
  }

  /**
   * Log URL context mismatch detection
   */
  async logUrlMismatch(context: {
    generationUrl?: string;
    validationUrl?: string;
    requestUrl?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    const debugData = {
      ...context,
      timestamp: new Date().toISOString(),
      mismatchAnalysis: {
        nextauthUrlSet: !!process.env.NEXTAUTH_URL,
        nextauthUrlValue: process.env.NEXTAUTH_URL,
        nextPublicAppUrlSet: !!process.env.NEXT_PUBLIC_APP_URL,
        nextPublicAppUrlValue: process.env.NEXT_PUBLIC_APP_URL,
        detectedMismatch: this.detectUrlMismatch(),
        possibleCauses: this.getPossibleMismatchCauses(),
      },
      reverseProxyAnalysis: {
        xForwardedProto: context.headers?.['x-forwarded-proto'],
        xForwardedHost: context.headers?.['x-forwarded-host'],
        xForwardedFor: context.headers?.['x-forwarded-for'],
        host: context.headers?.['host'],
        origin: context.headers?.['origin'],
        referer: context.headers?.['referer'],
      }
    };

    await logger.error(LogComponent.AUTH, "JWT_DEBUG: URL context mismatch detected", debugData);
  }

  /**
   * Get processed NEXTAUTH_URL value
   */
  private getProcessedNextAuthUrl(): string {
    return process.env.NEXTAUTH_URL || 'NOT_SET';
  }

  /**
   * Get external base URL using the same logic as url-resolver
   */
  private getExternalBaseUrl(): string {
    try {
      const { getExternalBaseUrl } = require('../url-resolver');
      return getExternalBaseUrl();
    } catch (error) {
      return `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get internal base URL using the same logic as url-resolver
   */
  private getInternalBaseUrl(): string {
    try {
      const { getInternalBaseUrl } = require('../url-resolver');
      return getInternalBaseUrl();
    } catch (error) {
      return `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Detect URL context mismatch
   */
  private detectUrlMismatch(): boolean {
    const external = this.getExternalBaseUrl();
    const internal = this.getInternalBaseUrl();
    
    // Check if both are valid URLs and different
    if (external.startsWith('ERROR:') || internal.startsWith('ERROR:')) {
      return true;
    }
    
    return external !== internal;
  }

  /**
   * Get possible causes of URL mismatch
   */
  private getPossibleMismatchCauses(): string[] {
    const causes: string[] = [];
    
    if (!process.env.NEXTAUTH_URL) {
      causes.push('NEXTAUTH_URL not set');
    }
    
    if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) {
      causes.push('Production environment without NEXTAUTH_URL');
    }
    
    if (process.env.DOCKER_CONTAINER === 'true' && !process.env.NEXTAUTH_URL) {
      causes.push('Docker container without NEXTAUTH_URL');
    }
    
    if (this.getExternalBaseUrl().includes('localhost') && process.env.NODE_ENV === 'production') {
      causes.push('Localhost fallback in production');
    }
    
    return causes;
  }

  /**
   * Get session token name based on environment
   */
  private getSessionTokenName(): string {
    const isProduction = process.env.NODE_ENV === 'production';
    const insecureCookies = process.env.INSECURE_COOKIES_IN_PRODUCTION === 'true';
    
    if (isProduction && !insecureCookies) {
      return '__Secure-next-auth.session-token';
    }
    return 'next-auth.session-token';
  }

  /**
   * Get expected cookie names
   */
  private getExpectedCookieNames(): string[] {
    return [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      '__Secure-next-auth.csrf-token',
    ];
  }

  /**
   * Get cookie secure setting
   */
  private getCookieSecure(): boolean {
    return process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES_IN_PRODUCTION !== 'true';
  }
}

// Export singleton instance
export const jwtDebugger = JWTDebugger.getInstance();