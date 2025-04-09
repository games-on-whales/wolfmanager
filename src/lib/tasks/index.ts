// src/lib/tasks/index.ts
import placeholderTask from "./placeholder-task"; // Assuming .ts extension is resolved
import syncSteamLibraryTask from "./sync-steam-library.task"; // Assuming .ts extension is resolved
import { TaskDefinition } from "./task.interface";

// Explicitly type the map for better type checking
export const taskDefinitionMap: { [key: string]: TaskDefinition } = {
  [placeholderTask.name]: placeholderTask,
  [syncSteamLibraryTask.name]: syncSteamLibraryTask,
};

// Optional: Export individual tasks if needed elsewhere, though map is preferred for scheduler
export { placeholderTask, syncSteamLibraryTask };
