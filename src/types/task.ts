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
