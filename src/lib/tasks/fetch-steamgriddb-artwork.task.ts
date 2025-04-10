// src/lib/tasks/fetch-steamgriddb-artwork.task.ts
import { loadConfig } from "@/lib/config"; // Import loadConfig function
import { Logger } from "@/lib/logger/logger";
import { LogComponent } from "@/lib/logger/types";
import { getAndStoreSteamArtwork } from "@/lib/steamgriddb/client"; // Import the client library
import { TaskState } from "@/types/task";
import iarnaTOML from "@iarna/toml";
import fs from "fs/promises";
import path from "path";
// Use global fetch instead of undici to avoid compatibility issues
import { TaskDefinition } from "./task.interface";

// Define types needed for the task
// Only need to fetch grid artwork (600x900) as per user requirement
interface SteamGridDbImage {
  id: number;
  score: number;
  style: string;
  url: string;
  thumb: string;
  tags: string[];
  // Add other fields if needed for selection logic
}
// --- End Client Types ---

export const fetchSteamGridDBArtworkTask: TaskDefinition = {
  name: "fetch-steamgriddb-artwork",
  description:
    "Fetches game grid artwork (600x900) from SteamGridDB for the library.",
  defaultSchedule: "0 3 * * *", // 3 AM daily
  is_enabled: true, // Enabled by default
  execute: async (logger: Logger, taskState: TaskState): Promise<void> => {
    const taskId = taskState.id;
    logger.info(
      LogComponent.SYSTEM,
      `Starting SteamGridDB artwork fetch task`,
      { taskId }
    );

    try {
      // 1. Check Prerequisites - Load configuration directly
      logger.info(
        LogComponent.SYSTEM,
        "Checking SteamGridDB settings via direct config reading...",
        { taskId }
      );

      // Load the configuration directly with decryption enabled
      const config = loadConfig(true);

      // Get the SteamGridDB configuration
      const steamGridDbConfig = config.metadataProviders?.steamgridDb;

      // Check if SteamGridDB integration is enabled
      if (!steamGridDbConfig?.enabled) {
        logger.info(
          LogComponent.SYSTEM,
          "SteamGridDB integration is disabled in configuration. Skipping artwork fetch.",
          { taskId }
        );
        return;
      }

      // Check if the API key is set
      if (!steamGridDbConfig?.apiKey) {
        logger.warn(
          LogComponent.SYSTEM,
          "SteamGridDB API key is not configured in configuration. Skipping artwork fetch.",
          { taskId }
        );
        return;
      }

      logger.debug(
        LogComponent.SYSTEM,
        `Config check successful: SteamGridDB integration is enabled and API key is set`,
        { taskId }
      );

      // We don't need to extract the API key here as we'll use the API for authentication

      // 2. Get Game Library
      logger.info(
        LogComponent.SYSTEM,
        "Loading game library from config/steam.toml...",
        { taskId }
      );
      const steamTomlPath = path.join(process.cwd(), "config", "steam.toml");
      let libraryGames: { appid: number; name: string }[] = [];
      let parsedToml: any = {}; // Declare parsedToml outside the try block
      try {
        const steamTomlContent = await fs.readFile(steamTomlPath, "utf-8");
        parsedToml = iarnaTOML.parse(steamTomlContent); // Assign inside the try block

        // Extract unique AppIDs and their names
        const uniqueGamesMap = new Map<number, { name: string }>();
        for (const username in parsedToml) {
          const userLibrary = (parsedToml as any)[username];
          if (userLibrary && Array.isArray(userLibrary.games)) {
            userLibrary.games.forEach((game: any) => {
              // Ensure appid is a number and name is a string
              const appIdNum = Number(game.appid);
              if (
                !isNaN(appIdNum) &&
                appIdNum > 0 &&
                !uniqueGamesMap.has(appIdNum)
              ) {
                uniqueGamesMap.set(appIdNum, {
                  name: String(game.name || `AppID ${appIdNum}`),
                });
              }
            });
          }
        }
        const uniqueGames = Array.from(uniqueGamesMap.entries()).map(
          ([appid, data]) => ({ appid, name: data.name })
        );

        logger.info(
          LogComponent.SYSTEM,
          `Found ${uniqueGames.length} unique games across all users.`,
          { taskId }
        );
        libraryGames = uniqueGames; // Use the unique list
      } catch (error: any) {
        if (error.code === "ENOENT") {
          logger.warn(
            LogComponent.SYSTEM,
            "Steam library file (config/steam.toml) not found. Cannot get game list. Run 'sync-steam-library' task first?",
            { taskId }
          );
          return; // Cannot proceed without library
        }
        logger.error(
          LogComponent.SYSTEM,
          "Failed to load or parse game library (config/steam.toml)",
          error,
          { taskId }
        );
        throw error; // Re-throw critical error
      }

      if (libraryGames.length === 0) {
        logger.info(
          LogComponent.SYSTEM,
          "No games found in the library to fetch artwork for.",
          { taskId }
        );
        return;
      }

      // 3. Prepare Asset Directory
      // Use absolute paths for reliability
      const assetsBaseDir = path.resolve(process.cwd(), "config", "assets");
      const gridsDir = path.join(assetsBaseDir, "grids");

      try {
        await fs.mkdir(gridsDir, { recursive: true });
      } catch (error) {
        logger.error(
          LogComponent.SYSTEM,
          "Failed to create asset directories",
          error,
          { taskId }
        );
        throw error; // Cannot proceed without directories
      }

      // 4. Iterate and Fetch Artwork

      // We'll use the client library instead of implementing our own logic

      // --- Main Loop ---
      let successCount = 0;
      let errorCount = 0;

      for (const game of libraryGames) {
        const appId = game.appid;
        const gameName = game.name;

        logger.info(
          LogComponent.SYSTEM,
          `Processing artwork for ${gameName} (AppID: ${appId})`,
          { taskId }
        );

        try {
          // Use the client library to fetch and store artwork
          // Use the client library to fetch and store artwork
          logger.debug(
            LogComponent.SYSTEM,
            `Calling getAndStoreSteamArtwork for AppID: ${appId}`,
            { taskId }
          );
          const storedPaths = await getAndStoreSteamArtwork(appId.toString());
          logger.debug(
            LogComponent.SYSTEM,
            `Result from getAndStoreSteamArtwork for AppID ${appId}: ${JSON.stringify(
              storedPaths
            )}`,
            { taskId }
          );

          // Check if grid artwork was stored and update steam.toml data
          if (storedPaths.grid) {
            successCount++;
            logger.info(
              LogComponent.SYSTEM,
              `Successfully processed artwork for ${gameName} (AppID: ${appId})`,
              { taskId, storedPaths }
            );

            // Find the game in the parsedToml data and add the path
            let gameUpdated = false;
            for (const username in parsedToml) {
              const userLibrary = (parsedToml as any)[username];
              if (userLibrary && Array.isArray(userLibrary.games)) {
                const gameIndex = userLibrary.games.findIndex(
                  (g: any) => g.appid === appId
                );
                if (gameIndex !== -1) {
                  userLibrary.games[gameIndex].grid_artwork_path =
                    storedPaths.grid;
                  gameUpdated = true;
                  // Assuming appid is unique across users for this update logic
                  // If not, we might need to break or collect all updates
                }
              }
            }
            if (!gameUpdated) {
              logger.warn(
                LogComponent.SYSTEM,
                `Could not find game ${appId} in parsed steam.toml to update artwork path.`,
                { taskId }
              );
            }
          } else {
            // No artwork found or stored, but not necessarily an error from the client's perspective
            logger.info(
              LogComponent.SYSTEM,
              `No new artwork stored for ${gameName} (AppID: ${appId}). This could be because none was found or an error occurred during download/save (check client logs).`,
              { taskId }
            );
            // Consider if this should still count as success or if we need more info from the client
            successCount++; // For now, count as success if client doesn't throw
          }
        } catch (error: any) {
          // Error during processing
          errorCount++;
          logger.error(
            LogComponent.SYSTEM,
            `Error processing artwork for ${gameName} (AppID: ${appId})`,
            error,
            { taskId }
          );
        }
      } // End of game processing loop

      // 5. Log Completion Summary
      logger.info(
        LogComponent.SYSTEM,
        `SteamGridDB artwork fetch task finished. Processed: ${libraryGames.length} games. Successful: ${successCount}, Errors: ${errorCount}.`,
        { taskId }
      );

      // --- Step 6: Write Updated TOML Data Back to File ---
      try {
        const updatedTomlString = iarnaTOML.stringify(parsedToml);
        await fs.writeFile(steamTomlPath, updatedTomlString);
        logger.info(
          LogComponent.SYSTEM,
          `Successfully updated ${steamTomlPath} with artwork paths.`,
          { taskId }
        );
      } catch (error: any) {
        logger.error(
          LogComponent.SYSTEM,
          `Failed to write updated steam.toml file: ${error.message}`,
          { taskId }
        );
        // Consider this a non-critical error for now, task summary already logged
      }
    } catch (error: unknown) {
      // This is the main catch block for the execute function
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        LogComponent.SYSTEM,
        "SteamGridDB artwork fetch task failed critically",
        error instanceof Error ? error : new Error(errorMessage),
        { taskId }
      );
      // Re-throw the error so the scheduler marks the task as ERRORED
      throw error;
    }
  },
};

export default fetchSteamGridDBArtworkTask;
