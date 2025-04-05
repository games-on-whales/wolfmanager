import fs from "fs/promises";
import cron from "node-cron";
import path from "path";
import {
  addOrUpdateTaskDefinition,
  loadTasksConfig,
  updateTaskState,
} from "./config";
// import { Logger } from '@/lib/logger'; // Uncomment when logger is ready
import { TaskState, TasksConfig } from "@/types/task";
import { CronExpressionParser } from "cron-parser";
import { TaskDefinition } from "./tasks/task.interface";

// const logger = new Logger('scheduler'); // Uncomment when logger is ready
const TASKS_DIR = path.resolve(process.cwd(), "src/lib/tasks");

interface ScheduledJob {
  job: cron.ScheduledTask;
  taskState: TaskState;
}

// In-memory storage for active cron jobs, keyed by task ID
const activeJobs = new Map<string, ScheduledJob>();

async function discoverAndInitializeTasks(): Promise<void> {
  // logger.info('Discovering and initializing tasks...');
  console.log("Discovering and initializing tasks...");
  try {
    const files = await fs.readdir(TASKS_DIR);
    const taskModules = files.filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".interface.ts")
    );

    for (const file of taskModules) {
      const filePath = path.join(TASKS_DIR, file);
      try {
        const module = await import(filePath); // Dynamic import
        const taskDefinition = module.default as TaskDefinition; // Assuming default export

        if (taskDefinition && typeof taskDefinition.execute === "function") {
          // logger.debug(`Discovered task: ${taskDefinition.name}`);
          console.log(`Discovered task: ${taskDefinition.name}`);

          // Ensure task exists in TOML config, add/update if needed
          const taskState = await addOrUpdateTaskDefinition({
            name: taskDefinition.name,
            description: taskDefinition.description,
            schedule: taskDefinition.defaultSchedule, // Use default schedule from definition
            is_enabled: true, // default to enabled when first discovered?
          });

          // Schedule if enabled
          if (taskState.is_enabled) {
            scheduleTask(taskState, taskDefinition);
          }
        } else {
          // logger.warn(`Invalid task definition found in ${file}. Missing 'execute' function or default export.`);
          console.warn(
            `Invalid task definition found in ${file}. Missing 'execute' function or default export.`
          );
        }
      } catch (error) {
        // logger.error(`Failed to load or process task definition from ${file}`, { error });
        console.error(
          `Failed to load or process task definition from ${file}`,
          error
        );
      }
    }

    // logger.info('Task discovery and initialization complete.');
    console.log("Task discovery and initialization complete.");
  } catch (error) {
    // logger.error('Failed during task discovery', { error });
    console.error("Failed during task discovery", error);
    // Consider if the app should fail to start here
  }
}

