"use server";

import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { getClientDevicesByUserId } from "@/lib/db/helpers/clients";
import type { ClientDevice as DbClientDevice } from "@/lib/db/schema/clients";
import { getAuthenticatedSession } from "./auth";
import { deduplicateWolfClients } from "./utils";
import type { 
  WolfClientWithMetadata, 
  WolfClientResponse, 
  WolfClientsListResponse 
} from "./types";

/**
 * Get client data from Wolf API with config integration
 * Used by the Clients page to display paired clients for the authenticated user
 */
export async function getWolfClientsAction(): Promise<ApiResponse<{ clients: WolfClientWithMetadata[] }>> {
  try {
    await logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: getWolfClientsAction called");
    
    const session = await getAuthenticatedSession();
    if (!session) {
      await logger.warn(LogComponent.WOLF_UI, "DIAGNOSIS: getWolfClientsAction - no session");
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    const username = session.user.name;
    if (!username) {
      await logger.warn(LogComponent.WOLF_UI, "DIAGNOSIS: getWolfClientsAction - no username", {
        hasUser: !!session.user,
        userId: session.user?.id
      });
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Username required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Getting Wolf clients with config integration", {
      userId: session.user.id,
      username,
    });

    // 1. Get clients from Wolf API
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/clients", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get Wolf clients", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to retrieve clients"
      );
    }

    const data = response.data as WolfClientsListResponse;
    
    // Validate response structure
    if (!data || typeof data !== "object" || !Array.isArray(data.clients)) {
      await logger.warn(LogComponent.WOLF_UI, "Unexpected Wolf clients response structure", {
        userId: session.user.id,
        responseType: typeof data,
      });
      return createSuccessResponse({ clients: [] });
    }

    // 2. Get user's clients from database
    let userDbClients: DbClientDevice[] = [];
    try {
      userDbClients = await getClientDevicesByUserId(session.user.id);
      await logger.debug(LogComponent.WOLF_UI, "Retrieved user clients from database", {
        userId: session.user.id,
        username,
        clientCount: userDbClients.length,
        clientIds: userDbClients.map(c => c.id),
      });
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get user clients from database", error, {
        userId: session.user.id,
        username,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        "Failed to retrieve user's client devices"
      );
    }

    // Create a map of client IDs to database client data for quick lookup
    const userClientMap = new Map(userDbClients.map(client => [client.id, client]));
    const userClientIds = new Set(userDbClients.map(c => c.id));

    // 3. Deduplicate Wolf clients and filter to only include user's clients
    const deduplicatedClients = deduplicateWolfClients(data.clients);
    const userClients: WolfClientWithMetadata[] = [];

    await logger.debug(LogComponent.WOLF_UI, "Processing Wolf clients for user filtering", {
      userId: session.user.id,
      username,
      totalWolfClients: data.clients.length,
      deduplicatedWolfClients: deduplicatedClients.length,
      duplicatesRemoved: data.clients.length - deduplicatedClients.length,
      userDbClientCount: userDbClients.length,
    });

    for (const wolfClient of deduplicatedClients) {
      const clientId = wolfClient.client_id || wolfClient.id;
      if (!clientId || !userClientIds.has(clientId)) {
        continue; // Skip clients not owned by this user
      }

      // Find the client in database to get friendly name and pair secret
      const dbClient = userClientMap.get(clientId);
      
      const clientData: WolfClientWithMetadata = {
        id: clientId,
        friendly_name: (dbClient as any)?.friendlyName || (wolfClient as any).friendly_name || (wolfClient as any).hostname || `Client ${clientId}`,
        pair_secret: (dbClient as any)?.pairSecret || (wolfClient as any).pair_secret || undefined,
        device_type: (wolfClient as any).device_type || 'Unknown',
        last_seen: (wolfClient as any).last_seen || undefined,
        status: (wolfClient as any).status || 'Unknown',
        owner: username,
      };

      userClients.push(clientData);
    }

    await logger.debug(LogComponent.WOLF_UI, "Successfully retrieved user's Wolf clients", {
      userId: session.user.id,
      username,
      totalWolfClients: data.clients.length,
      userClients: userClients.length,
    });

    return createSuccessResponse({ clients: userClients });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error getting Wolf clients", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to retrieve clients"
    );
  }
}

/**
 * Get a specific client by ID
 */
export async function getWolfClientAction(deviceId: string): Promise<ApiResponse<{ client: WolfClientResponse | null }>> {
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

    await logger.debug(LogComponent.WOLF_UI, "Getting Wolf client", {
      userId: session.user.id,
      deviceId,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, `/clients/${deviceId}`, {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get Wolf client", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        deviceId,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to retrieve client"
      );
    }

    return createSuccessResponse({ client: response.data as WolfClientResponse });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error getting Wolf client", error, { deviceId });
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to retrieve client"
    );
  }
}