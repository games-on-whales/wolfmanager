// Import from the correct file with server actions
import { addClientAction } from "@/app/pair/actions"; 
import {
  API_ERROR_CODES,
  createErrorResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { wolfPairApi } from "@/lib/api/wolf-pair";
import { LogComponent, logger } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const UserService = {
  /**
   * Add a client device by calling the server action
   */
  async addClientToUser(
    deviceId: string,
    friendlyName: string
  ): Promise<ApiResponse<void>> {
    try {
      console.log("[UserService] Attempting to add client:", {
        deviceId,
        friendlyName,
      });

      // Call the server action directly with proper error handling
      console.log("[UserService] Calling addClientAction");
      const addClientResult = await addClientAction(deviceId, friendlyName);
      console.log("[UserService] addClientAction result:", addClientResult);

      if (!addClientResult.success) {
        console.error("[UserService] addClientAction failed:", addClientResult.error);
        throw new Error(
          addClientResult.error?.message || "Failed to add client"
        );
      }

      // Wait for client to be available with retries
      let retryCount = 0;
      let clientFound = false;

      while (retryCount < MAX_RETRIES && !clientFound) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        const clientsResponse = await this.getUserClients();

        if (clientsResponse.success) {
          const clients = clientsResponse.data?.clients || [];
          clientFound = clients.some((client) => client.id === deviceId);

          if (clientFound) {
            console.log("[UserService] Client found after pairing");
            await logger.debug(
              LogComponent.WOLF_UI,
              "Client found after pairing",
              {
                deviceId,
                retryCount,
              }
            );
            break;
          }
        }

        retryCount++;
        if (retryCount < MAX_RETRIES) {
          console.log(`[UserService] Client not found, retrying (${retryCount}/${MAX_RETRIES})`);
          await logger.debug(
            LogComponent.WOLF_UI,
            "Client not found, retrying",
            {
              deviceId,
              retryCount,
              maxRetries: MAX_RETRIES,
            }
          );
        }
      }

      if (!clientFound) {
        console.error("[UserService] Client not found after all retries");
        throw new Error("Client not found after pairing");
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error("[UserService] Error in addClientToUser:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      await logger.error(LogComponent.WOLF_UI, "Failed to add client to user", {
        error: error instanceof Error ? error : new Error(String(error)),
        deviceId,
        friendlyName,
      });

      return {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to add client to user",
          code: "ADD_CLIENT_ERROR",
        },
      };
    }
  },

  // Rest of your UserService methods...
};