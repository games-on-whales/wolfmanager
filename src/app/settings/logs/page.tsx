import { ErrorBoundary } from "@/components/error-boundary";
import { PageLayout } from "@/components/layout/page-layout";
import { LoadingState } from "@/components/loading-state";
import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { promises as fs } from "fs";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import path from "path";
import { Suspense } from "react";
import { LogViewer } from "./components/log-viewer";

async function getLogEntries() {
  try {
    const logPath =
      process.env.NODE_ENV === "production"
        ? "/var/log/wolf-ui/wolf-ui.log"
        : path.join(process.cwd(), "logs", "wolf-ui.log");

    // Read the last 1000 lines of the log file
    const fileContent = await fs.readFile(logPath, "utf-8");
    const lines = fileContent.split("\n").filter(Boolean).slice(-1000);

    // Parse JSON log entries
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return entries;
  } catch (error) {
    logger.error(LogComponent.WOLF_UI, "Failed to read log file", error);
    return [];
  }
}

export default async function LogsPage() {
  // 1. Authentication
  const session = await getServerSession(authOptions);

  await logger.info(LogComponent.AUTH, "Logs page access attempt", {
    userId: session?.user?.id,
    username: session?.user?.name,
  });

  if (!session?.user) {
    await logger.warn(LogComponent.AUTH, "Unauthorized access to logs page", {
      redirectTo: "/auth/signin",
    });
    redirect("/auth/signin");
  }

  if (session.user.role !== "admin") {
    await logger.warn(
      LogComponent.AUTH,
      "Non-admin access attempt to logs page",
      {
        userId: session.user.id,
        username: session.user.name,
        role: session.user.role,
        redirectTo: "/dashboard",
      }
    );
    redirect("/dashboard");
  }

  try {
    // 2. Data Fetching
    const logEntries = await getLogEntries();

    await logger.info(LogComponent.WOLF_UI, "Log entries fetched", {
      entryCount: logEntries.length,
    });

    // 3. Render with page layout
    return (
      <PageLayout
        title="System Logs"
        description="View and analyze system logs"
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingState />}>
            <LogViewer initialEntries={logEntries} />
          </Suspense>
        </ErrorBoundary>
      </PageLayout>
    );
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Failed to load logs page",
      error,
      { userId: session.user.id }
    );
    throw error;
  }
}
