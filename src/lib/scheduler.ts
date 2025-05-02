import { TaskState, TasksConfig } from "@/types/task";
import { CronExpressionParser } from "cron-parser";
import cron from "node-cron";
// Removed fs and path imports
import {
  addOrUpdateTaskDefinition,
  loadTasksConfig,
  updateTaskState,
} from "./config";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types"; // Import LogComponent
import { taskDefinitionMap } from "./tasks"; // Import the task map
import { TaskDefinition } from "./tasks/task.interface";

interface ScheduledJob {
  job: cron.ScheduledTask;
  taskState: TaskState;
}

// In-memory storage for active cron jobs, keyed by task ID
const activeJobs = new Map<string, ScheduledJob>();

async function discoverAndInitializeTasks(): Promise<void> {
  if (process.env.NEXT_PUBLIC_FEATURE_BACKGROUND_TASKS_ENABLED !== "true") {
    logger.info(
      LogComponent.WOLF_SERVER,
      "Background tasks are disabled by FEATURE_BACKGROUND_TASKS_ENABLED flag."
    );
    return;
  }
  logger.info(
    LogComponent.WOLF_SERVER,
    "Initializing tasks from static map..."
  );
  try {
    const discoveredTaskNames = Object.keys(taskDefinitionMap);
    logger.debug(
      LogComponent.WOLF_SERVER,
      `Found ${discoveredTaskNames.length} tasks in the definition map.`
    );

    for (const taskName of discoveredTaskNames) {
      const taskDefinition = taskDefinitionMap[taskName];
      try {
        if (taskDefinition && typeof taskDefinition.execute === "function") {
          logger.debug(
            LogComponent.WOLF_SERVER,
            `Processing task definition: ${taskDefinition.name}`
          );

          // Ensure task exists in TOML config, add/update if needed
          const taskState = await addOrUpdateTaskDefinition({
            name: taskDefinition.name, // Use name as the key identifier now
            description: taskDefinition.description,
            schedule: taskDefinition.defaultSchedule,
            is_enabled: taskDefinition.is_enabled,
          });

          logger.debug(
            LogComponent.WOLF_SERVER,
            `Synchronized task definition "${taskState.name}" with config.`,
            { taskId: taskState.id, isEnabled: taskState.is_enabled } // taskState.id is UUID from config
          );

          // Schedule if enabled
          if (taskState.is_enabled) {
            scheduleTask(taskState, taskDefinition);
          } else {
            logger.info(
              LogComponent.WOLF_SERVER,
              `Task "${taskState.name}" (${taskState.id}) is disabled in config, skipping initial scheduling.`
            );
          }
        } else {
          logger.warn(
            LogComponent.WOLF_SERVER,
            `Invalid or incomplete task definition found in map for key. Skipping.`,
            { taskName }
          );
        }
      } catch (error) {
        logger.error(
          LogComponent.WOLF_SERVER,
          `Failed to process task definition from map.`,
          error instanceof Error ? error : new Error(String(error)),
          { taskName }
        );
      }
    }

    logger.info(
      LogComponent.WOLF_SERVER,
      "Task initialization from map complete."
    );
  } catch (error) {
    logger.error(
      LogComponent.WOLF_SERVER,
      "Failed during task initialization process.",
      error instanceof Error ? error : new Error(String(error))
    );
    // Consider if the app should fail to start here
    // throw error; // Optionally re-throw to halt startup
  }
}

