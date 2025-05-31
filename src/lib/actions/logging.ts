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
      "/config/logs/wolf-ui.log",
      path.join(process.cwd(), "config", "logs", "wolf-ui.log"),
      path.join("/app", "config", "logs", "wolf-ui.log"), // Docker container path
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
    return "/config/logs/wolf-ui.log";
  }
  
  // Development path
  return path.join(process.cwd(), "config", "logs", "wolf-ui.log");
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

    // Add debug logging to see what's happening
    console.log("[LOGS_DEBUG] Starting log retrieval process");
    console.log("[LOGS_DEBUG] Environment:", {
      NODE_ENV: process.env.NODE_ENV,
      CONTAINER: process.env.CONTAINER,
      LOG_FILE_PATH: process.env.LOG_FILE_PATH,
    });
    
    // Test the logger by creating a new log entry
    await logger.info(LogComponent.SYSTEM, "Testing log file writing - getLogs called", {
      userId: session.user.id,
      timestamp: new Date().toISOString(),
    });

    // Read log file with improved path detection
    const logPath = getLogPath();
    console.log("[LOGS_DEBUG] Primary log path:", logPath);

    try {
      await fs.access(logPath);
      console.log("[LOGS_DEBUG] Primary log file exists");
    } catch (error) {
      console.log("[LOGS_DEBUG] Primary log file not found:", error);
      
      // Try alternative paths in production
      if (process.env.NODE_ENV === "production") {
        const alternativePaths = [
          path.join(process.cwd(), "config", "logs", "wolf-ui.log"),
          path.join("/app", "config", "logs", "wolf-ui.log"),
          "./config/logs/wolf-ui.log",
        ];
        
        console.log("[LOGS_DEBUG] Trying alternative paths:", alternativePaths);
        
        for (const altPath of alternativePaths) {
          try {
            await fs.access(altPath);
            console.log("[LOGS_DEBUG] Found logs at alternative path:", altPath);
            
            // Read and parse the alternative file
            const content = await fs.readFile(altPath, "utf-8");
            return parseAndReturnLogs(content, session.user.id, altPath);
          } catch (altError) {
            console.log("[LOGS_DEBUG] Alternative path failed:", altPath, altError);
          }
        }
      }
      
      logger.warn(LogComponent.SYSTEM, "Log file not found", {
        path: logPath,
        userId: session.user.id,
      });
      return { success: true, entries: [] };
    }

    const content = await fs.readFile(logPath, "utf-8");
    console.log("[LOGS_DEBUG] Log file content length:", content.length);
    
    return parseAndReturnLogs(content, session.user.id, logPath);
    
  } catch (error) {
    console.error("[LOGS_DEBUG] Error in getLogs:", error);
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
  console.log("[LOGS_DEBUG] Parsing logs from path:", logPath);
  
  // Parse last 1000 lines into JSON
  const lines = content.trim().split("\n").slice(-1000);
  console.log("[LOGS_DEBUG] Total lines to parse:", lines.length);
  
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

  console.log("[LOGS_DEBUG] Successfully parsed entries:", entries.length);

  logger.info(LogComponent.SYSTEM, "Logs retrieved successfully", {
    count: entries.length,
    totalLines: content.trim().split("\n").length,
    userId,
    logPath,
  });

  return { success: true, entries };
}
