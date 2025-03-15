import { validateUser } from "@/lib/config";
import { AuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { Logger } from "./logger/logger";

// Initialize logger
const logger = Logger.getInstance();

// Add a Map to store active sessions with a timestamp
const activeSessions = new Map<string, { timestamp: number }>();

// Clear all sessions on server start
const SERVER_START_TIME = Date.now();

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
    sessionId?: string;
    serverStartTime?: number;
    error?: "SessionExpired";
  }
}

export const authOptions: AuthOptions = {
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
            logger.debug("auth", "Missing credentials");
            return null;
          }

          const user = validateUser(credentials.username, credentials.password);

          if (user) {
            const requiresFirstTimeSetup = user.has_changed_password === false;
            logger.debug("auth", "User authenticated successfully", {
              username: credentials.username,
            });
            return {
              id: user.id,
              name: user.username,
              role: user.is_admin ? "admin" : "user",
              requiresFirstTimeSetup,
            };
          }
          logger.warn("auth", "Invalid credentials", {
            username: credentials.username,
          });
          return null;
        } catch (error) {
          logger.error("auth", "Authentication error", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Handle session update
      if (trigger === "update" && session?.name) {
        token.name = session.name;
        return token;
      }

      // Handle new sign in
      if (user) {
        const sessionId = crypto.randomUUID();
        activeSessions.set(sessionId, { timestamp: Date.now() });
        logger.debug("auth", "New session created", {
          userId: user.id,
          sessionId,
        });

        return {
          ...token,
          id: user.id,
          name: user.name,
          role: user.role,
          requiresFirstTimeSetup: user.requiresFirstTimeSetup,
          sessionId,
          serverStartTime: SERVER_START_TIME,
        };
      }

      // Check if the token is from a previous server instance
      if (token.serverStartTime !== SERVER_START_TIME) {
        logger.info(
          "auth",
          "Token from previous server instance - forcing logout",
          {
            userId: token.id,
            sessionId: token.sessionId,
          }
        );
        return {
          error: "SessionExpired",
          name: token.name,
          exp: 0,
          id: token.id || "expired",
          requiresFirstTimeSetup: false,
        } as JWT;
      }

      // Handle existing session
      if (!token.sessionId || !activeSessions.has(token.sessionId)) {
        logger.info("auth", "Invalid or expired session - forcing logout", {
          userId: token.id,
          sessionId: token.sessionId,
        });
        return {
          error: "SessionExpired",
          name: token.name,
          exp: 0,
          id: token.id || "expired",
          requiresFirstTimeSetup: false,
        } as JWT;
      }

      return token;
    },
    async session({ session, token }) {
      // If token has error or is invalid, return error session
      if (
        token.error ||
        !token.id ||
        !token.sessionId ||
        !activeSessions.has(token.sessionId)
      ) {
        logger.info("auth", "Session validation failed - forcing logout", {
          sessionId: token?.sessionId,
          error: token.error,
        });
        return {
          ...session,
          error: "SessionExpired",
          expires: new Date(0).toISOString(),
        };
      }

      return {
        ...session,
        user: {
          id: token.id,
          name: token.name,
          role: token.role,
        },
        requiresFirstTimeSetup: token.requiresFirstTimeSetup,
      };
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 1 * 60 * 60, // 1 hour
  },
  events: {
    async signOut({ token }) {
      if (token?.sessionId) {
        activeSessions.delete(token.sessionId);
        logger.debug("auth", "Session removed on signout", {
          userId: token.id,
          sessionId: token.sessionId,
        });
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
