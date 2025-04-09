// src/lib/tasks/sync-steam-library.task.ts
import { loadConfig } from "@/lib/config";
import { Logger } from "@/lib/logger/logger"; // Import Logger class/type
import { LogComponent } from "@/lib/logger/types"; // Keep LogComponent import
import { getOwnedGames } from "@/lib/steam/service";
import { SteamUserCredentials } from "@/lib/steam/types";
import { TaskState } from "@/types/task";
import iarnaTOML from "@iarna/toml";
import fs from "fs/promises";
import path from "path";
import { TaskDefinition } from "./task.interface"; // Correct interface import

export const syncSteamLibraryTask: TaskDefinition = {
  // ID is implicitly the 'name' based on the interface
  name: "sync-steam-library", // Use this as the identifier
  description:
    "Fetches owned games for all configured Steam users and saves the aggregated library to config/steam.toml.",
  defaultSchedule: "0 */12 * * *", // Twice daily by default
  is_enabled: true,
  // Correct execute signature: takes logger and taskState, returns Promise<void>
  execute: async (logger: Logger, taskState: TaskState): Promise<void> => {
    const taskId = taskState.id; // Get ID from the state passed by scheduler
    try {
      logger.info(
        LogComponent.SYSTEM,
        `Starting Steam library synchronization task`,
        { taskId }
      );

      // Load users config to get Steam credentials - with decryption enabled
      const config = loadConfig(true);

      // Initialize an object to store all users' games
      const allUserGames: Record<string, any> = {};

      // Track statistics for the result
      let totalUsers = 0;
      let successfulUsers = 0;
      let totalGames = 0;
      const errors: { username: string; error: string }[] = []; // Store errors with username

      // Process each user with Steam credentials
      for (const [username, user] of Object.entries(config.users)) {
        if (user.steam_id && user.steam_api_key) {
          totalUsers++;

          try {
            logger.info(
              LogComponent.SYSTEM,
              `Fetching Steam games for user: ${username}`,
              { taskId }
            );

            // Prepare credentials for the API call
            const credentials: SteamUserCredentials = {
              steamId: user.steam_id,
              steamApiKey: user.steam_api_key,
            };

            // Fetch games using the Steam service
            const ownedGamesResponse = await getOwnedGames(credentials);

            // Store the fetched games under the user's key
            allUserGames[username] = ownedGamesResponse;

            // Update statistics
            successfulUsers++;
            totalGames += ownedGamesResponse.game_count;

            logger.info(
              LogComponent.SYSTEM,
              `Successfully fetched ${ownedGamesResponse.game_count} games for user: ${username}`,
              { taskId }
            );
          } catch (error) {
            // Log the error but continue processing other users
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error(
              LogComponent.SYSTEM,
              `Failed to fetch Steam games for user: ${username}`,
              error instanceof Error ? error : new Error(errorMessage),
              { taskId }
            );
            errors.push({ username, error: errorMessage });
          }
        }
      }

      // Define the path for the output file
      const outputDir = path.join(process.cwd(), "config");
      const outputPath = path.join(outputDir, "steam.toml");

      // Ensure the config directory exists
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (error) {
        // Ignore if directory already exists
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error; // Re-throw if it's not an EEXIST error
        }
      }

      // Convert the data to TOML format
      const tomlString = iarnaTOML.stringify(allUserGames as any);

      // Write the TOML string to the file
      await fs.writeFile(outputPath, tomlString, "utf-8");

      const stats = {
        totalUsers,
        successfulUsers,
        totalGames,
        errorCount: errors.length,
      };

      logger.info(
        LogComponent.SYSTEM,
        `Steam library data saved to ${outputPath}`,
        { taskId, ...stats }
      );

      // Task completed successfully (even if some users failed)
      const message = `Steam sync completed. Processed ${successfulUsers}/${totalUsers} users. Total games: ${totalGames}. Errors: ${errors.length}.`;
      logger.info(LogComponent.SYSTEM, message, { taskId, stats });

      // No explicit return needed for success (Promise<void>)
      // If errors occurred for individual users, they are logged and counted.
      // If a critical error occurred (e.g., file write), it would have thrown before this point.
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        LogComponent.SYSTEM,
        "Steam library sync task failed",
        error instanceof Error ? error : new Error(errorMessage),
        { taskId }
      );

      // Re-throw the error so the scheduler can mark the task as ERRORED
      throw error;
    }
  },
};

export default syncSteamLibraryTask;
