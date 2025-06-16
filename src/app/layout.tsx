import { RootLayoutClient } from "@/components/layout/root-layout-client";
import { ensureSecureKeys } from "@/lib/env";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Ensure secure keys are generated
if (process.env.NODE_ENV === "development") {
  ensureSecureKeys();
}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WolfManager",
  description: "Modern Admin Interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="stars"></div>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
