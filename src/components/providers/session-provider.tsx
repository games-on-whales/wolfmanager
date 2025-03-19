"use client";

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
      if (!session) {
        await clientLogger.debug(LogComponent.AUTH, "Session ended");
      } else {
        await clientLogger.debug(LogComponent.AUTH, "Session updated", {
          user: session.user?.name,
        });
      }
    };

    logSession();
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
