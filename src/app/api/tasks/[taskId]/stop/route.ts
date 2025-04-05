import { authOptions } from "@/lib/auth";
import { stopTask } from "@/lib/scheduler";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
// import { requireAuth } from '@/lib/auth'; // Placeholder
// import { Logger } from '@/lib/logger'; // Placeholder

// const logger = new Logger('api/tasks/stop'); // Placeholder

interface RouteParams {
  params: {
    taskId: string;
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  const { taskId } = params;

  // try {
  //     // TODO: Auth check
  //     // logger.info(`Received request to stop task: ${taskId}`);
  //     await stopTask(taskId);
  //     // logger.info(`Successfully stopped task: ${taskId}`);
  //     return NextResponse.json({ message: 'Task stopped successfully' });
  // } catch (error: any) {
  //     // logger.error(`Error stopping task ${taskId}`, { error: error.message, stack: error.stack });
  //     if (error.message.includes('not found')) {
  //         return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  //     }
  //     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  // }

  // Temporary implementation
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      // logger.warn('Unauthorized attempt to stop task: No session', { taskId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      // logger.warn('Forbidden attempt to stop task', { userId: session.user.id, taskId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // logger.info(`Received request to stop task: ${taskId}`, { userId: session.user.id });
    console.log(`Received request to stop task: ${taskId}`);
    await stopTask(taskId);
    console.log(`Successfully stopped task: ${taskId}`);
    // logger.info(`Successfully stopped task: ${taskId}`, { userId: session.user.id });
    return NextResponse.json({ message: "Task stopped successfully" });
  } catch (error: any) {
    // logger.error(`Error stopping task ${taskId}`, { userId: session?.user?.id, error: error.message, stack: error.stack });
    console.error(`Error stopping task ${taskId}:`, error);
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
