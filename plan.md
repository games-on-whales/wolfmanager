# Implementation Plan: Background Task Runner

This plan outlines the steps to implement a background task runner feature within the Next.js application, adhering to the project's technology stack and guidelines, specifically using TOML for data persistence as per `tomlconfig.mdc`.

## Status Summary (as of last update)

**Completed:**

- Core TOML data structure and types.
- TOML configuration utilities (`load`, `save`, `update`, `addOrUpdate`).
- Task definition interface and placeholder task.
- Scheduler service implementation (`node-cron`, `cron-parser`, task discovery, execution wrapper, basic management functions).
- API Endpoints (`GET /tasks`, `POST /[taskId]/start`, `POST /[taskId]/stop`, `PUT /[taskId]/schedule`).
- Basic UI page (`/settings/tasks`) and client component for task listing and interaction.
- Page layout consistency using `PageLayout`.
- Authentication checks on the page and API routes.
- Custom logger integrated into Config, Scheduler, API routes, and Task execution.
- Added "Background Tasks" link to the main settings page under Admin Settings.

**Remaining / Partially Done:**

- [ ] Create documentation for adding new tasks (`docs/adding-background-tasks.md`).
- [ ] Address TOML concurrency (consider file locking in `config.ts`).
- [ ] Add more robust validation (e.g., Zod for TOML config structure, improved cron validation in API schedule endpoint).
- [ ] Decide on and implement the scheduler startup mechanism (`startScheduler()` call location).

---

## 1. TOML Data Structure for Tasks [x]

Instead of a database, we will store task information and state in a dedicated TOML file.

- **[x] Location:** `config/tasks.toml`
- **[x] Structure:** The file will contain an array of tables, each representing a task.

```toml
# config/tasks.toml
# Stores configuration and state for background tasks

[[tasks]]
id = "task_uuid_1" # Unique identifier (e.g., crypto.randomUUID())
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

- **[x] Type Definition:** Define a corresponding TypeScript interface in `src/types/task.ts` or similar.

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

## 2. TOML Configuration Utilities [x]

As per `tomlconfig.mdc`, we need utilities to read and write TOML data. We'll use `toml` for parsing and `@iarna/toml` for writing. Custom logger integrated.

- **[x] Verify Dependencies:** Ensure `toml` and `@iarna/toml` are listed in your `package.json` and installed. Used `crypto.randomUUID()` instead of `cuid`.
- **[x] Location:** `src/lib/config.ts` (or similar, based on `tomlconfig.mdc`)

```typescript
// src/lib/config.ts (Example structure)
import fs from "fs/promises";
import path from "path";
import TOML from "toml"; // For parsing
import iarnaTOML from "@iarna/toml"; // For stringifying/writing
import crypto from "crypto"; // For UUID generation
import { Logger } from "@/lib/logger/logger"; // Assuming logger path
import { LogComponent } from "@/lib/logger/types";
import { TasksConfig, TaskState } from "@/types/task"; // Assuming type path

const TASKS_CONFIG_PATH = path.resolve(process.cwd(), "config/tasks.toml");

const logger = Logger.getInstance();

// [ ] TODO: Consider adding a simple file lock mechanism here if concurrent writes are expected
// E.g., using a library like 'proper-lockfile'

export async function loadTasksConfig(): Promise<TasksConfig> {
  logger.debug(LogComponent.SYSTEM, "Attempting to load tasks configuration.", {
    path: TASKS_CONFIG_PATH,
  });
  try {
    const fileContent = await fs.readFile(TASKS_CONFIG_PATH, {
      encoding: "utf-8",
    });
    const parsed = TOML.parse(fileContent) as unknown as TasksConfig;
    // [ ] TODO: Add validation here (e.g., using Zod) to ensure structure matches TasksConfig
    logger.info(
      LogComponent.SYSTEM,
      "Tasks configuration loaded successfully.",
      { path: TASKS_CONFIG_PATH, taskCount: parsed.tasks?.length ?? 0 }
    );
    return parsed;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      logger.warn(
        LogComponent.SYSTEM,
        "Tasks config file not found, returning default empty structure.",
        { path: TASKS_CONFIG_PATH }
      );
      return { tasks: [] };
    }
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load tasks configuration.",
      error instanceof Error ? error : new Error(String(error)),
      { path: TASKS_CONFIG_PATH }
    );
    throw new Error("Failed to load tasks configuration.");
  }
}

export async function saveTasksConfig(config: TasksConfig): Promise<void> {
  logger.debug(LogComponent.SYSTEM, "Attempting to save tasks configuration.", {
    path: TASKS_CONFIG_PATH,
    taskCount: config.tasks?.length ?? 0,
  });
  try {
    // [ ] TODO: Add validation here before saving
    const tomlString = iarnaTOML.stringify(config as any);
    await fs.mkdir(path.dirname(TASKS_CONFIG_PATH), { recursive: true });
    await fs.writeFile(TASKS_CONFIG_PATH, tomlString, { encoding: "utf-8" });
    logger.info(
      LogComponent.SYSTEM,
      "Tasks configuration saved successfully.",
      { path: TASKS_CONFIG_PATH }
    );
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to save tasks configuration.",
      error instanceof Error ? error : new Error(String(error)),
      { path: TASKS_CONFIG_PATH }
    );
    throw new Error("Failed to save tasks configuration.");
  }
}

