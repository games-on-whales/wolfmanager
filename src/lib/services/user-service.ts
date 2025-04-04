import {
  listClientsAndOwners,
  pairAndAddClientAction,
  removeClientAction,
} from "@/app/pair/actions"; // Import server actions

import {
  API_ERROR_CODES,
  createErrorResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { wolfPairApi } from "@/lib/api/wolf-pair";
import { LogComponent, logger } from "@/lib/logger";
import { ClientDevice } from "@/types/client"; // Import ClientDevice type

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const UserService = {
  /**
   * Pair a device and add it to the user's config by calling the server action.
   *
   * This replaces the separate verifyPIN and addClientToUser methods.
   */
  async pairDevice(
    pin: string,
    friendlyName: string,
    pair_secret: string
  ): Promise<ApiResponse<{ client: ClientDevice }>> {
    try {
      console.log("[UserService] Attempting to pair device:", {
        friendlyName,
        pinLength: pin.length, // Still useful to log pin length
      });

      // Call the consolidated server action
      const pairResult = await pairAndAddClientAction(
        pin,
        friendlyName,
        pair_secret
      );
      console.log("[UserService] Pairing result:", pairResult);

      // Return the result directly (includes success/error and client data on success)
      return pairResult;
    } catch (error) {
      console.error("[UserService] Pairing error:", {
        error,
        friendlyName,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return createErrorResponse(
        `Failed to pair device: ${
          error instanceof Error ? error.message : String(error)
        }`,
        // Attempt to use a specific code if available from the error, otherwise generic
        (error as any)?.error?.code || API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  /**
   * Remove a client device by calling the server action
   */
  async removeClientFromUser(
    // username is no longer needed here
    deviceId: string
  ): Promise<ApiResponse<{}>> {
    try {
      console.log("[UserService] Attempting to remove client:", { deviceId });
      const result = await removeClientAction(deviceId);
      console.log("[UserService] Remove client result:", result);
      return result;
    } catch (error) {
      console.error("[UserService] Failed to call removeClientAction:", {
        error,
        deviceId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      if (
        typeof error === "object" &&
        error !== null &&
        "success" in error &&
        "error" in error
      ) {
        return error as ApiResponse<any>;
      }

      return createErrorResponse(
        `Failed to unpair client: ${
          error instanceof Error ? error.message : String(error)
        }`,
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  /**
   * Get paired clients directly from the Wolf API via wolfPairApi.
   * NOTE: This likely returns raw client data from the server, potentially without user association.
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

  /**
   * Get all clients combined with their owner information from the config.
   * Calls the listClientsAndOwners server action.
   */
  async getClientsWithOwners(): Promise<
    ApiResponse<{ clients: (ClientDevice & { owner?: string })[] }>
  > {
    try {
      await logger.debug(
        LogComponent.WOLF_UI,
        "Fetching clients with owner info via action"
      );
      const result = await listClientsAndOwners();
      await logger.debug(
        LogComponent.WOLF_UI,
        "Received clients with owner info",
        { success: result.success, count: result.data?.clients?.length ?? 0 }
      );
      return result;
    } catch (error) {
      await logger.error(
        LogComponent.WOLF_UI,
        "Failed to call listClientsAndOwners action",
        {
          error: error instanceof Error ? error : new Error(String(error)),
        }
      );
      // Check if the error is already an ApiResponse
      if (
        typeof error === "object" &&
        error !== null &&
        "success" in error &&
        error.success === false &&
        "error" in error
      ) {
        return error as ApiResponse<never>;
      }
      return createErrorResponse(
        "Failed to fetch client and owner list",
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  // Remove private methods that contained server-side logic
  // private static async getWolfClient(deviceId: string): Promise<any> { ... }
  // private static async getWolfClients(): Promise<any[]> { ... }
  // private static async synchronizeClients(username: string): Promise<void> { ... }
};
