# Implementation Plan: Background Task Runner

This plan outlines the steps to implement a background task runner feature within the Next.js application, adhering to the project's technology stack and guidelines, specifically using TOML for data persistence as per `tomlconfig.mdc`.

## 1. TOML Data Structure for Tasks

Instead of a database, we will store task information and state in a dedicated TOML file.

- **Location:** `config/tasks.toml`
- **Structure:** The file will contain an array of tables, each representing a task.

```toml
# config/tasks.toml
# Stores configuration and state for background tasks

[[tasks]]
id = "task_cuid_1" # Unique identifier (e.g., generate using cuid)
name = "placeholder-task" # Programmatic identifier, matches definition
description = "A simple placeholder task."
schedule = "*/5 * * * *" # Cron string for frequency
is_enabled = true # Controls if the task runs on schedule
status = "IDLE" # Current status: IDLE, RUNNING, STOPPED, ERROR
last_run_at = "" # ISO 8601 timestamp string or empty
next_run_at = "" # ISO 8601 timestamp string or empty
created_at = "2023-10-27T10:00:00Z" # ISO 8601 timestamp string
updated_at = "2023-10-27T10:00:00Z" # ISO 8601 timestamp string

# Add more [[tasks]] blocks for other tasks as they are defined/discovered
```

- **Type Definition:** Define a corresponding TypeScript interface in `src/types/task.ts` or similar.

```typescript
// src/types/task.ts
export type TaskStatus = "IDLE" | "RUNNING" | "STOPPED" | "ERROR";

export interface TaskState {
  id: string;
  name: string; // Unique programmatic identifier
  description: string;
  schedule: string; // Cron string
  is_enabled: boolean;
  status: TaskStatus;
  last_run_at?: string | null; // ISO 8601 string
  next_run_at?: string | null; // ISO 8601 string
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
}

export interface TasksConfig {
  tasks: TaskState[];
}
```

## 2. TOML Configuration Utilities

As per `tomlconfig.mdc`, we need utilities to read and write TOML data. We'll use `toml` for parsing and `@iarna/toml` for writing.

- **Verify Dependencies:** Ensure `toml` and `@iarna/toml` are listed in your `package.json` and installed. If not, run `npm install toml @iarna/toml`.
- **Location:** `src/lib/config.ts` (or similar, based on `tomlconfig.mdc`)

````typescript
// src/lib/config.ts (Example structure)
import fs from 'fs/promises';
import path from 'path';
import TOML from 'toml'; // For parsing
import iarnaTOML from '@iarna/toml'; // For stringifying/writing
import { Logger } from '@/lib/logger'; // Assuming logger path
import { TasksConfig } from '@/types/task'; // Assuming type path

const TASKS_CONFIG_PATH = path.resolve(process.cwd(), 'config/tasks.toml');

// Initialize logger instance here if needed

// Consider adding a simple file lock mechanism here if concurrent writes are expected
// E.g., using a library like 'proper-lockfile'

export async function loadTasksConfig(): Promise<TasksConfig> {
  try {
    const fileContent = await fs.readFile(TASKS_CONFIG_PATH, 'utf-8');
    const parsed = TOML.parse(fileContent);
    // Add validation here (e.g., using Zod) to ensure structure matches TasksConfig
    return parsed as TasksConfig;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default structure
      return { tasks: [] };
    }
    // Log the error using the custom logger
    console.error('Failed to load tasks config:', error);
    // logger.error('Failed to load tasks config', { error });
    throw new Error('Failed to load tasks configuration.');
  }
}

export async function saveTasksConfig(config: TasksConfig): Promise<void> {
  try {
    // Add validation here before saving
    consttomlString = iarnaTOML.stringify(config);
    // Ensure config directory exists
    await fs.mkdir(path.dirname(TASKS_CONFIG_PATH), { recursive: true });
    await fs.writeFile(TASKS_CONFIG_PATH, tomlString, 'utf-8');
    // logger.info('Tasks config saved successfully.');
  } catch (error) {
    // Log the error
    console.error('Failed to save tasks config:', error);
    // logger.error('Failed to save tasks config', { error });
    throw new Error('Failed to save tasks configuration.');
  }
}