// Utility function to update a specific task (handles read-modify-write)
export async function updateTaskState(
  taskId: string,
  updates: Partial<Omit<TaskState, "id" | "name" | "created_at">>
): Promise<void> {
  logger.debug(LogComponent.SYSTEM, "Attempting to update task state.", {
    taskId,
    updates,
  });
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    const taskIndex = config.tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      logger.warn(
        LogComponent.SYSTEM,
        `Task with id ${taskId} not found for update.`
      );
      return;
    }

    const updatedTask = {
      ...config.tasks[taskIndex],
      ...updates,
      updated_at: new Date().toISOString(), // Update timestamp
    };
    config.tasks[taskIndex] = updatedTask;

    await saveTasksConfig(config);
    logger.info(LogComponent.SYSTEM, "Task state updated successfully.", {
      taskId,
    });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update task state.",
      error instanceof Error ? error : new Error(String(error)),
      { taskId, updates }
    );
    throw error;
  } finally {
    // Release lock if implemented
  }
}

// Utility function to add a new task definition or update an existing one by name
export async function addOrUpdateTaskDefinition(
  taskInfo: Omit<
    TaskState,
    | "id"
    | "created_at"
    | "updated_at"
    | "status"
    | "last_run_at"
    | "next_run_at"
  >
): Promise<TaskState> {
  logger.debug(
    LogComponent.SYSTEM,
    "Attempting to add or update task definition.",
    { taskName: taskInfo.name }
  );
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    let task = config.tasks.find((t) => t.name === taskInfo.name);
    const now = new Date().toISOString();
    let updated = false;
    let action: "added" | "updated" | "nochange" = "nochange";

    if (task) {
      logger.debug(LogComponent.SYSTEM, "Found existing task definition.", {
        taskName: taskInfo.name,
        taskId: task.id,
      });
      if (
        task.description !== taskInfo.description ||
        task.schedule !== taskInfo.schedule ||
        task.is_enabled !== taskInfo.is_enabled
      ) {
        logger.info(LogComponent.SYSTEM, "Updating task definition.", {
          /* changes */
        });
        task.description = taskInfo.description;
        task.schedule = taskInfo.schedule;
        task.is_enabled = taskInfo.is_enabled;
        task.updated_at = now;
        updated = true;
        action = "updated";
      } else {
        logger.debug(
          LogComponent.SYSTEM,
          "No changes detected in existing task definition.",
          { taskName: taskInfo.name }
        );
      }
    } else {
      const newTaskId = crypto.randomUUID();
      logger.info(LogComponent.SYSTEM, "Adding new task definition.", {
        taskName: taskInfo.name,
        newTaskId,
      });
      task = {
        ...taskInfo,
        id: newTaskId,
        status: "IDLE",
        last_run_at: null,
        next_run_at: null,
        created_at: now,
        updated_at: now,
      };
      config.tasks.push(task);
      updated = true;
      action = "added";
    }

    if (updated) {
      await saveTasksConfig(config);
      logger.info(
        LogComponent.SYSTEM,
        `Task definition ${action} and config saved.`,
        { taskName: taskInfo.name, taskId: task.id }
      );
    }
    if (!task)
      throw new Error(
        `Failed to retrieve task object after ${action} operation for ${taskInfo.name}`
      );
    return task;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to add or update task definition.",
      error instanceof Error ? error : new Error(String(error)),
      { taskName: taskInfo.name }
    );
    throw error;
  } finally {
    // Release lock
  }
}
```

## 3. Task Definition and Discovery [x]

- **[x] Location:** `src/lib/tasks`.
- **[x] Interface:** Defined a standard structure for tasks in `src/lib/tasks/task.interface.ts`. Logger added to signature.

  ```typescript
  // src/lib/tasks/task.interface.ts
  import { Logger } from "@/lib/logger/logger";
  import { TaskState } from "@/types/task";

  export interface TaskDefinition {
    name: string;
    description: string;
    defaultSchedule: string;
    is_enabled: boolean;
    execute: (logger: Logger, taskState: TaskState) => Promise<void>; // Logger passed
  }
  ```

- **[x] Discovery:** The scheduler service dynamically imports modules from `src/lib/tasks`.

## 4. Scheduler Service [x]

- **[x] Library:** Used `node-cron` and `cron-parser`. Installed dependencies.
- **[x] Location:** Created `src/lib/scheduler.ts`.
- **[x] Functionality:**
  - [x] Initialize on server startup (manual call to `startScheduler()` needed - **[ ] TODO: Decide Location**).
  - [x] Load all `TaskDefinition`s from `src/lib/tasks`.
  - [x] Call `addOrUpdateTaskDefinition` to sync definitions with `config/tasks.toml`.
  - [x] Load the complete task list from `config/tasks.toml` using `loadTasksConfig`.
  - [x] Schedule enabled tasks using `node-cron` and `cron-parser` for next run calculation.
  - [x] Store/manage active cron job instances.
  - **[x] Execution Wrapper:** Handles logging, status updates (`RUNNING`, `IDLE`, `ERROR`), error catching, `last_run_at`, `next_run_at` updates via `updateTaskState`. Logger is passed to task `execute` function.
  - **[x] Logging:** Integrated custom logger.
- **[x] Management Functions:** Exposed functions:
  - `startScheduler()`
  - `stopScheduler()`
  - `startTask(taskId: string)`
  - `stopTask(taskId: string)`
  - `updateTaskSchedule(taskId: string, schedule: string)`
  - `getTasksStatus()`

## 5. API Endpoints [x]

- **[x] Location:** `src/app/api/tasks/...`
- **[x] Endpoints:**
  - `GET /api/tasks`
  - `POST /api/tasks/[taskId]/start`
  - `POST /api/tasks/[taskId]/stop`
  - `PUT /api/tasks/[taskId]/schedule`
- **[x] Security:** Implemented authentication/authorization checks using `getServerSession` and admin role verification.
- **[x] Logging:** Integrated custom logger.

## 6. User Interface [x]

- **[x] Location:** `src/app/settings/tasks/page.tsx` and `src/app/settings/tasks/_components/task-list-client.tsx`.
- **[x] Components & Functionality:** Implemented using ShadCN Table, Switch, Dialog, Button, Badge. Fetches data, displays list, provides controls (Start/Stop Switch, Configure Dialog) calling respective APIs. Uses `Suspense` for loading.
- **[x] Layout:** Integrated with `PageLayout`.
- **[ ] Dependencies:** Requires confirmation that `shadcn/ui` components and `sonner` are installed/configured.

## 7. Logging Integration (`logger.mdc`) [x]

- **[x] Integrated:** Custom logger implemented and integrated in:
  - The Scheduler Service (`scheduler.ts`).
  - TOML utility functions (`config.ts`).
  - Individual task `execute` functions (via signature update and scheduler pass-through).
  - API route handlers.

## 8. Extensibility [x]

- **[x] Design:** Adding a new task involves creating a file in `src/lib/tasks` implementing `TaskDefinition`. The scheduler discovers it automatically.

## 9. Create Documentation for Adding Tasks [ ]

- **[ ] TODO:** Create `docs/adding-background-tasks.md`.
- **[ ] TODO:** Content should guide developers on creating new task files, implementing `TaskDefinition`, the `execute` function, automatic discovery, and UI management.

## 10. Initial Task (Placeholder) [x]

- **[x]** Created `src/lib/tasks/placeholder-task.ts` implementing `TaskDefinition`. Logger integrated.

```typescript
// src/lib/tasks/placeholder-task.ts
import { Logger } from "@/lib/logger/logger";
import { LogComponent } from "@/lib/logger/types";
import { TaskState } from "@/types/task";
import { TaskDefinition } from "./task.interface";

