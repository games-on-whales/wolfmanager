import { getLoggerConfig } from "@/lib/logger/config";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = getLoggerConfig();
    
    const debugInfo = {
      NODE_ENV: process.env.NODE_ENV,
      CONTAINER: process.env.CONTAINER,
      LOG_FILE_ENABLED: process.env.LOG_FILE_ENABLED,
      LOG_FILE_PATH: process.env.LOG_FILE_PATH,
      cwd: process.cwd(),
      config: {
        level: config.level,
        file: config.file,
        console: config.console,
        container: config.container,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to get logger config",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}