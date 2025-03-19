import { validateUser } from "@/lib/config";
import { AuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { Logger } from "./logger/logger";
import { LogComponent } from "./logger/types";

// Initialize logger
const logger = Logger.getInstance();

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
            logger.debug(LogComponent.AUTH, "Missing credentials");
            return null;
          }

          const user = validateUser(credentials.username, credentials.password);

          if (user) {
            const requiresFirstTimeSetup = user.has_changed_password === false;
            logger.debug(LogComponent.AUTH, "User authenticated successfully", {
              username: credentials.username,
            });
            return {
              id: user.id,
              name: user.username,
              role: user.is_admin ? "admin" : "user",
              requiresFirstTimeSetup,
            };
          }
          logger.warn(LogComponent.AUTH, "Invalid credentials", {
            username: credentials.username,
          });
          return null;
        } catch (error) {
          logger.error(LogComponent.AUTH, "Authentication error", error);
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
        logger.debug(LogComponent.AUTH, "New session created", {
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
    },
    async session({ session, token }) {
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

      // Log successful session validation
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
      logger.debug(LogComponent.AUTH, "User signed out", {
        userId: token?.id,
      });
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
