import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { promises as fs } from "fs";
import { getServerSession } from "next-auth";
import path from "path";
import { z } from "zod";

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

// Helper function to get log file path
function getLogPath() {
  return process.env.NODE_ENV === "production"
    ? "/config/logs/wolf-ui.log"
    : path.join(process.cwd(), "config", "logs", "wolf-ui.log");
}

// GET /api/logs - Retrieve logs (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Check authentication and admin status
    if (!session?.user || session.user.role !== "admin") {
      await logger.warn(LogComponent.AUTH, "Unauthorized logs access attempt", {
        userId: session?.user?.id,
      });
      return Response.json(
        { error: "You need admin access to view logs" },
        { status: 401 }
      );
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
      return Response.json({ entries: [] });
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

    return Response.json({ entries });
  } catch (error) {
    await logger.error(
      LogComponent.SYSTEM,
      "Failed to retrieve logs",
      error instanceof Error ? error : new Error(String(error))
    );
    return Response.json({ error: "Failed to retrieve logs" }, { status: 500 });
  }
}

// POST /api/logs - Create new log entry
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Ensure user is authenticated
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedEntry = logEntrySchema.parse(body);

    // Add session context to metadata
    const enrichedEntry = {
      ...validatedEntry,
      metadata: {
        ...validatedEntry.metadata,
        userId: session.user.id,
        sessionId: session.user.id,
      },
    };

    // Ensure log directory exists
    const logPath = getLogPath();
    const logDir = path.dirname(logPath);
    await fs.mkdir(logDir, { recursive: true });

    // Write log entry to file
    await fs.appendFile(logPath, JSON.stringify(enrichedEntry) + "\n", "utf8");

    // Forward to appropriate logger based on level
    switch (enrichedEntry.level) {
      case "debug":
        await logger.debug(enrichedEntry.component, enrichedEntry.message, {
          ...enrichedEntry.metadata,
          raw: enrichedEntry.raw,
        });
        break;
      case "info":
        await logger.info(enrichedEntry.component, enrichedEntry.message, {
          ...enrichedEntry.metadata,
          raw: enrichedEntry.raw,
        });
        break;
      case "warn":
        await logger.warn(enrichedEntry.component, enrichedEntry.message, {
          ...enrichedEntry.metadata,
          raw: enrichedEntry.raw,
        });
        break;
      case "error":
        await logger.error(enrichedEntry.component, enrichedEntry.message, {
          ...enrichedEntry.metadata,
          raw: enrichedEntry.raw,
        });
        break;
    }

    return Response.json(null, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid log entry format" },
        { status: 400 }
      );
    }

    await logger.error(
      LogComponent.SYSTEM,
      "Failed to process log entry",
      error instanceof Error ? error : new Error(String(error))
    );
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