function scheduleTask(taskState: TaskState, definition: TaskDefinition): void {
  if (!cron.validate(taskState.schedule)) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Invalid cron schedule, task will not be scheduled.`,
      null,
      {
        taskId: taskState.id,
        taskName: taskState.name,
        schedule: taskState.schedule,
      }
    );
    return;
  }

  // Stop existing job if it exists for this task ID (prevents duplicates)
  stopScheduledTask(taskState.id);

  logger.info(LogComponent.WOLF_SERVER, `Scheduling task with cron schedule.`, {
    taskId: taskState.id,
    taskName: taskState.name,
    schedule: taskState.schedule,
  });

  const job = cron.schedule(taskState.schedule, async () => {
    logger.info(LogComponent.WOLF_SERVER, `Cron triggered: Executing task.`, {
      taskId: taskState.id,
      taskName: taskState.name,
    });
    const startTime = Date.now();
    let nextRunTime: string | null = null;

    try {
      // Calculate next run time *before* potential state update inside execute
      try {
        const interval = CronExpressionParser.parse(taskState.schedule);
        nextRunTime = interval.next().toISOString();
        logger.debug(LogComponent.WOLF_SERVER, `Calculated next run time.`, {
          taskId: taskState.id,
          nextRunTime,
        });
      } catch (parseError) {
        logger.error(
          LogComponent.WOLF_SERVER,
          `Failed to parse cron schedule when calculating next run time.`,
          parseError instanceof Error
            ? parseError
            : new Error(String(parseError)),
          { taskId: taskState.id, schedule: taskState.schedule }
        );
        nextRunTime = null; // Cannot determine next run
      }

      // Update status to RUNNING and set next run time immediately
      await updateTaskState(taskState.id, {
        status: "RUNNING",
        next_run_at: nextRunTime,
      });
      logger.debug(
        LogComponent.WOLF_SERVER,
        `Updated task status to RUNNING.`,
        { taskId: taskState.id }
      );

      // Fetch the *latest* state before executing, in case it changed
      const currentConfig = await loadTasksConfig();
      const currentState = currentConfig.tasks.find(
        (t) => t.id === taskState.id
      );

      if (!currentState) {
        logger.error(
          LogComponent.WOLF_SERVER,
          `Task state disappeared unexpectedly before execution could start.`,
          null,
          { taskId: taskState.id }
        );
        return;
      }
      if (!currentState.is_enabled) {
        logger.info(
          LogComponent.WOLF_SERVER,
          `Task was disabled between cron trigger and execution start. Skipping run.`,
          { taskId: taskState.id, taskName: currentState.name }
        );
        stopScheduledTask(taskState.id); // Ensure the cron job itself is stopped
        return;
      }
      if (currentState.status !== "RUNNING") {
        logger.warn(
          LogComponent.WOLF_SERVER,
          `Task status was not RUNNING at execution start, possible race condition or manual override. Proceeding with execution.`,
          { taskId: taskState.id, currentStatus: currentState.status }
        );
      }

      // Execute the actual task logic - PASS THE LOGGER INSTANCE
      await definition.execute(logger, currentState); // Pass logger here
      const duration = (Date.now() - startTime) / 1000;

      // Update status on success
      await updateTaskState(taskState.id, {
        status: "IDLE",
        last_run_at: new Date(startTime).toISOString(),
        // next_run_at is already set
      });
      logger.info(LogComponent.WOLF_SERVER, `Task completed successfully.`, {
        taskId: taskState.id,
        taskName: currentState.name,
        durationSeconds: duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(
        LogComponent.WOLF_SERVER,
        `Task execution failed.`,
        error instanceof Error ? error : new Error(String(error)),
        {
          taskId: taskState.id,
          taskName: taskState.name,
          durationSeconds: duration,
        }
      );
      try {
        await updateTaskState(taskState.id, {
          status: "ERROR",
          last_run_at: new Date(startTime).toISOString(),
          // Keep the calculated next_run_at even on error? Or clear it? Let's keep it.
        });
        logger.warn(LogComponent.WOLF_SERVER, `Updated task status to ERROR.`, {
          taskId: taskState.id,
        });
      } catch (updateError) {
        logger.error(
          LogComponent.WOLF_SERVER,
          `Failed to update task status to ERROR after execution failure.`,
          updateError instanceof Error
            ? updateError
            : new Error(String(updateError)),
          { taskId: taskState.id, taskName: taskState.name }
        );
      }
    }
  });

  activeJobs.set(taskState.id, { job, taskState });
  job.start();
  logger.debug(LogComponent.WOLF_SERVER, `Started cron job for task.`, {
    taskId: taskState.id,
  });
}

function stopScheduledTask(taskId: string): boolean {
  const existing = activeJobs.get(taskId);
  if (existing) {
    existing.job.stop();
    activeJobs.delete(taskId);
    logger.info(LogComponent.WOLF_SERVER, `Stopped scheduled cron job.`, {
      taskId: taskId,
      taskName: existing.taskState.name,
    });
    return true;
  }
  logger.debug(
    LogComponent.WOLF_SERVER,
    `No active cron job found to stop for task ID.`,
    { taskId }
  );
  return false;
}

// --- Management Functions --- (Exported)

export async function startScheduler(): Promise<void> {
  logger.info(LogComponent.WOLF_SERVER, "Starting scheduler service...");
  await discoverAndInitializeTasks();
  logger.info(LogComponent.WOLF_SERVER, "Scheduler service started.");
  // Potentially add listeners for config changes if needed
}

export async function stopScheduler(): Promise<void> {
  logger.info(LogComponent.WOLF_SERVER, "Stopping scheduler service...");
  activeJobs.forEach((scheduledJob, taskId) => {
    scheduledJob.job.stop();
    logger.debug(LogComponent.WOLF_SERVER, `Stopped job during shutdown.`, {
      taskId: taskId,
      taskName: scheduledJob.taskState.name,
    });
  });
  activeJobs.clear();
  logger.info(
    LogComponent.WOLF_SERVER,
    "Scheduler service stopped, all active cron jobs stopped."
  );
}

export async function getTasksStatus(): Promise<TasksConfig> {
  logger.debug(
    LogComponent.WOLF_SERVER,
    "Fetching current tasks status from config."
  );
  // Directly load from config, as it's the source of truth
  return await loadTasksConfig();
}

export async function startTask(taskId: string): Promise<void> {
  logger.info(LogComponent.WOLF_SERVER, `Received request to start task.`, {
    taskId,
  });
  const config = await loadTasksConfig();
  const taskState = config.tasks.find((t) => t.id === taskId);

  if (!taskState) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Cannot start task: Task ID not found in configuration.`,
      null,
      { taskId }
    );
    throw new Error(`Task with id ${taskId} not found.`);
  }

  if (taskState.is_enabled && activeJobs.has(taskId)) {
    logger.warn(
      LogComponent.WOLF_SERVER,
      `Task is already enabled and scheduled.`,
      { taskId, taskName: taskState.name }
    );
    return; // Already running/scheduled
  }

  logger.debug(
    LogComponent.WOLF_SERVER,
    `Updating task state to enabled/idle before scheduling.`,
    { taskId }
  );
  // Update config first
  await updateTaskState(taskId, { is_enabled: true, status: "IDLE" }); // Set to IDLE when manually starting

  // Find definition from the map
  const definition = taskDefinitionMap[taskState.name];
  if (!definition) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task definition not found in map for task name, cannot schedule task.`,
      null,
      { taskId, taskName: taskState.name }
    );
    throw new Error(`Task definition for ${taskState.name} not found in map.`);
  }

  // Get the *updated* task state after setting is_enabled=true
  const updatedConfig = await loadTasksConfig();
  const updatedTaskState = updatedConfig.tasks.find((t) => t.id === taskId);

  if (!updatedTaskState) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task state disappeared after update before scheduling.`,
      null,
      { taskId }
    );
    throw new Error(`Task state for ${taskId} disappeared unexpectedly.`);
  }

  if (!updatedTaskState.is_enabled) {
    logger.warn(
      LogComponent.WOLF_SERVER,
      `Task state is not enabled after attempting to enable it. Scheduling will not proceed.`,
      { taskId }
    );
    return;
  }

  // Schedule the task using the updated state
  scheduleTask(updatedTaskState, definition);
  logger.info(
    LogComponent.WOLF_SERVER,
    `Successfully started and scheduled task.`,
    { taskId, taskName: updatedTaskState.name }
  );
}

