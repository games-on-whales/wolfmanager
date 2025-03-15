"use client";

import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/themed-toaster";
import { clientLogger, LogComponent } from "@/lib/logger";

interface RootLayoutClientProps {
  children: React.ReactNode;
}

export function RootLayoutClient({ children }: RootLayoutClientProps) {
  // Log client-side startup
  clientLogger.info(LogComponent.WOLF_UI, "Client application starting", {
    environment: process.env.NODE_ENV,
  });

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
