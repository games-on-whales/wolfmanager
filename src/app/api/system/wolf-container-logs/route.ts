import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { DockerLogService } from "@/lib/services/docker-log-service";
import { createErrorResponse, API_ERROR_CODES } from "@/lib/api-utils";
import { LogComponent, logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(LogComponent.API, "Unauthorized access to Wolf container logs", {
        ip: request.ip,
        userAgent: request.headers.get("user-agent"),
      });
      return NextResponse.json(
        createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Docker operations require admin access
    if (session.user.role !== "admin") {
      logger.warn(LogComponent.API, "Non-admin user attempted Wolf container access", {
        userId: session.user.id,
        userRole: session.user.role,
        endpoint: "wolf-container-logs",
      });
      return NextResponse.json(
        createErrorResponse("Admin access required for Docker operations", API_ERROR_CODES.UNAUTHORIZED),
        { status: 403 }
      );
    }

    logger.info(LogComponent.API, "Wolf container logs request", {
      userId: session.user.id,
      endpoint: "wolf-container-logs",
    });

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const timestamps = searchParams.get("timestamps") === "true";
    const tailParam = searchParams.get("tail");
    const tail = tailParam ? parseInt(tailParam, 10) : 100;

    // Validate tail parameter
    if (isNaN(tail) || tail < 0) {
      logger.error(LogComponent.API, "Invalid tail parameter", {
        userId: session.user.id,
        tailParam,
      });
      return NextResponse.json(
        createErrorResponse("Invalid tail parameter", API_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Find the Wolf container using the updated service with session
    const containerResult = await DockerLogService.findWolfContainer(session);
    if (!containerResult.success) {
      const statusCode = containerResult.error?.code === API_ERROR_CODES.UNAUTHORIZED ? 403 : 404;
      
      logger.error(LogComponent.API, "Failed to find Wolf container",
        new Error(containerResult.error?.message || "Unknown error"), {
        userId: session.user.id,
        errorCode: containerResult.error?.code,
      });

      return NextResponse.json(
        createErrorResponse(
          typeof containerResult.error === 'string'
            ? containerResult.error
            : containerResult.error?.message || "Wolf container not found",
          containerResult.error?.code || API_ERROR_CODES.NOT_FOUND
        ),
        { status: statusCode }
      );
    }

    const containerInfo = containerResult.data!;

    // Get container logs using the updated service with session
    const logsResult = await DockerLogService.getContainerLogs(session, containerInfo.id, {
      timestamps,
      tail,
    });

    if (!logsResult.success) {
      const statusCode = logsResult.error?.code === API_ERROR_CODES.UNAUTHORIZED ? 403 : 500;
      
      logger.error(LogComponent.API, "Failed to fetch Wolf container logs",
        new Error(logsResult.error?.message || "Unknown error"), {
        userId: session.user.id,
        containerId: containerInfo.id,
        errorCode: logsResult.error?.code,
      });

      return NextResponse.json(
        createErrorResponse(
          typeof logsResult.error === 'string'
            ? logsResult.error
            : logsResult.error?.message || "Failed to fetch container logs",
          logsResult.error?.code || API_ERROR_CODES.INTERNAL_ERROR
        ),
        { status: statusCode }
      );
    }

    logger.info(LogComponent.API, "Wolf container logs retrieved successfully", {
      userId: session.user.id,
      containerId: containerInfo.id,
      containerName: containerInfo.name,
      logCount: logsResult.data?.length || 0,
    });

    // Return logs with container info
    return NextResponse.json({
      success: true,
      data: {
        logs: logsResult.data,
        container: containerInfo,
      },
    });
  } catch (error) {
    logger.error(LogComponent.API, "Error in wolf-container-logs API",
      error instanceof Error ? error : new Error(String(error)), {
      userId: (await getServerSession(authOptions))?.user?.id,
    });

    return NextResponse.json(
      createErrorResponse(
        "Internal server error",
        API_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}