import { getTasksStatus } from "@/lib/scheduler";
import { NextResponse } from "next/server";
// import { requireAuth } from '@/lib/auth'; // Placeholder for auth check
// import { Logger } from '@/lib/logger'; // Placeholder for logger

// const logger = new Logger('api/tasks'); // Placeholder

// Add auth imports
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger"; // Import the singleton instance
import { LogComponent } from "@/lib/logger/types"; // Import LogComponent
import { getServerSession } from "next-auth";

// Use the imported singleton logger instance directly

export async function GET(request: Request) {
  const url = new URL(request.url);
  logger.info(
    LogComponent.WOLF_SERVER,
    "Received GET request for tasks status.",
    {
      pathname: url.pathname,
      searchParams: url.searchParams.toString(),
    }
  );

  // try {
  //     // TODO: Implement authentication/authorization check
  //     // const session = await requireAuth();
  //     // if (!session || !isAdmin(session.user)) {
  //     //     logger.warn('Unauthorized access attempt to get tasks', { user: session?.user?.id });
  //     //     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  //     // }
  //
  //     logger.info('Fetching tasks status');
  //     const tasksConfig = await getTasksStatus();
  //     return NextResponse.json(tasksConfig);
  // } catch (error: any) {
  //     logger.error('Error fetching tasks status', { error: error.message, stack: error.stack });
  //     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  // }

  // Temporary implementation without auth/logging
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      logger.warn(
        LogComponent.AUTH,
        "Unauthorized access attempt: No session.",
        {
          endpoint: "GET /api/tasks",
        }
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      logger.warn(
        LogComponent.AUTH,
        "Forbidden access attempt: User is not admin.",
        {
          userId: session.user.id,
          userRole: session.user.role,
          endpoint: "GET /api/tasks",
        }
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    logger.debug(LogComponent.WOLF_SERVER, "Fetching tasks status...", {
      userId: session.user.id,
    });
    const tasksConfig = await getTasksStatus();
    logger.info(
      LogComponent.WOLF_SERVER,
      "Successfully fetched tasks status.",
      {
        userId: session.user.id,
        taskCount: tasksConfig.tasks?.length ?? 0,
      }
    );
    return NextResponse.json(tasksConfig);
  } catch (error: any) {
    logger.error(
      LogComponent.WOLF_SERVER,
      "Error fetching tasks status",
      error instanceof Error ? error : new Error(String(error)),
      { endpoint: "GET /api/tasks" }
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Optional: Add HEAD or OPTIONS handlers if needed
