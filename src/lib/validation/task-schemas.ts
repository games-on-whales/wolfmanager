// src/lib/validation/task-schemas.ts
import { CronExpressionParser } from "cron-parser"; // Correct import from user example
import { z } from "zod";
// Schema for TaskStatus enum
export const TaskStatusSchema = z.enum(["IDLE", "RUNNING", "STOPPED", "ERROR"]);

// Function to validate cron expression
const isValidCron = (cron: string): boolean => {
  try {
    CronExpressionParser.parse(cron); // Correct usage from user example
    return true;
  } catch (e) {
    return false;
  }
};

// Schema for TaskState interface
export const TaskStateSchema = z.object({
  id: z.string().uuid({ message: "Invalid task ID format (must be UUID)" }), // Revert to UUID validation
  name: z.string().min(1, { message: "Task name cannot be empty" }),
  description: z.string(),
  schedule: z
    .string()
    .min(1, { message: "Schedule cannot be empty" })
    .refine(isValidCron, {
      message: "Invalid cron schedule format",
    }),
  is_enabled: z.boolean(),
  status: TaskStatusSchema,
  // ISO 8601 format validation
  last_run_at: z
    .string()
    .datetime({
      offset: true,
      message: "Invalid ISO 8601 format for last_run_at",
    })
    .nullable()
    .optional(),
  next_run_at: z
    .string()
    .datetime({
      offset: true,
      message: "Invalid ISO 8601 format for next_run_at",
    })
    .nullable()
    .optional(),
  created_at: z.string().datetime({
    offset: true,
    message: "Invalid ISO 8601 format for created_at",
  }),
  updated_at: z.string().datetime({
    offset: true,
    message: "Invalid ISO 8601 format for updated_at",
  }),
});

// Schema for TasksConfig interface (the structure of tasks.toml)
export const TasksConfigSchema = z.object({
  tasks: z.array(TaskStateSchema),
});

// Schema for updating the schedule via API
export const UpdateTaskScheduleSchema = z.object({
  schedule: z
    .string()
    .min(1, { message: "Schedule cannot be empty" })
    .refine(isValidCron, {
      message: "Invalid cron schedule format",
    }),
});

// Infer TypeScript types from schemas if needed elsewhere
export type TaskStateInput = z.input<typeof TaskStateSchema>;
export type TaskStateOutput = z.output<typeof TaskStateSchema>;
export type TasksConfigInput = z.input<typeof TasksConfigSchema>;
export type TasksConfigOutput = z.output<typeof TasksConfigSchema>;
export type UpdateTaskScheduleInput = z.input<typeof UpdateTaskScheduleSchema>;
