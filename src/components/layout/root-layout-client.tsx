"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar"; // Import Sidebar
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/themed-toaster";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

interface RootLayoutClientProps {
  children: ReactNode;
}

export function RootLayoutClient({ children }: RootLayoutClientProps) {
  const pathname = usePathname(); // Get current pathname

  // Define paths where the main layout (header/sidebar) should NOT be shown
  const noLayoutPaths = ["/login", "/first-time-setup"];
  const showLayout = !noLayoutPaths.includes(pathname);

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
        {showLayout ? (
          <div className="flex min-h-screen">
            {/* Flex container for sidebar and main content */}
            <Sidebar /> {/* Add Sidebar */}
            <div className="flex flex-col flex-1 md:ml-64">
              {/* Main content area, adjust margin for sidebar */}
              <Header />
              <main className="flex-1 overflow-y-auto">
                {/* Main content scrollable area */}
                {children}
              </main>
            </div>
          </div>
        ) : (
          // Render only children for paths without the main layout
          children
        )}
        <Toaster closeButton />
      </ThemeProvider>
    </SessionProvider>
  );
}
