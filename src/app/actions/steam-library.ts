"use server";

import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";

/**
 * Server action for Steam library synchronization.
 *
 * Note: The actual synchronization logic has been moved to a scheduled task
 * that runs automatically. This action now simply returns a success message
 * informing that the sync is handled by the background task scheduler.
 *
 * @returns A response object indicating that the sync is handled by the scheduler
 */
export async function syncSteamLibrary() {
  try {
    logger.info(
      LogComponent.SYSTEM,
      "Steam library sync request received via server action"
    );

    return {
      success: true,
      message:
        "Steam library sync is handled by the background task scheduler.",
      note: "The sync operation runs automatically on a scheduled basis.",
    };
  } catch (error: unknown) {
    logger.error(
      LogComponent.SYSTEM,
      "Error in Steam library sync server action",
      error instanceof Error ? error : new Error(String(error))
    );

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: errorMessage };
  }
}
