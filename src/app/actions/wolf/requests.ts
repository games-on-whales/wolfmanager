"use server";

import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import { loadConfig, type Config } from "@/lib/config";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { getAuthenticatedSession } from "./auth";
import type { PendingPairRequest } from "./types";

/**
 * Get pending pairing requests
 * Used by the Clients page to show pending requests
 */
export async function getPendingPairRequestsAction(): Promise<ApiResponse<{ requests: PendingPairRequest[] }>> {
  try {
    await logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: getPendingPairRequestsAction called");
    
    const session = await getAuthenticatedSession();
    if (!session) {
      await logger.warn(LogComponent.WOLF_UI, "DIAGNOSIS: getPendingPairRequestsAction - no session");
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Getting pending pair requests", {
      userId: session.user.id,
    });

    const socketService = SocketService.getInstance();
    
    // Use the correct Wolf API endpoint for pending pair requests
    const response = await socketService.callWolfApi(session, "/pair/pending", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get pending requests from /pair/pending endpoint", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        statusCode: response.statusCode,
        endpoint: "/pair/pending",
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to retrieve pending requests"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Raw Wolf API response from /pair/pending", {
      userId: session.user.id,
      responseData: response.data,
      responseType: typeof response.data,
    });

    const data = response.data as any; // Use any for now to see the actual structure
    
    // Check if this is the structure we expect
    if (!data || typeof data !== "object") {
      await logger.warn(LogComponent.WOLF_UI, "Unexpected pending requests response structure", {
        userId: session.user.id,
        responseType: typeof data,
        responseData: data,
      });
      return createSuccessResponse({ requests: [] });
    }

    // Handle different possible response structures
    let rawRequests: any[] = [];
    if (Array.isArray(data.requests)) {
      rawRequests = data.requests;
    } else if (Array.isArray(data)) {
      rawRequests = data;
    } else if (data.success && Array.isArray(data.data)) {
      rawRequests = data.data;
    }

    await logger.debug(LogComponent.WOLF_UI, "Raw pending requests retrieved", {
      userId: session.user.id,
      rawCount: rawRequests.length,
      sampleRequest: rawRequests[0] || "none",
    });

    // Load config to get all paired clients across all users
    let config: Config;
    try {
      config = (await loadConfig(false)) as Config; // Read-only config load
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to load config for pending request filtering", error);
      // Return raw requests if config load fails
      return createSuccessResponse({ requests: rawRequests });
    }

    // Extract all pair_secret values from all users' paired clients
    const pairedSecrets = new Set<string>();
    if (config.users) {
      for (const userConfig of Object.values(config.users)) {
        if (userConfig.clients) {
          for (const client of userConfig.clients) {
            if (client.pair_secret) {
              pairedSecrets.add(client.pair_secret);
            }
          }
        }
      }
    }

    await logger.debug(LogComponent.WOLF_UI, "Extracted paired secrets for filtering", {
      userId: session.user.id,
      totalPairedSecrets: pairedSecrets.size,
      pairedSecrets: Array.from(pairedSecrets),
    });

    // Filter out pending requests that are already paired
    const filteredRequests: any[] = [];
    const filteredOutRequests: any[] = [];

    for (const request of rawRequests) {
      const isPaired = pairedSecrets.has(request.pair_secret);
      if (isPaired) {
        filteredOutRequests.push(request);
        await logger.debug(LogComponent.WOLF_UI, "Filtering out already-paired request", {
          userId: session.user.id,
          pairSecret: request.pair_secret,
          clientIp: request.client_ip,
        });
      } else {
        filteredRequests.push(request);
      }
    }

    await logger.debug(LogComponent.WOLF_UI, "Successfully filtered pending requests", {
      userId: session.user.id,
      rawCount: rawRequests.length,
      filteredCount: filteredRequests.length,
      filteredOut: rawRequests.length - filteredRequests.length,
    });

    return createSuccessResponse({ requests: filteredRequests });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error getting pending requests", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to retrieve pending requests"
    );
  }
}