export const placeholderTask: TaskDefinition = {
  name: "placeholder-task",
  description: "A simple placeholder task that logs a message.",
  defaultSchedule: "*/5 * * * *",
  is_enabled: true,
  execute: async (logger: Logger, taskState: TaskState) => {
    logger.info(
      LogComponent.WOLF_SERVER,
      `Placeholder task starting execution.`,
      { taskId: taskState.id }
    );
    try {
      logger.debug(LogComponent.WOLF_SERVER, `Simulating work...`, {
        taskId: taskState.id,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      logger.info(
        LogComponent.WOLF_SERVER,
        `Placeholder task finished successfully.`,
        { taskId: taskState.id }
      );
    } catch (error) {
      logger.error(
        LogComponent.WOLF_SERVER,
        `Placeholder task failed during execution.`,
        error instanceof Error ? error : new Error(String(error)),
        { taskId: taskState.id }
      );
      throw error;
    }
  },
};

export default placeholderTask;
```

## 11. Considerations [/]

- **[ ] Serverless Environments:** Needs evaluation. `node-cron` is not suitable. Vercel Cron Jobs or alternatives might be needed.
- **[ ] TOML Writes & Concurrency:** Potential race conditions exist. **TODO:** Implement file locking (e.g., `proper-lockfile`) in `config.ts` or accept risk.
- **[ ] Error Handling & Validation:** **TODO:** Add more robust validation (Zod for `loadTasksConfig`/`saveTasksConfig`, cron validation in API?).
- **[x] Security:** API endpoints secured via session/role checks.
- **[ ] Scheduler Startup:** **TODO:** Decide where to call `startScheduler()` in the Next.js lifecycle.

This updated plan aligns with the project's requirement to use TOML for data storage instead of Prisma and includes a step for documenting the task creation process.
