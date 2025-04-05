import { authOptions } from "@/lib/auth";
import { updateTaskSchedule } from "@/lib/scheduler";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
// import { Logger } from '@/lib/logger'; // Placeholder
import { z } from "zod";

// const logger = new Logger('api/tasks/schedule'); // Placeholder

interface RouteParams {
  params: {
    taskId: string;
  };
}

const updateScheduleSchema = z.object({
  schedule: z.string().min(1), // Basic validation, could add cron validation
});

export async function PUT(request: Request, { params }: RouteParams) {
  const { taskId } = params;

  // try {
  //     // TODO: Auth check
  //     const body = await request.json();
  //     const validation = updateScheduleSchema.safeParse(body);

  //     if (!validation.success) {
  //         // logger.warn(`Invalid schedule update request for task ${taskId}`, { errors: validation.error.errors });
  //         return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
  //     }

  //     const { schedule } = validation.data;
  //     // logger.info(`Received request to update schedule for task ${taskId} to: ${schedule}`);
  //     await updateTaskSchedule(taskId, schedule);
  //     // logger.info(`Successfully updated schedule for task: ${taskId}`);
  //     return NextResponse.json({ message: 'Task schedule updated successfully' });
  // } catch (error: any) {
  //     // logger.error(`Error updating schedule for task ${taskId}`, { error: error.message, stack: error.stack });
  //     if (error.message.includes('not found')) {
  //         return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  //     }
  //     if (error.message.includes('Invalid cron schedule')) {
  //         return NextResponse.json({ error: 'Invalid cron schedule format' }, { status: 400 });
  //     }
  //     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  // }

  // Temporary implementation
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      // logger.warn('Unauthorized attempt to update schedule: No session', { taskId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      // logger.warn('Forbidden attempt to update schedule', { userId: session.user.id, taskId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateScheduleSchema.safeParse(body);

    if (!validation.success) {
      // logger.warn(`Invalid schedule update request for task ${taskId}`, { userId: session.user.id, errors: validation.error.errors });
      console.error(
        `Invalid schedule update request for task ${taskId}`,
        validation.error.flatten()
      );
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { schedule } = validation.data;
    // logger.info(`Received request to update schedule for task ${taskId} to: ${schedule}`, { userId: session.user.id });
    console.log(
      `Received request to update schedule for task ${taskId} to: ${schedule}`
    );
    await updateTaskSchedule(taskId, schedule);
    console.log(`Successfully updated schedule for task: ${taskId}`);
    // logger.info(`Successfully updated schedule for task: ${taskId}`, { userId: session.user.id });
    return NextResponse.json({ message: "Task schedule updated successfully" });
  } catch (error: any) {
    // logger.error(`Error updating schedule for task ${taskId}`, { userId: session?.user?.id, error: error.message, stack: error.stack });
    console.error(`Error updating schedule for task ${taskId}:`, error);
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (error.message.includes("Invalid cron schedule")) {
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
