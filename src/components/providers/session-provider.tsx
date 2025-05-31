"use client";

import { AuthErrorBoundary } from "@/components/auth/auth-error-boundary";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
} from "next-auth/react";
import { ReactNode, useEffect } from "react";

interface SessionProviderProps {
  children: ReactNode;
}

function SessionLogger() {
  const { data: session } = useSession();

  useEffect(() => {
    const logSession = async () => {
      try {
        if (!session) {
          // Use setTimeout to avoid potential race conditions during session destruction
          setTimeout(async () => {
            try {
              await clientLogger.debug(LogComponent.AUTH, "Session ended");
            } catch (error) {
              console.error("Session end logging error:", error);
            }
          }, 0);
        } else {
          try {
            await clientLogger.debug(LogComponent.AUTH, "Session updated", {
              user: session.user?.name,
            });
          } catch (error) {
            console.error("Session update logging error:", error);
          }
        }
      } catch (error) {
        console.error("Session logging error:", error);
      }
    };

    logSession();
  }, [session]);

  return null;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <AuthErrorBoundary>
      <NextAuthSessionProvider>
        <SessionLogger />
        {children}
      </NextAuthSessionProvider>
    </AuthErrorBoundary>
  );
}
