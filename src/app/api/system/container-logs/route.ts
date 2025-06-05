import { authOptions } from "@/lib/auth";
import { DockerLogService } from "@/lib/services/docker-log-service";
import { API_ERROR_CODES, createErrorResponse } from "@/lib/api-utils";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(LogComponent.API, "Unauthorized access to container logs", {
        ip: request.ip,
        userAgent: request.headers.get("user-agent"),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Docker operations require admin access
    if (session.user.role !== "admin") {
      logger.warn(LogComponent.API, "Non-admin user attempted Docker access", {
        userId: session.user.id,
        userRole: session.user.role,
        endpoint: "container-logs",
      });
      return NextResponse.json(
        { error: "Admin access required for Docker operations" },
        { status: 403 }
      );
    }

    logger.info(LogComponent.API, "Container logs request", {
      userId: session.user.id,
      endpoint: "container-logs",
    });

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const containerId = searchParams.get('containerId');
    const timestamps = searchParams.get('timestamps') === 'true';
    const tailParam = searchParams.get('tail');
    const tail = tailParam ? parseInt(tailParam, 10) : 100;

    // Validate required parameters
    if (!containerId) {
      logger.error(LogComponent.API, "Missing containerId parameter", {
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: 'containerId is required' },
        { status: 400 }
      );
    }

    // Validate tail parameter if provided
    if (tailParam && (isNaN(tail) || tail < 0)) {
      logger.error(LogComponent.API, "Invalid tail parameter", {
        userId: session.user.id,
        tailParam,
      });
      return NextResponse.json(
        { error: 'tail must be a non-negative number' },
        { status: 400 }
      );
    }

    // Get container logs using DockerLogService with session
    const logResponse = await DockerLogService.getContainerLogs(session, containerId, {
      timestamps,
      tail,
    });

    // Handle service response
    if (!logResponse.success) {
      const statusCode = logResponse.error?.code === API_ERROR_CODES.NOT_FOUND ? 404 :
                        logResponse.error?.code === API_ERROR_CODES.UNAUTHORIZED ? 403 : 500;
      
      logger.error(LogComponent.API, "Failed to fetch container logs",
        new Error(logResponse.error?.message || "Unknown error"), {
        userId: session.user.id,
        containerId,
        errorCode: logResponse.error?.code,
      });

      return NextResponse.json(
        {
          error: logResponse.error?.message || 'Failed to fetch container logs',
          code: logResponse.error?.code
        },
        { status: statusCode }
      );
    }

    // Get container info using the service
    let containerInfo = null;
    const containerInfoResponse = await DockerLogService.getContainerInfo(session, containerId);
    
    if (containerInfoResponse.success) {
      containerInfo = containerInfoResponse.data;
    } else {
      // Log warning but continue with logs
      logger.warn(LogComponent.API, "Could not fetch container info", {
        userId: session.user.id,
        containerId,
        error: containerInfoResponse.error,
      });
    }

    logger.info(LogComponent.API, "Container logs retrieved successfully", {
      userId: session.user.id,
      containerId,
      logCount: logResponse.data?.length || 0,
      hasContainerInfo: !!containerInfo,
    });

    // Return successful response with logs and container info
    return NextResponse.json({
      success: true,
      data: {
        logs: logResponse.data,
        container: containerInfo,
      }
    }, { status: 200 });

  } catch (error) {
    logger.error(LogComponent.API, "Error in container logs endpoint",
      error instanceof Error ? error : new Error(String(error)), {
      userId: (await getServerSession(authOptions))?.user?.id,
    });

    return NextResponse.json(
      createErrorResponse(
        "Internal server error while fetching container logs",
        API_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}