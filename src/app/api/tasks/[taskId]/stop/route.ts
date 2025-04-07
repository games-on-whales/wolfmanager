import { authOptions } from "@/lib/auth";
import { Logger } from "@/lib/logger/logger";
import { LogComponent } from "@/lib/logger/types";
import { stopTask } from "@/lib/scheduler";
import { getServerSession, Session } from "next-auth";
import { NextResponse } from "next/server";
// import { requireAuth } from '@/lib/auth'; // Placeholder
// import { Logger } from '@/lib/logger'; // Placeholder

const logger = Logger.getInstance();

interface RouteParams {
  params: {
    taskId: string;
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  const { taskId } = params;
  const url = new URL(request.url);
  logger.info(LogComponent.WOLF_SERVER, "Received POST request to stop task.", {
    taskId,
    pathname: url.pathname,
  });

  let session: Session | null = null;

  try {
    session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(LogComponent.AUTH, "Unauthorized attempt: No session.", {
        taskId,
        endpoint: "POST /api/tasks/[taskId]/stop",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      logger.warn(LogComponent.AUTH, "Forbidden attempt: User is not admin.", {
        userId: session.user.id,
        userRole: session.user.role,
        taskId,
        endpoint: "POST /api/tasks/[taskId]/stop",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    logger.debug(LogComponent.WOLF_SERVER, `Attempting to stop task...`, {
      userId: session.user.id,
      taskId,
    });
    await stopTask(taskId);
    logger.info(LogComponent.WOLF_SERVER, `Successfully stopped task.`, {
      userId: session.user.id,
      taskId,
    });
    return NextResponse.json({ message: "Task stopped successfully" });
  } catch (error: any) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Error stopping task ${taskId}`,
      error instanceof Error ? error : new Error(String(error)),
      { userId: session?.user?.id, taskId }
    );
    if (error.message.toLowerCase().includes("not found")) {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `Task not found during stop request (might be benign if already stopped or removed).`,
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
