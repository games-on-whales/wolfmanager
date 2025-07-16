"use server";

import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { getAuthenticatedSession } from "./auth";

/**
 * Start a client connection
 */
export async function startWolfClientAction(deviceId: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    if (!deviceId) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Device ID is required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Starting Wolf client", {
      userId: session.user.id,
      deviceId,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, `/clients/${deviceId}/start`, {
      method: "POST",
    });

    if (!response.success) {
      await logger.warn(LogComponent.WOLF_UI, "Failed to start Wolf client", {
        userId: session.user.id,
        deviceId,
        error: response.error,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to start client"
      );
    }

    await logger.info(LogComponent.WOLF_UI, "Wolf client started successfully", {
      userId: session.user.id,
      deviceId,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error starting Wolf client", error, { deviceId });
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to start client"
    );
  }
}

/**
 * Stop a client connection
 */
export async function stopWolfClientAction(deviceId: string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    if (!deviceId) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Device ID is required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Stopping Wolf client", {
      userId: session.user.id,
      deviceId,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, `/clients/${deviceId}/stop`, {
      method: "POST",
    });

    if (!response.success) {
      await logger.warn(LogComponent.WOLF_UI, "Failed to stop Wolf client", {
        userId: session.user.id,
        deviceId,
        error: response.error,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to stop client"
      );
    }

    await logger.info(LogComponent.WOLF_UI, "Wolf client stopped successfully", {
      userId: session.user.id,
      deviceId,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error stopping Wolf client", error, { deviceId });
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to stop client"
    );
  }
}