import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { promises as fs } from "fs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import path from "path";

export async function GET() {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);

    await logger.info(LogComponent.AUTH, "Logs API access attempt", {
      userId: session?.user?.id,
      username: session?.user?.name,
    });

    if (!session?.user) {
      await logger.warn(LogComponent.AUTH, "Unauthorized logs API access");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      await logger.warn(LogComponent.AUTH, "Non-admin logs API access", {
        userId: session.user.id,
        username: session.user.name,
        role: session.user.role,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Read log file
    const logPath =
      process.env.NODE_ENV === "production"
        ? "/var/log/wolf-ui/wolf-ui.log"
        : path.join(process.cwd(), "logs", "wolf-ui.log");

    const fileContent = await fs.readFile(logPath, "utf-8");
    const lines = fileContent.split("\n").filter(Boolean).slice(-1000);

    // 3. Parse JSON log entries
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    await logger.info(LogComponent.WOLF_UI, "Logs API request successful", {
      userId: session.user.id,
      entryCount: entries.length,
    });

    return NextResponse.json(entries);
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Logs API request failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
