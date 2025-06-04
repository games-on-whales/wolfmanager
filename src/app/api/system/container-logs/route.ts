import { authOptions } from "@/lib/auth";
import { DockerLogService } from "@/lib/services/docker-log-service";
import { API_ERROR_CODES, createErrorResponse } from "@/lib/api-utils";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const containerId = searchParams.get('containerId');
    const timestamps = searchParams.get('timestamps') === 'true';
    const tailParam = searchParams.get('tail');
    const tail = tailParam ? parseInt(tailParam, 10) : 100;

    // Validate required parameters
    if (!containerId) {
      return NextResponse.json(
        { error: 'containerId is required' }, 
        { status: 400 }
      );
    }

    // Validate tail parameter if provided
    if (tailParam && (isNaN(tail) || tail < 0)) {
      return NextResponse.json(
        { error: 'tail must be a non-negative number' }, 
        { status: 400 }
      );
    }

    // Get container logs using DockerLogService
    const logResponse = await DockerLogService.getContainerLogs(containerId, {
      timestamps,
      tail,
    });

    // Handle service response
    if (!logResponse.success) {
      const statusCode = logResponse.error?.code === API_ERROR_CODES.NOT_FOUND ? 404 : 500;
      return NextResponse.json(
        { 
          error: logResponse.error?.message || 'Failed to fetch container logs',
          code: logResponse.error?.code 
        },
        { status: statusCode }
      );
    }

    // Return successful response with logs
    return NextResponse.json(logResponse.data, { status: 200 });

  } catch (error) {
    console.error('Error fetching container logs:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error while fetching container logs',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}