function scheduleTask(taskState: TaskState, definition: TaskDefinition): void {
  if (!cron.validate(taskState.schedule)) {
    // logger.error(`Invalid cron schedule "${taskState.schedule}" for task "${taskState.name}". Task will not be scheduled.`);
    console.error(
      `Invalid cron schedule "${taskState.schedule}" for task "${taskState.name}". Task will not be scheduled.`
    );
    return;
  }

  // Stop existing job if it exists for this task ID
  stopScheduledTask(taskState.id);

  // logger.info(`Scheduling task "${taskState.name}" (${taskState.id}) with schedule "${taskState.schedule}"`);
  console.log(
    `Scheduling task "${taskState.name}" (${taskState.id}) with schedule "${taskState.schedule}"`
  );

  const job = cron.schedule(taskState.schedule, async () => {
    // logger.info(`Executing task "${taskState.name}" (${taskState.id}).`);
    console.log(`Executing task "${taskState.name}" (${taskState.id}).`);
    const startTime = Date.now();
    let nextRunTime: string | null = null;

    try {
      // Calculate next run time *before* potential state update inside execute
      try {
        const interval = CronExpressionParser.parse(taskState.schedule);
        nextRunTime = interval.next().toISOString();
      } catch (parseError) {
        // logger.error(`Failed to parse cron schedule "${taskState.schedule}" for task ${taskState.id} when calculating next run`, { parseError });
        console.error(
          `Failed to parse cron schedule "${taskState.schedule}" for task ${taskState.id} when calculating next run`,
          parseError
        );
        nextRunTime = null; // Cannot determine next run
      }

      // Update status to RUNNING and set next run time immediately
      await updateTaskState(taskState.id, {
        status: "RUNNING",
        next_run_at: nextRunTime,
      });

      // Fetch the *latest* state before executing, in case it changed
      const currentConfig = await loadTasksConfig();
      const currentState = currentConfig.tasks.find(
        (t) => t.id === taskState.id
      );

      if (!currentState) {
        throw new Error(
          `Task state for ${taskState.id} disappeared before execution.`
        );
      }
      if (!currentState.is_enabled) {
        // logger.info(`Task "${taskState.name}" (${taskState.id}) was disabled before execution could start. Skipping run.`);
        console.log(
          `Task "${taskState.name}" (${taskState.id}) was disabled before execution could start. Skipping run.`
        );
        // No need to update status back, it should be STOPPED or disabled via API
        return;
      }

      // Execute the actual task logic
      await definition.execute(/* logger, */ currentState);
      const duration = (Date.now() - startTime) / 1000;

      // Update status on success
      await updateTaskState(taskState.id, {
        status: "IDLE",
        last_run_at: new Date(startTime).toISOString(),
        // next_run_at is already set
      });
      // logger.info(`Task "${taskState.name}" (${taskState.id}) completed successfully in ${duration}s.`);
      console.log(
        `Task "${taskState.name}" (${taskState.id}) completed successfully in ${duration}s.`
      );
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      // logger.error(`Task "${taskState.name}" (${taskState.id}) failed after ${duration}s`, { error });
      console.error(
        `Task "${taskState.name}" (${taskState.id}) failed after ${duration}s`,
        error
      );
      try {
        await updateTaskState(taskState.id, {
          status: "ERROR",
          last_run_at: new Date(startTime).toISOString(),
          // Keep the calculated next_run_at even on error? Or clear it?
        });
      } catch (updateError) {
        // logger.error(`Failed to update task status to ERROR for "${taskState.name}" (${taskState.id})`, { updateError });
        console.error(
          `Failed to update task status to ERROR for "${taskState.name}" (${taskState.id})`,
          updateError
        );
      }
    }
  });

  activeJobs.set(taskState.id, { job, taskState });
  job.start();
}

function stopScheduledTask(taskId: string): boolean {
  const existing = activeJobs.get(taskId);
  if (existing) {
    existing.job.stop();
    activeJobs.delete(taskId);
    // logger.info(`Stopped scheduled job for task "${existing.taskState.name}" (${taskId}).`);
    console.log(
      `Stopped scheduled job for task "${existing.taskState.name}" (${taskId}).`
    );
    return true;
  }
  return false;
}

// --- Management Functions --- (Exported)

export async function startScheduler(): Promise<void> {
  // logger.info('Starting scheduler service...');
  console.log("Starting scheduler service...");
  await discoverAndInitializeTasks();
  // Potentially add listeners for config changes if needed
}

export async function stopScheduler(): Promise<void> {
  // logger.info('Stopping scheduler service...');
  console.log("Stopping scheduler service...");
  activeJobs.forEach((scheduledJob) => {
    scheduledJob.job.stop();
  });
  activeJobs.clear();
  // logger.info('All active cron jobs stopped.');
  console.log("All active cron jobs stopped.");
}

export async function getTasksStatus(): Promise<TasksConfig> {
  // Directly load from config, as it's the source of truth
  return await loadTasksConfig();
}

export async function startTask(taskId: string): Promise<void> {
  // logger.info(`Received request to start task ${taskId}`);
  console.log(`Received request to start task ${taskId}`);
  const config = await loadTasksConfig();
  const taskState = config.tasks.find((t) => t.id === taskId);

  if (!taskState) {
    // logger.error(`Cannot start task: Task with id ${taskId} not found.`);
    console.error(`Cannot start task: Task with id ${taskId} not found.`);
    throw new Error(`Task with id ${taskId} not found.`);
  }

  if (taskState.is_enabled && activeJobs.has(taskId)) {
    // logger.warn(`Task ${taskId} is already enabled and scheduled.`);
    console.warn(`Task ${taskId} is already enabled and scheduled.`);
    return; // Already running/scheduled
  }

  // Update config first
  await updateTaskState(taskId, { is_enabled: true, status: "IDLE" }); // Set to IDLE when manually starting

  // Find definition (required for scheduling)
  const definition = await findTaskDefinition(taskState.name);
  if (!definition) {
    // logger.error(`Task definition not found for ${taskState.name}, cannot schedule.`);
    console.error(
      `Task definition not found for ${taskState.name}, cannot schedule.`
    );
    // Maybe update state back to disabled/error?
    await updateTaskState(taskId, { is_enabled: false, status: "ERROR" });
    throw new Error(`Task definition not found for ${taskState.name}`);
  }

  // Schedule the task (this will handle stopping existing if any)
  scheduleTask({ ...taskState, is_enabled: true, status: "IDLE" }, definition);
}

