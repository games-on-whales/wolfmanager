"use client";

import { clientLogger, LogComponent } from "@/lib/logger";
import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
} from "next-auth/react";
import { useEffect } from "react";

interface SessionProviderProps {
  children: React.ReactNode;
}

function SessionLogger() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      clientLogger.info(LogComponent.AUTH, "Session updated", {
        userId: session.user.id,
        username: session.user.name,
        requiresSetup: session.requiresFirstTimeSetup,
      });
    } else {
      clientLogger.info(LogComponent.AUTH, "Session ended");
    }
  }, [session]);

  return null;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      <SessionLogger />
      {children}
    </NextAuthSessionProvider>
  );
}
