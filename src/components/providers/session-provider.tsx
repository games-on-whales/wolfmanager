"use client";

import { clientLogger, LogComponent } from "@/lib/logger";
import {
  SessionProvider as NextAuthSessionProvider,
  signOut,
  useSession,
} from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface SessionProviderProps {
  children: React.ReactNode;
}

function SessionLogger() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.error === "SessionExpired") {
      clientLogger.info(LogComponent.AUTH, "Session expired - logging out");
      signOut({ callbackUrl: "/login" });
      return;
    }

    if (session) {
      clientLogger.info(LogComponent.AUTH, "Session updated", {
        userId: session.user.id,
        username: session.user.name,
        requiresSetup: session.requiresFirstTimeSetup,
      });
    } else {
      clientLogger.info(LogComponent.AUTH, "Session ended");
    }
  }, [session, router]);

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
