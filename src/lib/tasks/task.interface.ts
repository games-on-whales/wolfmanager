// src/lib/tasks/task.interface.ts
// import { Logger } from '@/lib/logger'; // Assuming logger path - uncomment when logger is available
import { TaskState } from "@/types/task"; // Import TaskState

export interface TaskDefinition {
  name: string; // Must match the 'name' in tasks.toml
  description: string;
  defaultSchedule: string; // Default cron schedule if not in TOML
  execute: (/* logger: Logger, */ taskState: TaskState) => Promise<void>; // Pass task state, uncomment logger when ready
}
