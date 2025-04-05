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

**Remaining / Partially Done:**

- [ ] Integrate custom logger (`logger.mdc`) throughout the implementation (Scheduler, Config, Tasks, API).
- [ ] Create documentation for adding new tasks (`docs/adding-background-tasks.md`).
- [ ] Address TOML concurrency (consider file locking in `config.ts`).
- [ ] Add more robust validation (e.g., Zod for TOML config structure, cron string validation in API).
- [ ] Decide on and implement the scheduler startup mechanism (`startScheduler()` call location).
- [ ] Ensure necessary UI dependencies (`shadcn`, `sonner`) are installed and configured.

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

As per `tomlconfig.mdc`, we need utilities to read and write TOML data. We'll use `toml` for parsing and `@iarna/toml` for writing.

- **[x] Verify Dependencies:** Ensure `toml` and `@iarna/toml` are listed in your `package.json` and installed. Used `crypto.randomUUID()` instead of `cuid`.
- **[x] Location:** `src/lib/config.ts` (or similar, based on `tomlconfig.mdc`)

```typescript
// src/lib/config.ts (Example structure)
import fs from "fs/promises";
import path from "path";
import TOML from "toml"; // For parsing
import iarnaTOML from "@iarna/toml"; // For stringifying/writing
import crypto from "crypto"; // For UUID generation
// import { Logger } from '@/lib/logger'; // Assuming logger path - [ ] TODO: Integrate Logger
import { TasksConfig, TaskState } from "@/types/task"; // Assuming type path

const TASKS_CONFIG_PATH = path.resolve(process.cwd(), "config/tasks.toml");

// Initialize logger instance here if needed

// [ ] TODO: Consider adding a simple file lock mechanism here if concurrent writes are expected
// E.g., using a library like 'proper-lockfile'

export async function loadTasksConfig(): Promise<TasksConfig> {
  try {
    const fileContent = await fs.readFile(TASKS_CONFIG_PATH, {
      encoding: "utf-8",
    });
    const parsed = TOML.parse(fileContent) as unknown as TasksConfig;
    // [ ] TODO: Add validation here (e.g., using Zod) to ensure structure matches TasksConfig
    return parsed;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // File doesn't exist, return default structure
      return { tasks: [] };
    }
    // Log the error using the custom logger
    console.error("Failed to load tasks config:", error); // [ ] TODO: Replace with logger
    // logger.error('Failed to load tasks config', { error });
    throw new Error("Failed to load tasks configuration.");
  }
}

export async function saveTasksConfig(config: TasksConfig): Promise<void> {
  try {
    // [ ] TODO: Add validation here before saving
    const tomlString = iarnaTOML.stringify(config as any);
    // Ensure config directory exists
    await fs.mkdir(path.dirname(TASKS_CONFIG_PATH), { recursive: true });
    await fs.writeFile(TASKS_CONFIG_PATH, tomlString, { encoding: "utf-8" });
    // logger.info('Tasks config saved successfully.'); // [ ] TODO: Add logging
  } catch (error) {
    // Log the error
    console.error("Failed to save tasks config:", error); // [ ] TODO: Replace with logger
    // logger.error('Failed to save tasks config', { error });
    throw new Error("Failed to save tasks configuration.");
  }
}

// Utility function to update a specific task (handles read-modify-write)
export async function updateTaskState(
  taskId: string,
  updates: Partial<Omit<TaskState, "id" | "name" | "created_at">>
): Promise<void> {
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    const taskIndex = config.tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      // logger.warn(`Task with id ${taskId} not found for update.`); // [ ] TODO: Add logging
      console.warn(`Task with id ${taskId} not found for update.`); // [ ] TODO: Replace with logger
      throw new Error(`Task with id ${taskId} not found for update.`); // Throw error to signal failure
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
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    let task = config.tasks.find((t) => t.name === taskInfo.name);
    const now = new Date().toISOString();
    let updated = false;

    if (task) {
      // Update description and schedule if definition changed
      if (
        task.description !== taskInfo.description ||
        task.schedule !== taskInfo.schedule ||
        task.is_enabled !== taskInfo.is_enabled
      ) {
        task.description = taskInfo.description;
        task.schedule = taskInfo.schedule;
        task.is_enabled = taskInfo.is_enabled;
        task.updated_at = now;
        updated = true;
      }
    } else {
      // Add new task
      task = {
        ...taskInfo,
        id: crypto.randomUUID(), // Use crypto.randomUUID()
        status: "IDLE",
        // is_enabled is part of taskInfo now
        last_run_at: null,
        next_run_at: null, // Will be calculated by scheduler
        created_at: now,
        updated_at: now,
      };
      config.tasks.push(task);
      updated = true;
    }

    if (updated) {
      await saveTasksConfig(config);
    }
    return task;
  } finally {
    // Release lock
  }
}
```

