"use server";

import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger"; // Import the singleton instance
import { LogComponent, LogEntry } from "@/lib/logger/types";
import { promises as fs } from "fs";
import { getServerSession } from "next-auth";
import path from "path";
import { z } from "zod";

// Use the imported singleton logger instance directly

// Schema for validating log entries
const logEntrySchema = z.object({
  timestamp: z.coerce.date(),
  level: z.enum(["debug", "info", "warn", "error"]),
  component: z.enum([
    LogComponent.WOLF_UI,
    LogComponent.WOLF_SERVER,
    LogComponent.CONTAINER,
    LogComponent.PAIRING,
    LogComponent.AUTH,
    LogComponent.SYSTEM,
    LogComponent.STEAM,
  ]),
  message: z.string(),
  raw: z.any().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function createLogEntry(entry: LogEntry) {
  try {
    // Validate the entry
    const validatedEntry = logEntrySchema.parse(entry);

    // Add session context if available
    const session = await getServerSession(authOptions);
    const enrichedEntry = {
      ...validatedEntry,
      metadata: {
        ...validatedEntry.metadata,
        userId: session?.user?.id,
        sessionId: session?.user?.id,
      },
    };

    // Forward to appropriate logger based on level
    // Pass raw as 3rd arg, metadata as 4th, matching logger.ts signature
    switch (enrichedEntry.level) {
      case "debug":
        await logger.debug(
          enrichedEntry.component,
          enrichedEntry.message,
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
      case "info":
        await logger.info(
          enrichedEntry.component,
          enrichedEntry.message,
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
      case "warn":
        await logger.warn(
          enrichedEntry.component,
          enrichedEntry.message,
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
      case "error":
        await logger.error(
          enrichedEntry.component,
          enrichedEntry.message,
          // Ensure raw is an Error object if passed
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
    }

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid log entry format:", error.errors);
      return { success: false, error: "Invalid log entry format" };
    }

    console.error("Failed to process log entry:", error);
    return { success: false, error: "Failed to process log entry" };
  }
}

// Helper function to get log file path
function getLogPath() {
  return process.env.NODE_ENV === "production"
    ? "/config/logs/wolf-ui.log"
    : path.join(process.cwd(), "config", "logs", "wolf-ui.log");
}

export async function getLogs() {
  try {
    const session = await getServerSession(authOptions);

    // Check authentication and admin status
    if (!session?.user || session.user.role !== "admin") {
      await logger.warn(LogComponent.AUTH, "Unauthorized logs access attempt", {
        userId: session?.user?.id,
      });
      return { success: false, error: "You need admin access to view logs" };
    }

    // Read log file
    const logPath = getLogPath();

    try {
      await fs.access(logPath);
    } catch (error) {
      await logger.warn(LogComponent.SYSTEM, "Log file not found", {
        path: logPath,
        userId: session.user.id,
      });
      return { success: true, entries: [] };
    }

    const content = await fs.readFile(logPath, "utf-8");

    // Parse last 1000 lines into JSON
    const lines = content.trim().split("\n").slice(-1000);
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    await logger.info(LogComponent.SYSTEM, "Logs retrieved", {
      count: entries.length,
      userId: session.user.id,
    });

    return { success: true, entries };
  } catch (error) {
    await logger.error(
      LogComponent.SYSTEM,
      "Failed to retrieve logs",
      error instanceof Error ? error : new Error(String(error))
    );
    return { success: false, error: "Failed to retrieve logs" };
  }
}
