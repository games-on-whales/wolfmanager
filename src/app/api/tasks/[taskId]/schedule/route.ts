import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger"; // Import the singleton instance
import { LogComponent } from "@/lib/logger/types";
import { updateTaskSchedule } from "@/lib/scheduler";
import { UpdateTaskScheduleSchema } from "@/lib/validation/task-schemas"; // Import central schema
import { getServerSession, Session } from "next-auth";
import { NextResponse } from "next/server";

// Use the imported singleton logger instance directly

interface RouteParams {
  params: {
    taskId: string;
  };
}

// Removed local schema definition, using imported UpdateTaskScheduleSchema

export async function PUT(request: Request, { params }: RouteParams) {
  const { taskId } = params;
  const url = new URL(request.url);
  logger.info(
    LogComponent.WOLF_SERVER,
    "Received PUT request to update task schedule.",
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
        endpoint: "PUT /api/tasks/[taskId]/schedule",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      logger.warn(LogComponent.AUTH, "Forbidden attempt: User is not admin.", {
        userId: session.user.id,
        userRole: session.user.role,
        taskId,
        endpoint: "PUT /api/tasks/[taskId]/schedule",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
      logger.debug(LogComponent.WOLF_SERVER, "Parsed request body.", {
        taskId,
        body,
      });
    } catch (parseError) {
      logger.error(
        LogComponent.WOLF_SERVER,
        "Failed to parse request body as JSON.",
        parseError instanceof Error
          ? parseError
          : new Error(String(parseError)),
        {
          taskId,
        }
      );
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const validation = UpdateTaskScheduleSchema.safeParse(body); // Use imported schema

    if (!validation.success) {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `Invalid schedule update request body.`,
        {
          userId: session.user.id,
          taskId,
          errors: validation.error.flatten(),
        }
      );
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { schedule } = validation.data;
    logger.debug(
      LogComponent.WOLF_SERVER,
      `Attempting to update schedule for task...`,
      {
        userId: session.user.id,
        taskId,
        newSchedule: schedule,
      }
    );
    await updateTaskSchedule(taskId, schedule);
    logger.info(
      LogComponent.WOLF_SERVER,
      `Successfully updated schedule for task.`,
      {
        userId: session.user.id,
        taskId,
        newSchedule: schedule,
      }
    );
    return NextResponse.json({ message: "Task schedule updated successfully" });
  } catch (error: any) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Error updating schedule for task ${taskId}`,
      error instanceof Error ? error : new Error(String(error)),
      { userId: session?.user?.id, taskId }
    );
    if (error.message.toLowerCase().includes("not found")) {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `Task not found during schedule update request.`,
        { taskId }
      );
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (error.message.toLowerCase().includes("invalid cron schedule")) {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `Invalid cron schedule format provided.`,
        { taskId, schedule: (error as any)?.schedule }
      );
      return NextResponse.json(
        { error: "Invalid cron schedule format" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
