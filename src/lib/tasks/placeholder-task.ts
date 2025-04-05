// src/lib/tasks/placeholder-task.ts
// import { Logger } from "@/lib/logger"; // Assuming logger path
import { TaskState } from "@/types/task"; // Import TaskState
import { TaskDefinition } from "./task.interface";

export const placeholderTask: TaskDefinition = {
  name: "placeholder-task",
  description: "A simple placeholder task that logs a message.",
  defaultSchedule: "*/5 * * * *", // Every 5 minutes
  execute: async (/* logger: Logger, */ taskState: TaskState) => {
    // Accept taskState
    // logger.info(`Placeholder task (${taskState.id}) executed successfully.`);
    console.log(`Placeholder task (${taskState.id}) executed successfully.`); // Use console for now
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
  },
};

export default placeholderTask;