// Utility function to update a specific task (handles read-modify-write)
export async function updateTaskState(
  taskId: string,
  updates: Partial<Omit<TaskState, 'id' | 'name' | 'created_at'>>
): Promise<void> {
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    const taskIndex = config.tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      // logger.warn(`Task with id ${taskId} not found for update.`);
      console.warn(`Task with id ${taskId} not found for update.`);
      return; // Or throw an error
    }

    const updatedTask = {
      ...config.tasks[taskIndex],
      ...updates,
      updated_at: new Date().toISOString(), // Update timestamp
    };
    config.tasks[taskIndex] = updatedTask;

    await saveTasksConfig(config);
  } finally {
    // Release lock if implemented
  }
}

// Utility function to add a new task if it doesn't exist by name
export async function addOrUpdateTaskDefinition(taskInfo: Omit<TaskState, 'id' | 'created_at' | 'updated_at' | 'status' | 'last_run_at' | 'next_run_at'>): Promise<TaskState> {
   // Acquire lock if implemented
   try {
        const config = await loadTasksConfig();
        let task = config.tasks.find((t) => t.name === taskInfo.name);

        if (task) {
             // Update description and schedule if definition changed
             task.description = taskInfo.description;
             task.schedule = taskInfo.schedule;
             task.updated_at = new Date().toISOString();
        } else {
            // Add new task
            const cuid = await import('cuid'); // Dynamically import cuid or use another ID generator
            task = {
                ...taskInfo,
                id: cuid.default(),
                status: "IDLE",
                is_enabled: true, // Default to enabled? Or based on definition?
                last_run_at: null,
                next_run_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            config.tasks.push(task);
        }

        await saveTasksConfig(config);
        return task;
   } finally {
       // Release lock
   }
}

## 3. Task Definition and Discovery

- **Location:** `src/lib/tasks` (or `src/server/tasks`).
- **Interface:** Define a standard structure for tasks.
  ```typescript
  // src/lib/tasks/task.interface.ts (Example)
  import { Logger } from '@/lib/logger';

  export interface TaskDefinition {
    name: string; // Must match the 'name' in tasks.toml
    description: string;
    defaultSchedule: string; // Default cron schedule if not in TOML
    execute: (logger: Logger, taskState: TaskState) => Promise<void>; // Pass task state
  }
````

- **Discovery:** The scheduler service will dynamically import all modules from `src/lib/tasks`.

## 4. Scheduler Service

- **Library:** Use `node-cron`. Install with `npm install node-cron @types/node-cron cuid`. (Added `cuid` for ID generation, or choose another method).
- **Location:** Create `src/lib/scheduler.ts` (or `src/server/scheduler.ts`).
- **Functionality:**
  - Initialize on server startup (same serverless considerations apply).
  - Load all `TaskDefinition`s from `src/lib/tasks`.
  - For each discovered task:
    - Call `addOrUpdateTaskDefinition` to ensure an entry exists in `config/tasks.toml` with the latest description and default schedule.
  - Load the complete task list from `config/tasks.toml` using `loadTasksConfig`.
  - For each task where `is_enabled` is true in the TOML data, schedule its `execute` function using `node-cron` based on the `schedule` from the TOML data. Store cron job instances to manage them (start/stop).
  - **Execution Wrapper:** When a cron job triggers for a specific task ID:
    - Use the custom logger (`logger.mdc`).
    - Log task start.
    - Update task `status` to `RUNNING` and calculate/update `next_run_at` in `tasks.toml` using `updateTaskState`.
    - Read the latest task state from `tasks.toml` again (in case it changed) before execution.
    - Wrap the task's `execute(logger, taskState)` function in a try/catch block.
    - **On Success:**
      - Log completion.
      - Update `last_run_at` to `now()`, `status` to `IDLE` in `tasks.toml` using `updateTaskState`.
    - **On Failure:**
      - Log the error using the custom logger.
      - Update `status` to `ERROR` in `tasks.toml` using `updateTaskState`.
    - Calculate and update the `next_run_at` based on the schedule for the _next_ run after the current one finishes (this might happen before execution starts or after it finishes, depending on desired logic).
- **Management Functions:** Expose functions within the service to interact with `tasks.toml` via the utility functions:
  - `startTask(taskId: string)`: Calls `updateTaskState(taskId, { is_enabled: true })` and starts/reschedules the cron job.
  - `stopTask(taskId: string)`: Calls `updateTaskState(taskId, { is_enabled: false, status: 'STOPPED' })` and stops the active cron job.
  - `updateTaskSchedule(taskId: string, schedule: string)`: Calls `updateTaskState(taskId, { schedule: schedule })` and reschedules the cron job.
  - `getTasksStatus()`: Calls `loadTasksConfig()` to retrieve status for all tasks.

## 5. API Endpoints

- **Location:** `src/app/api/tasks/...`
- **Endpoints:** (Functionality remains similar, but implementation changes)
  - `GET /api/tasks`: Calls `schedulerService.getTasksStatus()` (which reads `tasks.toml`).
  - `POST /api/tasks/[taskId]/start`: Calls `schedulerService.startTask(taskId)`.
  - `POST /api/tasks/[taskId]/stop`: Calls `schedulerService.stopTask(taskId)`.
  - `PUT /api/tasks/[taskId]/schedule`: Calls `schedulerService.updateTaskSchedule(taskId, schedule)`.
- **Logging & Security:** Integrate the custom logger and ensure proper authentication/authorization.

## 6. User Interface

- **Location:** `src/app/settings/tasks/page.tsx`.
- **Components & Functionality:** Remains largely the same as the previous plan (using ShadCN, Tailwind). Fetches data from the updated API, displays it in a table, and provides controls (Start/Stop Switch/Button, Configure Dialog) that call the respective API endpoints. The UI will now display the `id` generated and stored in the TOML file.

## 7. Logging Integration (`logger.mdc`)

- Ensure the custom logger is used in:
  - The Scheduler Service (`scheduler.ts`).
  - TOML utility functions (`config.ts`) for errors/info.
  - Individual task `execute` functions.
  - API route handlers.

## 8. Extensibility

- To add a new task:
  1. Create `src/lib/tasks/new-task.ts` implementing `TaskDefinition`.
  2. On next server start, the scheduler service will discover it.
  3. `addOrUpdateTaskDefinition` will add a new entry to `config/tasks.toml` if the `name` doesn't exist.
  4. The task appears in the UI.

## 9. Create Documentation for Adding Tasks

- **Location:** Create a new file `docs/adding-background-tasks.md`.
- **Content:** This document should guide developers on how to add new background tasks to the system. It should cover:
  - The location for new task files (`src/lib/tasks`).
  - The requirement to implement the `TaskDefinition` interface exported from `src/lib/tasks/task.interface.ts`.
  - Explanation of each field in `TaskDefinition`:
    - `name`: Unique identifier, used in `tasks.toml`.
    - `description`: User-friendly description shown in the UI.
    - `defaultSchedule`: Initial cron schedule used when the task is first discovered.
    - `execute`: The async function containing the task logic, receiving `logger` and the current `TaskState` as arguments.
  - How to implement the `execute` function:
    - Core task logic.
    - Use the provided `logger` instance.
    - Access task-specific configuration or state via the `taskState` parameter if needed.
    - Error handling (throwing errors will be caught by the scheduler to mark the task as failed).
  - The automatic discovery process: Mention that restarting the server will make the scheduler pick up the new task and add/update its configuration in `config/tasks.toml`.
  - Management via the UI: Briefly state that the new task will appear in the Settings > Tasks page for enabling/disabling and schedule configuration.

## 10. Initial Task (Placeholder)

- The placeholder task definition remains the same conceptually, but its `execute` function now receives `taskState`.

```typescript
// src/lib/tasks/placeholder-task.ts
import { Logger } from "@/lib/logger";
import { TaskDefinition } from "./task.interface";
import { TaskState } from "@/types/task"; // Import TaskState

export const placeholderTask: TaskDefinition = {
  name: "placeholder-task",
  description: "A simple placeholder task that logs a message.",
  defaultSchedule: "*/5 * * * *", // Every 5 minutes
  execute: async (logger: Logger, taskState: TaskState) => {
    // Accept taskState
    logger.info(`Placeholder task (${taskState.id}) executed successfully.`);
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
  },
};

export default placeholderTask;
```

## 11. Considerations

- **Serverless Environments:** Same considerations apply regarding `node-cron`. Vercel Cron Jobs or alternatives might be better suited if not using a long-running server.
- **TOML Writes & Concurrency:** Writing to a single TOML file from potentially multiple concurrent operations (API requests, scheduled jobs) can lead to race conditions or data loss.
  - **Mitigation:** Implement a simple file locking mechanism (e.g., using `proper-lockfile` around read/write operations in `config.ts`) or accept the risk for simpler scenarios. This plan currently lacks explicit locking.
- **Error Handling & Validation:** Robust error handling during TOML parsing/writing and validation (e.g., using Zod within `loadTasksConfig`/`saveTasksConfig`) is crucial.
- **Security:** Ensure API endpoints are secured.

This updated plan aligns with the project's requirement to use TOML for data storage instead of Prisma and includes a step for documenting the task creation process.