export async function stopTask(taskId: string): Promise<void> {
  logger.info(LogComponent.WOLF_SERVER, `Received request to stop task.`, {
    taskId,
  });
  // Stop the cron job first
  const stopped = stopScheduledTask(taskId);

  if (!stopped) {
    logger.warn(
      LogComponent.WOLF_SERVER,
      `No active cron job was found for task ID, but proceeding to update config state.`,
      { taskId }
    );
  }

  // Update the config state regardless of whether a job was running
  try {
    await updateTaskState(taskId, { is_enabled: false, status: "STOPPED" });
    logger.info(
      LogComponent.WOLF_SERVER,
      `Updated task state to disabled/stopped.`,
      { taskId }
    );
  } catch (error) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Failed to update task state to disabled/stopped after stopping job.`,
      error instanceof Error ? error : new Error(String(error)),
      { taskId }
    );
    // Re-throw the error as the state update failed
    throw error;
  }
}

export async function updateTaskSchedule(
  taskId: string,
  newSchedule: string
): Promise<void> {
  logger.info(
    LogComponent.WOLF_SERVER,
    `Received request to update schedule for task.`,
    { taskId, newSchedule }
  );

  if (!cron.validate(newSchedule)) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Invalid cron schedule provided for update.`,
      null,
      { taskId, newSchedule }
    );
    throw new Error(`Invalid cron schedule format: ${newSchedule}`);
  }

  // Stop the current job if it's running
  stopScheduledTask(taskId);

  // Update the schedule in the configuration
  await updateTaskState(taskId, { schedule: newSchedule });
  logger.debug(LogComponent.WOLF_SERVER, `Updated schedule in config.`, {
    taskId,
    newSchedule,
  });

  // Reload the config to get the full, updated task state
  const updatedConfig = await loadTasksConfig();
  const taskState = updatedConfig.tasks.find((t) => t.id === taskId);

  if (!taskState) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task state not found after updating schedule. Cannot reschedule.`,
      null,
      { taskId }
    );
    throw new Error(`Task with ID ${taskId} not found after update.`);
  }

  // Find the definition again from the map
  const definition = taskDefinitionMap[taskState.name];
  if (!definition) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task definition not found in map, cannot reschedule with new schedule.`,
      null,
      { taskId, taskName: taskState.name }
    );
    throw new Error(`Task definition for ${taskState.name} not found in map.`);
  }

  // Reschedule *only* if the task is currently enabled
  if (taskState.is_enabled) {
    logger.info(
      LogComponent.WOLF_SERVER,
      `Task is enabled, rescheduling with new schedule.`,
      { taskId, newSchedule }
    );
    scheduleTask(taskState, definition);
  } else {
    logger.info(
      LogComponent.WOLF_SERVER,
      `Task is disabled, schedule updated in config but job not started.`,
      { taskId, newSchedule }
    );
  }
}
// Removed findTaskDefinition helper function

