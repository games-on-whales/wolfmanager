import { validateUser } from "@/lib/config";
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Add a Map to store active sessions
const activeSessions = new Map<string, boolean>();

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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
    requiresFirstTimeSetup: boolean;
    sessionId?: string;
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
            console.log("Missing credentials");
            return null;
          }

          const user = validateUser(credentials.username, credentials.password);
          console.log("Raw user data from validation:", user);

          if (user) {
            // Create the auth user with explicit requiresFirstTimeSetup
            const requiresFirstTimeSetup = user.has_changed_password === false;
            console.log("First time setup check:", {
              has_changed_password: user.has_changed_password,
              requiresFirstTimeSetup,
            });

            const authUser = {
              id: user.id,
              name: user.username,
              role: user.is_admin ? "admin" : "user",
              requiresFirstTimeSetup,
            };
            console.log("Final authorized user object:", authUser);
            return authUser;
          }
          console.log("User not found or invalid credentials");
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      console.log("JWT Callback - Input:", {
        user,
        trigger,
        session,
        currentToken: token,
      });

      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      if (user) {
        // Generate a unique session ID when creating a new token
        const sessionId = crypto.randomUUID();
        activeSessions.set(sessionId, true);

        const updatedToken = {
          ...token,
          role: user.role,
          id: user.id,
          requiresFirstTimeSetup: user.requiresFirstTimeSetup,
          sessionId,
        };
        console.log("JWT Callback - Updated token:", updatedToken);
        return updatedToken;
      }

      // Check if the session is still valid
      if (token.sessionId && !activeSessions.has(token.sessionId)) {
        // Session was invalidated, force a new login
        return {
          ...token,
          exp: 0, // Expire the token immediately
        };
      }

      console.log("JWT Callback - Returning existing token:", token);
      return token;
    },
    async session({ session, token }) {
      console.log("Session Callback:", {
        hasUser: !!session?.user,
        token,
        currentSession: session,
      });

      // Check if the session is still valid
      if (token.sessionId && !activeSessions.has(token.sessionId)) {
        throw new Error("Session expired");
      }

      // Explicitly construct the session with only the fields we want
      const updatedSession = {
        ...session,
        user: {
          id: token.id as string,
          name: token.name as string,
          role: token.role,
        },
        requiresFirstTimeSetup: token.requiresFirstTimeSetup,
      };

      console.log("Updated session:", updatedSession);
      return updatedSession;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 1 * 60 * 60, // 1 hour
  },
  events: {
    async signOut({ token }) {
      // Clear the session from active sessions
      if (token.sessionId) {
        activeSessions.delete(token.sessionId);
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