export async function stopTask(taskId: string): Promise<void> {
  // logger.info(`Received request to stop task ${taskId}`);
  console.log(`Received request to stop task ${taskId}`);
  const config = await loadTasksConfig();
  const taskState = config.tasks.find((t) => t.id === taskId);

  if (!taskState) {
    // logger.error(`Cannot stop task: Task with id ${taskId} not found.`);
    console.error(`Cannot stop task: Task with id ${taskId} not found.`);
    throw new Error(`Task with id ${taskId} not found.`);
  }

  // Update state in config first
  await updateTaskState(taskId, { is_enabled: false, status: "STOPPED" });

  // Stop the cron job
  stopScheduledTask(taskId);
}

export async function updateTaskSchedule(
  taskId: string,
  newSchedule: string
): Promise<void> {
  // logger.info(`Received request to update schedule for task ${taskId} to "${newSchedule}"`);
  console.log(
    `Received request to update schedule for task ${taskId} to "${newSchedule}"`
  );
  if (!cron.validate(newSchedule)) {
    // logger.error(`Invalid cron schedule provided: "${newSchedule}".`);
    console.error(`Invalid cron schedule provided: "${newSchedule}".`);
    throw new Error(`Invalid cron schedule format: ${newSchedule}`);
  }

  const config = await loadTasksConfig();
  const taskState = config.tasks.find((t) => t.id === taskId);

  if (!taskState) {
    // logger.error(`Cannot update schedule: Task with id ${taskId} not found.`);
    console.error(`Cannot update schedule: Task with id ${taskId} not found.`);
    throw new Error(`Task with id ${taskId} not found.`);
  }

  // Update schedule in config
  await updateTaskState(taskId, { schedule: newSchedule });

  // If the task is currently enabled, reschedule it with the new cron string
  if (taskState.is_enabled) {
    // logger.info(`Task ${taskId} is enabled, rescheduling with new schedule.`);
    console.log(`Task ${taskId} is enabled, rescheduling with new schedule.`);
    const definition = await findTaskDefinition(taskState.name);
    if (!definition) {
      // logger.error(`Task definition not found for ${taskState.name}, cannot reschedule.`);
      console.error(
        `Task definition not found for ${taskState.name}, cannot reschedule.`
      );
      // Mark as error?
      await updateTaskState(taskId, { is_enabled: false, status: "ERROR" });
      throw new Error(
        `Task definition not found for ${taskState.name} during reschedule.`
      );
    }
    scheduleTask({ ...taskState, schedule: newSchedule }, definition);
  } else {
    // logger.info(`Task ${taskId} is disabled, schedule updated in config but not rescheduled.`);
    console.log(
      `Task ${taskId} is disabled, schedule updated in config but not rescheduled.`
    );
  }
}

// Helper to find task definition dynamically (used by management functions)
async function findTaskDefinition(
  taskName: string
): Promise<TaskDefinition | null> {
  const filePath = path.join(TASKS_DIR, `${taskName}.ts`);
  try {
    const module = await import(filePath);
    return module.default as TaskDefinition;
  } catch (error) {
    // logger.error(`Failed to find or load task definition module for ${taskName}`, { error });
    console.error(
      `Failed to find or load task definition module for ${taskName}`,
      error
    );
    return null;
  }
}

// TODO: Consider how and where to call startScheduler()
// Typically, this would be called once when the application server starts.
// In Next.js, this might be in a custom server file or an initialization script.
// For serverless, a different approach (like Vercel Cron Jobs) is needed.
