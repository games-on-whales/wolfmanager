import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ensureSecureKeys } from "@/lib/env";
import { LogComponent, logger } from "@/lib/logger";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Ensure secure keys are generated
if (process.env.NODE_ENV === "development") {
  ensureSecureKeys();
}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WolfUI",
  description: "Modern Admin Interface",
};

// Disable default loading state
export const dynamic = "force-dynamic";
export const suspense = false;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Log application startup
  await logger.info(LogComponent.WOLF_UI, "Application starting", {
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
  });

  try {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <SessionProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <div className="content-container">
                <Header />
                {children}
              </div>
              <Toaster richColors closeButton position="top-right" />
            </ThemeProvider>
          </SessionProvider>
        </body>
      </html>
    );
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Failed to initialize application",
      error
    );
    throw error;
  }
}
