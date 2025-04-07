import { TaskState, TasksConfig } from "@/types/task";
import { CronExpressionParser } from "cron-parser";
import fs from "fs/promises";
import cron from "node-cron";
import path from "path";
import {
  addOrUpdateTaskDefinition,
  loadTasksConfig,
  updateTaskState,
} from "./config";
import { Logger } from "./logger/logger"; // Import Logger
import { LogComponent } from "./logger/types"; // Import LogComponent
import { TaskDefinition } from "./tasks/task.interface";

const logger = Logger.getInstance(); // Initialize logger instance
const TASKS_DIR = path.resolve(process.cwd(), "src/lib/tasks");

interface ScheduledJob {
  job: cron.ScheduledTask;
  taskState: TaskState;
}

// In-memory storage for active cron jobs, keyed by task ID
const activeJobs = new Map<string, ScheduledJob>();

async function discoverAndInitializeTasks(): Promise<void> {
  logger.info(
    LogComponent.WOLF_SERVER,
    "Discovering and initializing tasks..."
  );
  try {
    const files = await fs.readdir(TASKS_DIR);
    const taskModules = files.filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".interface.ts")
    );

    logger.debug(
      LogComponent.WOLF_SERVER,
      `Found ${taskModules.length} potential task files.`
    );

    for (const file of taskModules) {
      const filePath = path.join(TASKS_DIR, file);
      try {
        const module = await import(filePath); // Dynamic import
        const taskDefinition = module.default as TaskDefinition; // Assuming default export

        if (taskDefinition && typeof taskDefinition.execute === "function") {
          logger.debug(
            LogComponent.WOLF_SERVER,
            `Discovered task definition: ${taskDefinition.name}`,
            { file }
          );

          // Ensure task exists in TOML config, add/update if needed
          const taskState = await addOrUpdateTaskDefinition({
            name: taskDefinition.name,
            description: taskDefinition.description,
            schedule: taskDefinition.defaultSchedule, // Use default schedule from definition
            is_enabled: taskDefinition.is_enabled, // Use default enabled state from definition
          });

          logger.debug(
            LogComponent.WOLF_SERVER,
            `Synchronized task definition "${taskState.name}" with config.`,
            { taskId: taskState.id, isEnabled: taskState.is_enabled }
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
            `Invalid or incomplete task definition found in file. Skipping.`,
            { file }
          );
        }
      } catch (error) {
        logger.error(
          LogComponent.WOLF_SERVER,
          `Failed to load or process task definition module.`,
          error instanceof Error ? error : new Error(String(error)),
          { file }
        );
      }
    }

    logger.info(
      LogComponent.WOLF_SERVER,
      "Task discovery and initialization complete."
    );
  } catch (error) {
    logger.error(
      LogComponent.WOLF_SERVER,
      "Failed during task discovery process.",
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
      // This avoids race conditions where a task might be disabled between trigger and execution start
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
        // Throwing an error here might stop the cron job permanently depending on node-cron version/config
        // Consider just logging and returning to allow future runs?
        return;
      }
      if (!currentState.is_enabled) {
        logger.info(
          LogComponent.WOLF_SERVER,
          `Task was disabled between cron trigger and execution start. Skipping run.`,
          { taskId: taskState.id, taskName: currentState.name }
        );
        // Update status back to STOPPED or IDLE? Let the API handle the state, just don't run.
        // We need to ensure the job doesn't run again until re-enabled via API.
        // The current logic in scheduleTask/stopScheduledTask handles this.
        stopScheduledTask(taskState.id); // Ensure the cron job itself is stopped
        // Update state to reflect it's stopped? The API should have already done this.
        // Maybe set to IDLE? Let's leave it as whatever the disabling action set it to.
        return;
      }
      if (currentState.status !== "RUNNING") {
        logger.warn(
          LogComponent.WOLF_SERVER,
          `Task status was not RUNNING at execution start, possible race condition or manual override. Proceeding with execution.`,
          { taskId: taskState.id, currentStatus: currentState.status }
        );
        // Force status back to RUNNING? Or trust the execute logic? Let's proceed.
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

  // Find definition (required for scheduling)
  const definition = await findTaskDefinition(taskState.name);
  if (!definition) {
    // Log error and potentially revert the state update?
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task definition module not found, cannot schedule task. State was set to enabled, but job won't run.`,
      null,
      { taskId, taskName: taskState.name }
    );
    // Consider updating state back to disabled/error? For now, leave enabled but unscheduled.
    throw new Error(`Task definition for ${taskState.name} not found.`);
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

  // Find the definition again
  const definition = await findTaskDefinition(taskState.name);
  if (!definition) {
    logger.error(
      LogComponent.WOLF_SERVER,
      `Task definition not found, cannot reschedule with new schedule.`,
      null,
      { taskId, taskName: taskState.name }
    );
    throw new Error(`Task definition for ${taskState.name} not found.`);
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
      `Task is currently disabled, schedule updated in config but not rescheduling active job.`,
      { taskId }
    );
  }
}

// Helper function to dynamically load a task definition by name
async function findTaskDefinition(
  taskName: string
): Promise<TaskDefinition | null> {
  logger.debug(
    LogComponent.WOLF_SERVER,
    `Attempting to find task definition module by name.`,
    { taskName }
  );
  const expectedFileName = `${taskName}.ts`; // Assuming file name matches task name
  const filePath = path.join(TASKS_DIR, expectedFileName);

  try {
    await fs.access(filePath); // Check if file exists
    const module = await import(filePath);
    const definition = module.default as TaskDefinition;
    if (definition && definition.name === taskName) {
      logger.debug(
        LogComponent.WOLF_SERVER,
        `Successfully found and loaded task definition module.`,
        { taskName, filePath }
      );
      return definition;
    } else {
      logger.warn(
        LogComponent.WOLF_SERVER,
        `File found, but default export is missing, invalid, or name mismatch.`,
        { taskName, filePath, definitionName: definition?.name }
      );
      return null;
    }
  } catch (error) {
    // Log file access errors or import errors
    logger.error(
      LogComponent.WOLF_SERVER,
      `Failed to access or import task definition module.`,
      error instanceof Error ? error : new Error(String(error)),
      { taskName, filePath }
    );
    return null;
  }
}

// TODO: Consider how and where to call startScheduler()
// Typically, this would be called once when the application server starts.
// In Next.js, this might be in a custom server file or an initialization script.
// For serverless, a different approach (like Vercel Cron Jobs) is needed.
