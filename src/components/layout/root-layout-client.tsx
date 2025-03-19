"use client";

import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/themed-toaster";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { ReactNode, useEffect } from "react";

interface RootLayoutClientProps {
  children: ReactNode;
}

export function RootLayoutClient({ children }: RootLayoutClientProps) {
  useEffect(() => {
    const logStartup = async () => {
      await clientLogger.info(
        LogComponent.WOLF_UI,
        "Client application starting",
        {
          environment: process.env.NODE_ENV,
        }
      );
    };
    logStartup();
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div className="content-container wolf-theme">
          <Header />
          {children}
        </div>
        <Toaster closeButton />
      </ThemeProvider>
    </SessionProvider>
  );
}
