"use server";

import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import { loadConfig, saveConfig, type Config } from "@/lib/config";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { getAuthenticatedSession } from "./auth";

/**
 * Unpair a client from Wolf
 */
export async function unpairWolfClientAction(deviceId: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    const username = session.user.name;
    if (!username) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Username required"
      );
    }

    if (!deviceId) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Device ID is required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Attempting client unpairing", {
      userId: session.user.id,
      username,
      deviceId,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/unpair/client", {
      method: "POST",
      body: {
        client_id: deviceId,
      },
    });

    if (!response.success) {
      await logger.warn(LogComponent.WOLF_UI, "Client unpairing failed", {
        userId: session.user.id,
        deviceId,
        error: response.error,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Unpairing failed"
      );
    }

    // Remove client from user's config
    let config: Config;
    try {
      config = (await loadConfig(true)) as Config;
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to load config for unpairing", error);
      return createErrorResponse(
        API_ERROR_CODES.CONFIG_LOAD_FAILED,
        "Client unpaired but failed to load configuration"
      );
    }

    if (config.users?.[username]?.clients) {
      const initialCount = config.users[username].clients.length;
      config.users[username].clients = config.users[username].clients.filter(
        (client) => client.id !== deviceId
      );
      const finalCount = config.users[username].clients.length;

      if (initialCount > finalCount) {
        try {
          await saveConfig(config);
          await logger.info(LogComponent.WOLF_UI, "Client unpairing and config update successful", {
            userId: session.user.id,
            username,
            deviceId,
          });
        } catch (error) {
          await logger.error(LogComponent.WOLF_UI, "Failed to save config after unpairing", error);
          return createErrorResponse(
            API_ERROR_CODES.CONFIG_SAVE_FAILED,
            "Client unpaired but failed to update configuration"
          );
        }
      } else {
        await logger.warn(LogComponent.WOLF_UI, "Client not found in user config during unpairing", {
          userId: session.user.id,
          username,
          deviceId,
        });
      }
    }

    await logger.info(LogComponent.WOLF_UI, "Client unpairing successful", {
      userId: session.user.id,
      username,
      deviceId,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error during client unpairing", error, { deviceId });
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Unpairing operation failed"
    );
  }
}