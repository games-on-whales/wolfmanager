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
 * Get Wolf server status and connection info
 */
export async function getWolfStatusAction(): Promise<ApiResponse<{ status: unknown }>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Getting Wolf status", {
      userId: session.user.id,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/status", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get Wolf status", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to retrieve status"
      );
    }

    return createSuccessResponse({ status: response.data });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error getting Wolf status", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to retrieve status"
    );
  }
}