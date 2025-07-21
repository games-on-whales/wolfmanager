import { validateUser } from "@/lib/config";
import { AuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types";
import { jwtDebugger } from "./debug/jwt-debug";
import { shouldUseSecureCookies } from "./auth/reverse-proxy-detection";

// Initialize logger
// Use the imported singleton logger instance directly

// DIAGNOSIS: Log when this module is loaded to verify initialization order.
// This should appear AFTER the instrumentation logs.
console.log(`[AUTH] auth.ts module loaded at ${new Date().toISOString()}`);
console.log(`[AUTH] NEXTAUTH_SECRET availability check: hasNextAuthSecret=${!!process.env.NEXTAUTH_SECRET}, length=${process.env.NEXTAUTH_SECRET?.length || 0}`);

// By the time this module is loaded, `instrumentation.ts` should have already
// run and set the necessary environment variables. We can now safely rely on
// `process.env.NEXTAUTH_SECRET`.

// Extend the built-in types
declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    role?: string;
    requiresFirstTimeSetup: boolean;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      role?: string;
    };
    requiresFirstTimeSetup: boolean;
    error?: "SessionExpired" | "MissingToken";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    requiresFirstTimeSetup: boolean;
    error?: "SessionExpired";
    exp?: number;
  }
}

export const authOptions: AuthOptions = {
  // Use default NextAuth cookie configuration to handle both secure and insecure cookies
  // This allows backward compatibility during transition
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            logger.warn(LogComponent.AUTH, "Missing credentials");
            return null;
          }

          const user = await validateUser(credentials.username, credentials.password);

          if (!user) {
            logger.warn(LogComponent.AUTH, "Invalid credentials", {
              username: credentials.username,
            });
            return null;
          }

          logger.info(LogComponent.AUTH, "User authorized successfully", {
            username: credentials.username,
          });

          return {
            id: user.id,
            name: user.username,
            role: user.is_admin ? "admin" : "user",
            requiresFirstTimeSetup: !user.has_changed_password,
          };
        } catch (error) {
          logger.error(LogComponent.AUTH, "Authorization error", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session, account }: any) {
      try {
        // Enhanced JWT debugging for reverse proxy issues
        if (user) {
          await jwtDebugger.logJWTGeneration({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            trigger,
          });
        } else if (token) {
          await jwtDebugger.logJWTValidation({
            hasToken: !!token,
            tokenKeys: Object.keys(token || {}),
            validationResult: token.error ? 'failed' : 'success',
            errorMessage: token.error,
          });
        }

        // Log NEXTAUTH_URL for remote access debugging
        logger.debug(LogComponent.AUTH, "DIAGNOSIS: JWT callback - NEXTAUTH_URL check", {
          nextauthUrl: process.env.NEXTAUTH_URL,
          nodeEnv: process.env.NODE_ENV,
          hasUser: !!user,
          hasTrigger: !!trigger,
          timestamp: new Date().toISOString(),
          nextauthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
        });

        // Add diagnostic logging for JWT decryption issues
        if (!user && !trigger && token) {
          logger.debug(LogComponent.AUTH, "DIAGNOSIS: Processing existing JWT token", {
            hasTokenId: !!token.id,
            hasTokenName: !!token.name,
            tokenKeys: Object.keys(token || {}),
            timestamp: new Date().toISOString(),
          });
        }

        // Handle session update
        if (trigger === "update" && session?.name) {
          token.name = session.name;
          return token;
        }

        // Handle new sign in
        if (user) {
          logger.info(LogComponent.AUTH, "Creating new JWT token", {
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            requiresFirstTimeSetup: user.requiresFirstTimeSetup,
          });

          const newToken = {
            ...token,
            id: user.id,
            name: user.name,
            role: user.role,
            requiresFirstTimeSetup: user.requiresFirstTimeSetup,
          };
          
          logger.info(LogComponent.AUTH, "JWT token created successfully", { 
            tokenId: newToken.id,
            tokenName: newToken.name,
            tokenRole: newToken.role,
            tokenRequiresSetup: newToken.requiresFirstTimeSetup
          });
          
          return newToken;
        }

        // For existing tokens, periodically re-check the user's first-time setup status
        // This ensures the token reflects current config state
        if (token.id && token.name) {
          try {
            const { getConfig } = await import("./config");
            const config = await getConfig();
            const currentUser = config.users[token.name];
            
            if (currentUser) {
              const currentRequiresSetup = !currentUser.has_changed_password;
              
              // Only update if the status has changed
              if (token.requiresFirstTimeSetup !== currentRequiresSetup) {
                logger.debug(LogComponent.AUTH, "Updating first-time setup status in token", {
                  userId: token.id,
                  oldStatus: token.requiresFirstTimeSetup,
                  newStatus: currentRequiresSetup,
                });
                
                return {
                  ...token,
                  requiresFirstTimeSetup: currentRequiresSetup,
                };
              }
            }
          } catch (error) {
            logger.error(LogComponent.AUTH, "Error checking user setup status", error);
          }
        }

        return token;
      } catch (error) {
        logger.error(LogComponent.AUTH, "JWT callback error", error);
        
        // Enhanced error logging for JWT issues
        await jwtDebugger.logUrlMismatch({
          requestUrl: 'jwt_callback',
          headers: {},
        });
        
        // If this is a JWT validation/decryption error, clear the token
        if (error instanceof Error && (error.message.includes("decryption") || error.message.includes("invalid"))) {
          logger.warn(LogComponent.AUTH, "JWT validation/decryption failed, clearing token", {
            errorMessage: error.message,
            hasUser: !!user,
            hasTrigger: !!trigger,
          });
          
          // Log the specific JWT validation failure
          await jwtDebugger.logJWTValidation({
            hasToken: !!token,
            tokenKeys: Object.keys(token || {}),
            validationResult: 'failed',
            errorMessage: error.message,
          });
          
          // Return a token with error flag to force re-authentication
          return {
            ...token, // Keep existing token properties if any
            error: "SessionExpired",
          };
        }
        
        // For other errors, return the original token to avoid logging out unnecessarily
        return token;
      }
    },
    async session({ session, token }: any) {
      try {
        if (!token) {
          logger.warn(
            LogComponent.AUTH,
            "Session validation failed - missing token",
            {
              timestamp: new Date().toISOString(),
            }
          );
          return {
            ...session,
            error: "MissingToken",
            expires: new Date(0).toISOString(),
          };
        }

        if (token.error) {
          logger.info(
            LogComponent.AUTH,
            "DIAGNOSIS: Session validation failed - forcing logout",
            {
              error: token.error,
              userId: token.id,
              userName: token.name,
              userRole: token.role,
              tokenExpiry: token.exp
                ? new Date(token.exp * 1000).toISOString()
                : undefined,
              timestamp: new Date().toISOString(),
            }
          );
          return {
            ...session,
            error: "SessionExpired",
            expires: new Date(0).toISOString(),
          };
        }

        logger.debug(LogComponent.AUTH, "DIAGNOSIS: Session validated successfully", {
          userId: token.id,
          userName: token.name,
          userRole: token.role,
          requiresFirstTimeSetup: token.requiresFirstTimeSetup,
          tokenExpiry: token.exp
            ? new Date(token.exp * 1000).toISOString()
            : undefined,
          timestamp: new Date().toISOString(),
        });

        return {
          ...session,
          user: {
            id: token.id,
            name: token.name,
            role: token.role,
          },
          requiresFirstTimeSetup: token.requiresFirstTimeSetup,
        };
      } catch (error) {
        logger.error(LogComponent.AUTH, "DIAGNOSIS: Session callback error", error, {
          timestamp: new Date().toISOString(),
          tokenId: token?.id,
          tokenName: token?.name,
        });
        return session;
      }
    },
    async signIn({ user, account, profile, email, credentials }: any) {
      try {
        logger.debug(LogComponent.AUTH, "SignIn callback triggered", {
          userId: user.id,
          provider: account?.provider,
        });
        return true;
      } catch (error) {
        logger.error(LogComponent.AUTH, "SignIn callback error", error);
        return true; // Don't block signin due to logging errors
      }
    },
    async redirect({ url, baseUrl }: any) {
      try {
        logger.debug(LogComponent.AUTH, "Redirect callback triggered", {
          url,
          baseUrl
        });
        
        // For first-time setup flow, we'll rely on the signIn callback to set the correct callback URL
        // and the middleware to enforce first-time setup requirements
        
        // If redirecting to root or dashboard, redirect to clients instead
        if (url === baseUrl || url === `${baseUrl}/` || url === `${baseUrl}/dashboard`) {
          logger.info(LogComponent.AUTH, "Redirecting post-login to clients page", {
            originalUrl: url,
            newUrl: `${baseUrl}/clients`,
            reason: "matched_root_or_dashboard"
          });
          return `${baseUrl}/clients`;
        }
        
        // If it's a relative URL, make it absolute with baseUrl
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }
        
        // If it's already a valid URL on the same origin, use it
        if (url.startsWith(baseUrl)) {
          return url;
        }
        
        // Default to clients page
        return `${baseUrl}/clients`;
      } catch (error) {
        logger.error(LogComponent.AUTH, "Redirect callback error", error);
        return `${baseUrl}/clients`; // Safe fallback
      }
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60, // Reduced to 4 hours for better security
    updateAge: 30 * 60, // Update every 30 minutes
  },
  // Add JWT configuration to handle decryption errors gracefully
  jwt: {
    // Custom encode/decode to handle secret changes and suppress NextAuth error logging
    async encode({ token, secret, maxAge }) {
      try {
        const { encode } = await import("next-auth/jwt");
        return await encode({ token, secret, maxAge });
      } catch (error) {
        logger.error(LogComponent.AUTH, "JWT encode error", error);
        throw error;
      }
    },
    async decode({ token, secret }) {
      try {
        const { decode } = await import("next-auth/jwt");
        
        // Temporarily suppress NextAuth.js console errors during decode
        const originalConsoleError = console.error;
        let suppressedError: any = null;
        
        console.error = (...args: any[]) => {
          // Check if this is a NextAuth JWT error we want to suppress
          const errorMessage = args.join(' ');
          if (
            errorMessage.includes('[next-auth][error][JWT_SESSION_ERROR]') ||
            errorMessage.includes('JWT invalid') ||
            errorMessage.includes('JWTDecryptionFailed') ||
            errorMessage.includes('JWTExpired')
          ) {
            // Store the error for our own logging but don't output to console
            suppressedError = args;
            return;
          }
          // Allow other console.error calls to proceed normally
          originalConsoleError.apply(console, args);
        };
        
        try {
          const result = await decode({ token, secret });
          return result;
        } finally {
          // Always restore original console.error
          console.error = originalConsoleError;
          
          // Log suppressed errors at debug level if they occurred
          if (suppressedError) {
            logger.debug(LogComponent.AUTH, "JWT decode validation failed - expected behavior", {
              suppressedError: suppressedError.join(' '),
              hasToken: !!token,
              secretLength: typeof secret === 'string' ? secret.length : 0,
              reason: "Invalid/expired token during unauthenticated access"
            });
          }
        }
      } catch (error) {
        // This is expected during configuration transitions (secure vs insecure cookies)
        // or after secret changes during fresh deployments
        logger.debug(LogComponent.AUTH, "JWT decode error - clearing invalid token", {
          errorMessage: error instanceof Error ? error.message : String(error),
          hasToken: !!token,
          secretLength: typeof secret === 'string' ? secret.length : 0,
          reason: "Configuration transition or invalid token format"
        });
        
        // Return null to force re-authentication instead of crashing
        return null;
      }
    },
  },
  events: {
    async signOut({ token }: any) {
      try {
        logger.debug(LogComponent.AUTH, "User signed out", {
          userId: token?.id,
        });
      } catch (error) {
        // Don't let logging errors prevent signout
        console.error("Failed to log signout event:", error);
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