## 3. Task Definition and Discovery [x]

- **[x] Location:** `src/lib/tasks`.
- **[x] Interface:** Defined a standard structure for tasks in `src/lib/tasks/task.interface.ts`.

  ```typescript
  // src/lib/tasks/task.interface.ts
  // import { Logger } from '@/lib/logger'; // [ ] TODO: Integrate Logger
  import { TaskState } from "@/types/task";

  export interface TaskDefinition {
    name: string; // Must match the 'name' in tasks.toml
    description: string;
    defaultSchedule: string; // Default cron schedule if not in TOML
    is_enabled: boolean; // Default enabled state on discovery
    execute: (/* logger: Logger, */ taskState: TaskState) => Promise<void>; // [ ] TODO: Pass Logger
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
  - **[x] Execution Wrapper:** Handles logging (placeholders), status updates (`RUNNING`, `IDLE`, `ERROR`), error catching, `last_run_at`, `next_run_at` updates via `updateTaskState`.
  - **[ ] Logging:** Needs integration of the custom logger.
- **[x] Management Functions:** Exposed functions:
  - `startScheduler()`
  - `stopScheduler()`
  - `startTask(taskId: string)`
  - `stopTask(taskId: string)`
  - `updateTaskSchedule(taskId: string, schedule: string)`
  - `getTasksStatus()`

## 5. API Endpoints [x/]

- **[x] Location:** `src/app/api/tasks/...`
- **[x] Endpoints:**
  - `GET /api/tasks`
  - `POST /api/tasks/[taskId]/start`
  - `POST /api/tasks/[taskId]/stop`
  - `PUT /api/tasks/[taskId]/schedule`
- **[x] Security:** Implemented authentication/authorization checks using `getServerSession` and admin role verification.
- **[ ] Logging:** Needs integration of the custom logger (placeholders added).

## 6. User Interface [x]

- **[x] Location:** `src/app/settings/tasks/page.tsx` and `src/app/settings/tasks/_components/task-list-client.tsx`.
- **[x] Components & Functionality:** Implemented using ShadCN Table, Switch, Dialog, Button, Badge. Fetches data, displays list, provides controls (Start/Stop Switch, Configure Dialog) calling respective APIs. Uses `Suspense` for loading.
- **[x] Layout:** Integrated with `PageLayout`.
- **[ ] Dependencies:** Requires confirmation that `shadcn/ui` components and `sonner` are installed/configured.

## 7. Logging Integration (`logger.mdc`) [ ]

- **[ ] TODO:** Ensure the custom logger is implemented and integrated in:
  - The Scheduler Service (`scheduler.ts`).
  - TOML utility functions (`config.ts`).
  - Individual task `execute` functions.
  - API route handlers.

## 8. Extensibility [x]

- **[x] Design:** Adding a new task involves creating a file in `src/lib/tasks` implementing `TaskDefinition`. The scheduler discovers it automatically.

## 9. Create Documentation for Adding Tasks [ ]

- **[ ] TODO:** Create `docs/adding-background-tasks.md`.
- **[ ] TODO:** Content should guide developers on creating new task files, implementing `TaskDefinition`, the `execute` function, automatic discovery, and UI management.

## 10. Initial Task (Placeholder) [x]

- **[x]** Created `src/lib/tasks/placeholder-task.ts` implementing `TaskDefinition`.

```typescript
// src/lib/tasks/placeholder-task.ts
// import { Logger } from "@/lib/logger"; // [ ] TODO: Integrate Logger
import { TaskDefinition } from "./task.interface";
import { TaskState } from "@/types/task";

export const placeholderTask: TaskDefinition = {
  name: "placeholder-task",
  description: "A simple placeholder task that logs a message.",
  defaultSchedule: "*/5 * * * *", // Every 5 minutes
  is_enabled: true, // Default enabled state
  execute: async (/* logger: Logger, */ taskState: TaskState) => {
    // [ ] TODO: Use Logger
    console.log(`Placeholder task (${taskState.id}) executed successfully.`); // [ ] TODO: Replace with logger
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
