import { RootLayoutClient } from "@/components/layout/root-layout-client";
import { ensureSecureKeys } from "@/lib/env";
import { Logger } from "@/lib/logger/logger";
import { LogComponent } from "@/lib/logger/types";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

// Server-side startup log
const logger = Logger.getInstance();
logger.info(LogComponent.WOLF_UI, "Server application starting", {
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
