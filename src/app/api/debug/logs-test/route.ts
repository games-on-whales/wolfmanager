import { getLogs } from "@/lib/actions/logging";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user has admin access
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get the log path used by getLogs
    const logPath = process.env.NODE_ENV === "production"
      ? "/config/logs/wolf-ui.log"
      : require("path").join(process.cwd(), "config", "logs", "wolf-ui.log");

    const debugInfo: any = {
      NODE_ENV: process.env.NODE_ENV,
      CONTAINER: process.env.CONTAINER,
      logPath,
      timestamp: new Date().toISOString(),
    };

    // Test file access
    try {
      await fs.access(logPath);
      debugInfo.fileExists = true;
      
      const stats = await fs.stat(logPath);
      debugInfo.fileStats = {
        size: stats.size,
        modified: stats.mtime,
        isFile: stats.isFile(),
      };
      
      // Try to read a small portion
      const content = await fs.readFile(logPath, "utf-8");
      const lines = content.trim().split("\n");
      debugInfo.totalLines = lines.length;
      debugInfo.lastLine = lines[lines.length - 1]?.substring(0, 200);
      
    } catch (error) {
      debugInfo.fileExists = false;
      debugInfo.fileError = error instanceof Error ? error.message : String(error);
    }

    // Test the getLogs function
    try {
      const result = await getLogs();
      debugInfo.getLogsResult = {
        success: result.success,
        entriesCount: result.success ? result.entries.length : 0,
        error: result.success ? null : result.error,
        firstEntry: result.success ? result.entries[0] : null,
        lastEntry: result.success ? result.entries[result.entries.length - 1] : null,
      };
    } catch (error) {
      debugInfo.getLogsError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug test failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}