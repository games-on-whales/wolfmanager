import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { DockerLogService } from "@/lib/services/docker-log-service";
import { createErrorResponse, API_ERROR_CODES } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const timestamps = searchParams.get("timestamps") === "true";
    const tailParam = searchParams.get("tail");
    const tail = tailParam ? parseInt(tailParam, 10) : 100;

    // Validate tail parameter
    if (isNaN(tail) || tail < 0) {
      return NextResponse.json(
        createErrorResponse("Invalid tail parameter", API_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Find the Wolf container
    const containerResult = await DockerLogService.findWolfContainer();
    if (!containerResult.success) {
      return NextResponse.json(
        createErrorResponse(
          typeof containerResult.error === 'string'
            ? containerResult.error
            : containerResult.error?.message || "Wolf container not found",
          API_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const containerInfo = containerResult.data!;

    // Get container logs
    const logsResult = await DockerLogService.getContainerLogs(containerInfo.id, {
      timestamps,
      tail,
    });

    if (!logsResult.success) {
      return NextResponse.json(
        createErrorResponse(
          typeof logsResult.error === 'string'
            ? logsResult.error
            : logsResult.error?.message || "Failed to fetch container logs",
          API_ERROR_CODES.INTERNAL_ERROR
        ),
        { status: 500 }
      );
    }

    // Return logs with container info
    return NextResponse.json({
      success: true,
      data: {
        logs: logsResult.data,
        container: containerInfo,
      },
    });
  } catch (error) {
    console.error("Error in wolf-container-logs API:", error);
    return NextResponse.json(
      createErrorResponse(
        "Internal server error",
        API_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}