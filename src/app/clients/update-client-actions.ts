"use server";

import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import type { ClientSettings } from "@/types/wolf";
import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { SocketService } from "@/lib/services/socket-service";
import { getServerSession } from "next-auth/next";
import {
  getClientDeviceById,
  getClientDeviceByWolfClientId,
  getUserByUsername,
  updateClientDevice,
} from "@/lib/db/helpers";

// Helper to get username from session
async function getUsername(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.name ?? null;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to get session",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

/**
 * Update client settings and friendly name
 * This updates both the Wolf API settings and the database friendly name
 */
export async function updateClientSettingsAndNameAction(
  clientId: string,
  friendlyName: string,
  settings: ClientSettings,
  appStateFolder?: string
): Promise<ApiResponse<{}>> {
  const username = await getUsername();
  if (!username) {
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
    // Validate input parameters
    if (!clientId || typeof clientId !== 'string') {
      return createErrorResponse("Invalid client ID", API_ERROR_CODES.INVALID_INPUT);
    }

    if (!friendlyName || typeof friendlyName !== 'string') {
      return createErrorResponse("Invalid friendly name", API_ERROR_CODES.INVALID_INPUT);
    }

    if (!settings || typeof settings !== 'object') {
      return createErrorResponse("Invalid settings data", API_ERROR_CODES.INVALID_INPUT);
    }

    // Validate settings structure
    const { controllers_override, mouse_acceleration, h_scroll_acceleration, v_scroll_acceleration } = settings;

    if (!Array.isArray(controllers_override)) {
      return createErrorResponse("controllers_override must be an array", API_ERROR_CODES.VALIDATION_ERROR);
    }

    const validControllerTypes = ['auto', 'xbox', 'nintendo', 'ps'];
    for (const controller of controllers_override) {
      if (!validControllerTypes.includes(controller)) {
        return createErrorResponse(
          `Invalid controller type: ${controller}. Must be one of: ${validControllerTypes.join(', ')}`,
          API_ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    if (typeof mouse_acceleration !== 'number' || mouse_acceleration < 0) {
      return createErrorResponse("mouse_acceleration must be a non-negative number", API_ERROR_CODES.VALIDATION_ERROR);
    }

    if (typeof h_scroll_acceleration !== 'number' || h_scroll_acceleration < 0) {
      return createErrorResponse("h_scroll_acceleration must be a non-negative number", API_ERROR_CODES.VALIDATION_ERROR);
    }

    if (typeof v_scroll_acceleration !== 'number' || v_scroll_acceleration < 0) {
      return createErrorResponse("v_scroll_acceleration must be a non-negative number", API_ERROR_CODES.VALIDATION_ERROR);
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Updating client settings and name",
      { username, clientId, friendlyName, settings }
    );

    // 1. Get user from database
    const user = await getUserByUsername(username);
    if (!user) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] User not found in database",
        undefined,
        { username }
      );
      return createErrorResponse("User not found", API_ERROR_CODES.NOT_FOUND);
    }

    // 2. Verify that the client exists and the user owns it
    let clientDevice = await getClientDeviceById(clientId);
    
    if (!clientDevice) {
      // Try to find by Wolf client ID
      clientDevice = await getClientDeviceByWolfClientId(clientId);
      if (!clientDevice) {
        logger.warn(
          LogComponent.WOLF_UI,
          "[Action] Client not found for settings and name update",
          { username, userId: user.id, clientId }
        );
        return createErrorResponse("Client not found", API_ERROR_CODES.NOT_FOUND);
      }
    }

    // CRITICAL SECURITY CHECK: Verify that the requesting user owns this client
    if (clientDevice.userId !== user.id) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] SECURITY VIOLATION: User attempted to update client they don't own",
        {
          requestingUser: username,
          requestingUserId: user.id,
          clientOwnerUserId: clientDevice.userId,
          clientId,
          securityViolation: true,
        }
      );
      return createErrorResponse(
        "Unauthorized: You can only update clients you own",
        API_ERROR_CODES.UNAUTHORIZED
      );
    }

    // 3. Update friendly name in database
    try {
      await updateClientDevice(clientDevice.id, { friendlyName });
      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Successfully updated client friendly name in database",
        { username, userId: user.id, clientId, oldName: clientDevice.friendlyName, newName: friendlyName }
      );
    } catch (dbError) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to update client friendly name in database",
        dbError instanceof Error ? dbError : new Error(String(dbError)),
        { username, userId: user.id, clientId, friendlyName }
      );
      return createErrorResponse(
        "Failed to update client name in database",
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }

    // 4. Update settings via Wolf API
    const wolfClientId = clientDevice.wolfClientId;

    // Convert controller types to uppercase for Wolf API
    const wolfSettings = {
      controllers_override: controllers_override.map(controller => controller.toUpperCase()),
      mouse_acceleration,
      h_scroll_acceleration,
      v_scroll_acceleration,
    };

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for settings update request"
      );
      return createErrorResponse("Authentication required", API_ERROR_CODES.UNAUTHORIZED);
    }

    const socketService = SocketService.getInstance();
    
    // Log the exact payload being sent to Wolf API
    const payload: {
      client_id: string | null;
      app_state_folder?: string;
      settings: Record<string, unknown>;
    } = {
      client_id: wolfClientId,
      settings: wolfSettings as unknown as Record<string, unknown>
    };

    // Only add app_state_folder to payload if it has been provided
    if (appStateFolder !== undefined) {
      payload.app_state_folder = appStateFolder;
    }
    
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Sending client settings update to Wolf API",
      {
        endpoint: "/clients/settings",
        method: "POST",
        payload,
        wolfClientId,
        originalSettings: settings
      }
    );

    const response = await socketService.callWolfApi(
      session,
      `/clients/settings`,
      {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" }
      }
    );

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to update client settings via Wolf API",
        new Error(response.error || "Unknown error"),
        { username, userId: user.id, clientId, wolfClientId, settings }
      );
      return createErrorResponse(
        `Failed to update client settings: ${response.error || "Unknown error"}`,
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully updated client settings and name",
      { username, userId: user.id, clientId, wolfClientId, friendlyName, settings }
    );

    return createSuccessResponse({});
  } catch (error) {
    const errorMessage = "Failed to update client settings and name";
    logger.error(
      LogComponent.WOLF_UI,
      `[Action] ${errorMessage}`,
      error instanceof Error ? error : new Error(String(error)),
      { username, clientId, friendlyName, settings }
    );
    return createErrorResponse(
      `${errorMessage}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      API_ERROR_CODES.INTERNAL_ERROR
    );
  }
}