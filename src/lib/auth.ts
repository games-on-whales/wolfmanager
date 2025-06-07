import { validateUser } from "@/lib/config";
import { AuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types";

// Initialize logger
// Use the imported singleton logger instance directly

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("Please provide process.env.NEXTAUTH_SECRET");
}

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
    error?: "SessionExpired";
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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
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

          const user = validateUser(credentials.username, credentials.password);

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
    async jwt({ token, user, trigger, session }) {
      try {
        // Handle session update
        if (trigger === "update" && session?.name) {
          token.name = session.name;
          return token;
        }

        // Handle new sign in
        if (user) {
          logger.debug(LogComponent.AUTH, "Creating new JWT token", {
            userId: user.id,
          });

          return {
            ...token,
            id: user.id,
            name: user.name,
            role: user.role,
            requiresFirstTimeSetup: user.requiresFirstTimeSetup,
          };
        }

        return token;
      } catch (error) {
        logger.error(LogComponent.AUTH, "JWT callback error", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token.error) {
          logger.info(
            LogComponent.AUTH,
            "Session validation failed - forcing logout",
            {
              error: token.error,
              userId: token.id,
              tokenExpiry: token.exp
                ? new Date(token.exp * 1000).toISOString()
                : undefined,
            }
          );
          return {
            ...session,
            error: "SessionExpired",
            expires: new Date(0).toISOString(),
          };
        }

        logger.debug(LogComponent.AUTH, "Session validated successfully", {
          userId: token.id,
          tokenExpiry: token.exp
            ? new Date(token.exp * 1000).toISOString()
            : undefined,
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
        logger.error(LogComponent.AUTH, "Session callback error", error);
        return session;
      }
    },
    async signIn({ user, account, profile, email, credentials }) {
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
    async redirect({ url, baseUrl }) {
      try {
        logger.info(LogComponent.AUTH, "Redirect callback triggered", {
          url,
          baseUrl,
          urlType: typeof url,
          baseUrlType: typeof baseUrl,
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
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 1 * 60 * 60, // 1 hour
  },
  events: {
    async signOut({ token }) {
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