/**
 * Manually triggers a task run.
 * @param taskId The ID of the task to run
 * @returns A promise that resolves when the task execution is complete
 * @throws Error if the task is not found or already running
 */
export async function triggerTaskRun(taskId: string): Promise<void> {
  logger.info(
    LogComponent.WOLF_SERVER,
    `Received request to manually trigger task run.`,
    {
      taskId,
    }
  );

  // Load the current task configuration
  const config = await loadTasksConfig();
  const taskState = config.tasks.find((t) => t.id === taskId);

  if (!taskState) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Cannot trigger task: Task ID not found in configuration.`,
      null,
      { taskId }
    );
    throw new Error(`Task with id ${taskId} not found.`);
  }

  // Find the corresponding task definition
  const definition = taskDefinitionMap[taskState.name];
  if (!definition) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task definition not found in map for task name, cannot execute task.`,
      null,
      { taskId, taskName: taskState.name }
    );
    throw new Error(`Task definition for ${taskState.name} not found in map.`);
  }

  // Check if the task is already running
  if (taskState.status === "RUNNING") {
    logger.warn(
      LogComponent.WOLF_SERVER,
      `Task is already running, cannot trigger manual run.`,
      { taskId, taskName: taskState.name }
    );
    throw new Error(`Task ${taskState.name} is already running.`);
  }

  // Update the task state to RUNNING
  await updateTaskState(taskId, {
    status: "RUNNING",
    last_run_at: new Date().toISOString(),
  });

  logger.info(LogComponent.WOLF_SERVER, `Starting manual execution of task.`, {
    taskId,
    taskName: taskState.name,
  });

  try {
    // Execute the task
    await definition.execute(logger, taskState);

    // Update the task state to IDLE after successful execution
    await updateTaskState(taskId, { status: "IDLE" });

    logger.info(
      LogComponent.WOLF_SERVER,
      `Manual task execution completed successfully.`,
      { taskId, taskName: taskState.name }
    );
  } catch (error) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Manual task execution failed.`,
      error instanceof Error ? error : new Error(String(error)),
      { taskId, taskName: taskState.name }
    );

    // Update the task state to ERROR
    await updateTaskState(taskId, { status: "ERROR" });

    // Re-throw the error
    throw error;
  }
}
