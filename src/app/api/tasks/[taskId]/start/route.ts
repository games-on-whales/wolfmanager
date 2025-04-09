import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger"; // Import the singleton instance
import { LogComponent } from "@/lib/logger/types";
import { startTask } from "@/lib/scheduler";
import { getServerSession, Session } from "next-auth";
import { NextResponse } from "next/server";

// Use the imported singleton logger instance directly

interface RouteParams {
  params: {
    taskId: string;
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  const { taskId } = params;
  const url = new URL(request.url);
  logger.info(
    LogComponent.WOLF_SERVER,
    "Received POST request to start task.",
    {
      taskId,
      pathname: url.pathname,
    }
  );

  let session: Session | null = null;

  try {
    session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(LogComponent.AUTH, "Unauthorized attempt: No session.", {
        taskId,
        endpoint: "POST /api/tasks/[taskId]/start",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      logger.warn(LogComponent.AUTH, "Forbidden attempt: User is not admin.", {
        userId: session.user.id,
        userRole: session.user.role,
        taskId,
        endpoint: "POST /api/tasks/[taskId]/start",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    logger.debug(LogComponent.WOLF_SERVER, `Attempting to start task...`, {
      userId: session.user.id,
      taskId,
    });
    await startTask(taskId);
    logger.info(LogComponent.WOLF_SERVER, `Successfully started task.`, {
      userId: session.user.id,
      taskId,
    });
    return NextResponse.json({ message: "Task started successfully" });
  } catch (error: any) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Error starting task ${taskId}`,
      error instanceof Error ? error : new Error(String(error)),
      { userId: session?.user?.id, taskId }
    );
    if (error.message.toLowerCase().includes("not found")) {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `Task not found during start request.`,
        { taskId }
      );
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
