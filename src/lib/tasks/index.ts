// src/lib/tasks/index.ts
import fetchSteamGridDBArtworkTask from "./fetch-steamgriddb-artwork.task"; // Import our new task
import placeholderTask from "./placeholder-task"; // Assuming .ts extension is resolved
import syncSteamLibraryTask from "./sync-steam-library.task"; // Assuming .ts extension is resolved
import { TaskDefinition } from "./task.interface";

// Explicitly type the map for better type checking
export const taskDefinitionMap: { [key: string]: TaskDefinition } = {
  [placeholderTask.name]: placeholderTask,
  [syncSteamLibraryTask.name]: syncSteamLibraryTask,
  [fetchSteamGridDBArtworkTask.name]: fetchSteamGridDBArtworkTask, // Register our new task
};

// Optional: Export individual tasks if needed elsewhere, though map is preferred for scheduler
export { fetchSteamGridDBArtworkTask, placeholderTask, syncSteamLibraryTask };
