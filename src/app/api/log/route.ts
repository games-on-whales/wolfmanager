import { logger } from "@/lib/logger";
import { LogComponent, LogEntry, LogLevel } from "@/lib/logger/types";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Validate log entry schema
const logEntrySchema = z.object({
  timestamp: z.string().transform((str) => new Date(str)),
  level: z.enum(["debug", "info", "warn", "error"]) as z.ZodType<LogLevel>,
  component: z.enum([
    "wolf-ui",
    "wolf-server",
    "container",
    "pairing",
    "auth",
    "system",
  ]) as z.ZodType<LogComponent>,
  message: z.string(),
  raw: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate request body
    const body = await request.json();
    const entry = logEntrySchema.parse(body);

    // 3. Add session context to metadata
    const logEntry: LogEntry = {
      ...entry,
      metadata: {
        ...entry.metadata,
        userId: session.user.id,
        username: session.user.name,
      },
    };

    // 4. Forward to server logger
    await logger[entry.level](
      logEntry.component,
      logEntry.message,
      logEntry.raw,
      logEntry.metadata
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing log entry:", error);
    return NextResponse.json(
      { error: "Failed to process log entry" },
      { status: 500 }
    );
  }
}
