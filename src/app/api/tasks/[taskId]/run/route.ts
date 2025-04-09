import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { triggerTaskRun } from "@/lib/scheduler";
import { getServerSession, Session } from "next-auth";
import { NextResponse } from "next/server";

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
    "Received POST request to manually run task.",
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
        endpoint: "POST /api/tasks/[taskId]/run",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      logger.warn(LogComponent.AUTH, "Forbidden attempt: User is not admin.", {
        userId: session.user.id,
        userRole: session.user.role,
        taskId,
        endpoint: "POST /api/tasks/[taskId]/run",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    logger.debug(
      LogComponent.WOLF_SERVER,
      `Attempting to manually run task...`,
      {
        userId: session.user.id,
        taskId,
      }
    );
    await triggerTaskRun(taskId);
    logger.info(LogComponent.WOLF_SERVER, `Successfully triggered task run.`, {
      userId: session.user.id,
      taskId,
    });
    return NextResponse.json({
      success: true,
      message: "Task triggered successfully",
    });
  } catch (error: any) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Error triggering task run for ${taskId}`,
      error instanceof Error ? error : new Error(String(error)),
      { userId: session?.user?.id, taskId }
    );

    if (error.message.toLowerCase().includes("not found")) {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `Task not found during run request.`,
        { taskId }
      );
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    if (error.message.toLowerCase().includes("already running")) {
      logger.warn(LogComponent.WOLF_SERVER, `Task is already running.`, {
        taskId,
      });
      return NextResponse.json(
        { success: false, error: "Task is already running" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
