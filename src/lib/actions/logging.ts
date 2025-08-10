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
    LogComponent.CLIENT,
    LogComponent.AUTH,
    LogComponent.SYSTEM,
    LogComponent.STEAM,
  ]),
  message: z.string(),
  raw: z.any().optional(),
  metadata: z.any().optional(),
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
        logger.debug(
          enrichedEntry.component,
          enrichedEntry.message,
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
      case "info":
        logger.info(
          enrichedEntry.component,
          enrichedEntry.message,
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
      case "warn":
        logger.warn(
          enrichedEntry.component,
          enrichedEntry.message,
          enrichedEntry.raw,
          enrichedEntry.metadata
        );
        break;
      case "error":
        logger.error(
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

// Helper function to get log file path with fallbacks
function getLogPath() {
  // Check environment variables first
  if (process.env.LOG_FILE_PATH) {
    return process.env.LOG_FILE_PATH;
  }
  
  // Production paths with fallbacks
  if (process.env.NODE_ENV === "production") {
    const possiblePaths = [
      "/app/config/logs/wolfmanager.log", // Correct Docker container path
      path.join(process.cwd(), "config", "logs", "wolfmanager.log"),
      "/config/logs/wolfmanager.log",
    ];
    
    // Return the first path that exists, or fallback to the primary one
    for (const testPath of possiblePaths) {
      try {
        require("fs").accessSync(testPath);
        return testPath;
      } catch {
        // Continue to next path
      }
    }
    
    // Fallback to primary production path
    return "/app/config/logs/wolfmanager.log";
  }
  
  // Development path
  return path.join(process.cwd(), "config", "logs", "wolfmanager.log");
}

export async function getLogs(): Promise<
  | { success: true; entries: LogEntry[] }
  | { success: false; error: string }
> {
  try {
    const session = await getServerSession(authOptions);

    // Check authentication and admin status
    if (!session?.user || session.user.role !== "admin") {
      logger.warn(LogComponent.AUTH, "Unauthorized logs access attempt", {
        userId: session?.user?.id,
      });
      return { success: false, error: "You need admin access to view logs" };
    }

    // Log the retrieval attempt for admin audit trail
    await logger.debug(LogComponent.SYSTEM, "Log retrieval requested", {
      userId: session.user.id,
      nodeEnv: process.env.NODE_ENV,
    });

    // Read log file with improved path detection
    const logPath = getLogPath();

    try {
      await fs.access(logPath);
      const content = await fs.readFile(logPath, "utf-8");
      return parseAndReturnLogs(content, session.user.id, logPath);
    } catch (error) {
      // Try alternative paths in production
      if (process.env.NODE_ENV === "production") {
        const alternativePaths = [
          path.join(process.cwd(), "config", "logs", "wolfmanager.log"),
          path.join("/app", "config", "logs", "wolfmanager.log"),
          "./config/logs/wolfmanager.log",
        ];
        
        for (const altPath of alternativePaths) {
          try {
            await fs.access(altPath);
            logger.debug(LogComponent.SYSTEM, "Using alternative log path", {
              path: altPath,
              userId: session.user.id,
            });
            
            const content = await fs.readFile(altPath, "utf-8");
            return parseAndReturnLogs(content, session.user.id, altPath);
          } catch (altError) {
            // Continue to next alternative path
          }
        }
      }
      
      logger.warn(LogComponent.SYSTEM, "Log file not found", {
        path: logPath,
        userId: session.user.id,
      });
      return { success: true, entries: [] };
    }
    
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to retrieve logs",
      error instanceof Error ? error : new Error(String(error)),
      {
        nodeEnv: process.env.NODE_ENV,
        container: process.env.CONTAINER,
      }
    );
    return {
      success: false,
      error: `Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Helper function to parse logs and return consistent format
function parseAndReturnLogs(content: string, userId: string, logPath: string): { success: true; entries: LogEntry[] } {
  // Parse last 1000 lines into JSON
  const lines = content.trim().split("\n").slice(-1000);
  
  const entries: LogEntry[] = lines
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        // Ensure the parsed object conforms to LogEntry structure
        return parsed as LogEntry;
      } catch (e) {
        return null;
      }
    })
    .filter((entry): entry is LogEntry => entry !== null);

  logger.info(LogComponent.SYSTEM, "Logs retrieved successfully", {
    count: entries.length,
    totalLines: content.trim().split("\n").length,
    userId,
    logPath,
  });

  return { success: true, entries };
}
