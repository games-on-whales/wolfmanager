import { type ApiResponse } from "@/lib/api-utils";
import { wolfPairApi } from "@/lib/api/wolf-pair";
import { LogComponent, logger } from "@/lib/logger";

// NOTE: The core pairing and unpairing logic has been moved to Server Actions in src/app/clients/actions.ts.
// This service file now primarily provides utility functions that might still be needed elsewhere,
// or serves as a placeholder if other service methods are added later.
// The methods pairDevice, removeClientFromUser, and getClientsWithOwners
// previously here now call the corresponding Server Actions directly.

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const UserService = {
  /**
   * Get paired clients directly from the Wolf API via wolfPairApi.
   * NOTE: This likely returns raw client data from the server, potentially without user association.
   * This method remains here as it might be used by other parts of the application
   * that need direct API access without user context.
   */
  async getApiClients(
    retryCount = 0
  ): Promise<ApiResponse<{ clients: any[] }>> {
    try {
      const clients = await wolfPairApi.getClients(); // Assuming this fetches from /clients
      await logger.debug(
        LogComponent.WOLF_UI,
        "Fetched clients via wolfPairApi",
        { count: clients?.length ?? 0 }
      );
      return {
        success: true,
        data: {
          clients,
        },
      };
    } catch (error) {
      await logger.error(
        LogComponent.WOLF_UI,
        "Failed to get API clients via wolfPairApi",
        {
          error: error instanceof Error ? error : new Error(String(error)),
        }
      );
      return {
        success: false,
        error: {
          message: "Failed to get clients from API",
          code: "GET_CLIENTS_ERROR",
        },
      };
    }
  },

  // The methods pairDevice, removeClientFromUser, and getClientsWithOwners
  // were moved or refactored to call Server Actions directly from the client component.
  // They are removed from this service to avoid redundancy and confusion.
};
