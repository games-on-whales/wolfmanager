// src/lib/tasks/task.interface.ts
import { Logger } from "@/lib/logger/logger"; // Import Logger
import { TaskState } from "@/types/task"; // Import TaskState

export interface TaskDefinition {
  name: string; // Must match the 'name' in tasks.toml
  description: string;
  defaultSchedule: string; // Default cron schedule if not in TOML
  is_enabled: boolean; // Default enabled state on discovery
  execute: (logger: Logger, taskState: TaskState) => Promise<void>; // Pass logger and task state
}
