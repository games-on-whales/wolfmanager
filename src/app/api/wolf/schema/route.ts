import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.API, "Wolf schema access denied - no session", {
        url: request.url,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logger.debug(LogComponent.API, "Wolf schema request", {
      userId: session.user.id,
      username: session.user.name,
    });

    // Use centralized socket service to get schema
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/openapi-schema", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.API, "Wolf schema request failed", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return NextResponse.json(
        {
          error: "Failed to load Wolf API schema",
          details: response.error,
        },
        { status: response.statusCode || 500 }
      );
    }

    await logger.debug(LogComponent.API, "Wolf schema request successful", {
      userId: session.user.id,
      statusCode: response.statusCode,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    await logger.error(LogComponent.API, "Wolf schema request failed", error);
    return NextResponse.json(
      {
        error: "Failed to load Wolf API schema",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
