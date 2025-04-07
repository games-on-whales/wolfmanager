// src/lib/tasks/placeholder-task.ts
import { Logger } from "@/lib/logger/logger"; // Import Logger
import { LogComponent } from "@/lib/logger/types"; // Import LogComponent
import { TaskState } from "@/types/task";
import { TaskDefinition } from "./task.interface";

export const placeholderTask: TaskDefinition = {
  name: "placeholder-task",
  description: "A simple placeholder task that logs a message.",
  defaultSchedule: "*/5 * * * *", // Every 5 minutes
  is_enabled: true, // Default enabled state
  execute: async (logger: Logger, taskState: TaskState) => {
    logger.info(
      LogComponent.WOLF_SERVER,
      `Placeholder task starting execution.`,
      {
        taskId: taskState.id,
        taskName: taskState.name,
      }
    );

    try {
      // Simulate work
      logger.debug(LogComponent.WOLF_SERVER, `Simulating work...`, {
        taskId: taskState.id,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logger.info(
        LogComponent.WOLF_SERVER,
        `Placeholder task finished successfully.`,
        {
          taskId: taskState.id,
        }
      );
    } catch (error) {
      logger.error(
        LogComponent.WOLF_SERVER,
        `Placeholder task failed during execution.`,
        error instanceof Error ? error : new Error(String(error)),
        { taskId: taskState.id }
      );
      // Re-throw the error so the scheduler can mark the task as ERRORED
      throw error;
    }
  },
};

export default placeholderTask;
