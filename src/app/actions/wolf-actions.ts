"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import { loadConfig, saveConfig, type Config } from "@/lib/config";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import type { ClientDevice } from "@/types/client";
import { getClientDevicesByUserId } from "@/lib/db/helpers/clients";
import type { ClientDevice as DbClientDevice } from "@/lib/db/schema/clients";

// Extended client type for Wolf API responses
type WolfClientWithMetadata = ClientDevice & {
  device_type?: string;
  last_seen?: string;
  status?: string;
  owner?: string;
};

/**
 * Wolf Server Actions
 * 
 * These actions provide a clean interface for client components to access
 * Wolf data through the centralized socket service with proper authentication,
 * logging, and error handling.
 */

// Types for Wolf API responses
interface WolfPairResponse {
  success: boolean;
  error?: string;
  client_id?: string;
}

interface WolfClientResponse {
  id: string;
  client_id?: string;
  hostname?: string;
  ip?: string;
  mac?: string;
  status?: string;
  last_seen?: string;
  [key: string]: unknown;
}

interface WolfClientsListResponse {
  success: boolean;
  clients: WolfClientResponse[];
}

interface PendingPairRequest {
  id: string;
  pin: string;
  pair_secret: string;
  timestamp: string;
  expires_at: string;
}

interface WolfPendingRequestsResponse {
  success: boolean;
  requests: PendingPairRequest[];
}

/**
 * Get authenticated session or return error response
 */
async function getAuthenticatedSession() {
  try {
    // Get headers to debug cookie issues
    const { headers } = await import('next/headers');
    const headersList = headers();
    const cookieHeader = headersList.get('cookie');
    
    const session = await getServerSession(authOptions);
    await logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: Wolf action authentication check", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userName: session?.user?.name,
      userRole: session?.user?.role,
      nextauthUrl: process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
      hasCookieHeader: !!cookieHeader,
      cookieHeaderLength: cookieHeader?.length || 0,
      hasSessionToken: cookieHeader?.includes('next-auth.session-token') || false,
      timestamp: new Date().toISOString()
    });
    
    if (!session?.user) {
      await logger.warn(LogComponent.WOLF_UI, "Wolf action attempted without authentication");
      return null;
    }
    return session;
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "DIAGNOSIS: Error in getAuthenticatedSession", error);
    return null;
  }
}

/**
 * Helper function to deduplicate Wolf client list by client_id
 * Takes the most recent entry for each client_id (last one in the array)
 */
function deduplicateWolfClients(clients: any[]): any[] {
  const clientMap = new Map<string, any>();
  const pairSecretMap = new Map<string, any>();
  const duplicateStats = {
    byId: 0,
    byPairSecret: 0,
    total: clients.length
  };
  
  for (const client of clients) {
    const clientId = client.client_id || client.id;
    const pairSecret = client.pair_secret;
    
    if (clientId) {
      // Check for ID duplicates
      if (clientMap.has(clientId)) {
        duplicateStats.byId++;
        logger.debug(LogComponent.WOLF_UI, "Duplicate client ID detected in Wolf API response", {
          clientId,
          existingClient: clientMap.get(clientId),
          duplicateClient: client
        });
      }
      
      // Check for pair secret duplicates
      if (pairSecret && pairSecretMap.has(pairSecret)) {
        duplicateStats.byPairSecret++;
        logger.debug(LogComponent.WOLF_UI, "Duplicate pair secret detected in Wolf API response", {
          pairSecret,
          clientId,
          existingClientId: pairSecretMap.get(pairSecret).client_id || pairSecretMap.get(pairSecret).id
        });
      }
      
      // Always take the latest entry (overwrites previous)
      clientMap.set(clientId, client);
      if (pairSecret) {
        pairSecretMap.set(pairSecret, client);
      }
    } else {
      logger.warn(LogComponent.WOLF_UI, "Client without ID detected in Wolf API response", { client });
    }
  }
  
  const deduplicatedClients = Array.from(clientMap.values());
  
  if (duplicateStats.byId > 0 || duplicateStats.byPairSecret > 0) {
    logger.info(LogComponent.WOLF_UI, "Wolf API client deduplication completed", {
      originalCount: duplicateStats.total,
      deduplicatedCount: deduplicatedClients.length,
      duplicatesById: duplicateStats.byId,
      duplicatesByPairSecret: duplicateStats.byPairSecret,
      totalDuplicatesRemoved: duplicateStats.total - deduplicatedClients.length
    });
  }
  
  return deduplicatedClients;
}

/**
 * Detect and cleanup duplicate clients from Wolf API by unpairing them
 * This function identifies duplicates by client_id and unpairs ALL duplicates from Wolf
 */
export async function detectAndCleanupWolfDuplicatesAction(): Promise<ApiResponse<{
  duplicatesFound: boolean;
  duplicatesRemoved: number;
  cleanedClientIds: string[];
  message: string;
}>> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    await logger.info(LogComponent.WOLF_UI, "Starting Wolf API duplicate detection and cleanup", {
      userId: session.user.id
    });

    // Get all clients from Wolf API
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/clients", {
      method: "GET",
    });

    if (!response.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to fetch clients from Wolf API for duplicate cleanup", new Error(response.error || "Unknown error"), {
        userId: session.user.id,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        response.error || "Failed to fetch clients from Wolf API"
      );
    }

    const wolfClients = (response.data as any)?.clients || [];
    
    // Group clients by client_id to find duplicates
    const clientGroups: { [key: string]: any[] } = {};
    
    wolfClients.forEach((client: any) => {
      const clientId = client.client_id || client.id;
      if (clientId) {
        if (!clientGroups[clientId]) {
          clientGroups[clientId] = [];
        }
        clientGroups[clientId].push(client);
      }
    });

    // Find duplicate groups (more than 1 client with same ID)
    const duplicateGroups = Object.entries(clientGroups).filter(([_, clients]) => clients.length > 1);
    
    if (duplicateGroups.length === 0) {
      await logger.info(LogComponent.WOLF_UI, "No duplicate clients found in Wolf API", {
        userId: session.user.id,
        totalClients: wolfClients.length
      });
      return createSuccessResponse({
        duplicatesFound: false,
        duplicatesRemoved: 0,
        cleanedClientIds: [],
        message: "No duplicate clients found"
      });
    }

    await logger.warn(LogComponent.WOLF_UI, "Duplicate clients detected in Wolf API", {
      userId: session.user.id,
      duplicateGroups: duplicateGroups.length,
      duplicateClientIds: duplicateGroups.map(([clientId, clients]) => ({ clientId, count: clients.length }))
    });

    // Unpair all duplicates from Wolf
    const cleanedClientIds: string[] = [];
    let duplicatesRemoved = 0;

    for (const [clientId, clients] of duplicateGroups) {
      await logger.info(LogComponent.WOLF_UI, `Unpairing duplicate client from Wolf: ${clientId}`, {
        userId: session.user.id,
        clientId,
        duplicateCount: clients.length
      });

      // Unpair all instances of this duplicate client ID
      for (const client of clients) {
        try {
          const unpairResponse = await socketService.callWolfApi(session, "/unpair/client", {
            method: "POST",
            body: {
              client_id: clientId,
            },
          });

          if (unpairResponse.success) {
            duplicatesRemoved++;
            if (!cleanedClientIds.includes(clientId)) {
              cleanedClientIds.push(clientId);
            }
            await logger.info(LogComponent.WOLF_UI, `Successfully unpaired duplicate client from Wolf`, {
              userId: session.user.id,
              clientId
            });
          } else {
            await logger.error(LogComponent.WOLF_UI, `Failed to unpair duplicate client from Wolf`, new Error(unpairResponse.error || "Unpair failed"), {
              userId: session.user.id,
              clientId,
              error: unpairResponse.error
            });
          }
        } catch (error) {
          await logger.error(LogComponent.WOLF_UI, `Error unpairing duplicate client from Wolf`, error, {
            userId: session.user.id,
            clientId
          });
        }
      }
    }

    const message = duplicatesRemoved > 0
      ? `Successfully removed ${duplicatesRemoved} duplicate client(s) from Wolf. Please retry your pairing process.`
      : "Duplicate clients detected but none could be removed. Please check Wolf API connectivity.";

    await logger.info(LogComponent.WOLF_UI, "Wolf duplicate cleanup completed", {
      userId: session.user.id,
      duplicateGroupsFound: duplicateGroups.length,
      duplicatesRemoved,
      cleanedClientIds
    });

    return createSuccessResponse({
      duplicatesFound: true,
      duplicatesRemoved,
      cleanedClientIds,
      message
    });

  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error during Wolf duplicate detection and cleanup", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to detect and cleanup Wolf duplicates"
    );
  }
}

/**
 * Comprehensive client synchronization function that merges database and Wolf API data
 * Removes inconsistencies and duplicates, returns clean deduplicated client list
 */
export async function synchronizeAndCleanupClientsAction(userId?: string): Promise<ApiResponse<{
  clients: any[],
  synchronizationStats: {
    databaseClientsCount: number,
    wolfApiClientsCount: number,
    duplicatesRemoved: number,
    inconsistenciesFound: number,
    finalClientCount: number,
    cleanupPerformed: boolean
  }
}>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      await logger.warn(LogComponent.WOLF_UI, "Client synchronization attempted without authentication");
      return createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED,
        "Authentication required"
      );
    }

    const targetUserId = userId || session.user.id;
    
    await logger.info(LogComponent.WOLF_UI, "Starting comprehensive client synchronization", {
      userId: targetUserId,
      requestingUserId: session.user.id
    });

    // Get Wolf API clients first
    const socketService = SocketService.getInstance();
    const wolfResponse = await socketService.callWolfApi(session, "/clients", {
      method: "GET",
    });

    if (!wolfResponse.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get Wolf clients during synchronization", new Error(wolfResponse.error || "Unknown error"), {
        userId: targetUserId,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        wolfResponse.error || "Failed to retrieve Wolf clients"
      );
    }

    const wolfData = wolfResponse.data as any;
    let wolfClients: any[] = [];
    
    if (wolfData && typeof wolfData === "object" && wolfData.success === true && Array.isArray(wolfData.clients)) {
      // Apply enhanced deduplication to Wolf API clients
      wolfClients = deduplicateWolfClients(wolfData.clients);
    }

    // Get database clients using the helper function
    const { cleanupDuplicateClientsForUser, getClientDevicesByUserId } = await import('@/lib/db/helpers/clients');
    const cleanupResult = await cleanupDuplicateClientsForUser(targetUserId);
    
    // Get final database clients after cleanup
    const databaseClients = await getClientDevicesByUserId(targetUserId);

    // Analyze inconsistencies between Wolf API and database
    const wolfClientIds = new Set(wolfClients.map(c => c.client_id || c.id).filter(Boolean));
    const databasePairSecrets = new Set(databaseClients.map(c => c.pairSecret));
    const wolfPairSecrets = new Set(wolfClients.map(c => c.pair_secret).filter(Boolean));
    
    // Find inconsistencies
    const orphanedInDatabase = databaseClients.filter(dbClient =>
      !wolfPairSecrets.has(dbClient.pairSecret)
    );
    const unknownInWolf = wolfClients.filter(wolfClient =>
      wolfClient.pair_secret && !databasePairSecrets.has(wolfClient.pair_secret)
    );

    const inconsistenciesFound = orphanedInDatabase.length + unknownInWolf.length;

    if (inconsistenciesFound > 0) {
      await logger.warn(LogComponent.WOLF_UI, "Client synchronization found inconsistencies", {
        userId: targetUserId,
        orphanedInDatabase: orphanedInDatabase.length,
        unknownInWolf: unknownInWolf.length,
        orphanedClients: orphanedInDatabase.map(c => ({ id: c.id, friendlyName: c.friendlyName, pairSecret: c.pairSecret })),
        unknownClients: unknownInWolf.map(c => ({ id: c.client_id || c.id, pair_secret: c.pair_secret }))
      });
    }

    // Merge and create final client list (Wolf API clients take precedence)
    const finalClients = wolfClients;

    const synchronizationStats = {
      databaseClientsCount: cleanupResult.summary.initialDatabaseCount,
      wolfApiClientsCount: wolfClients.length,
      duplicatesRemoved: cleanupResult.databaseCleanup.removedByIdCount + cleanupResult.databaseCleanup.removedByPairSecretCount,
      inconsistenciesFound,
      finalClientCount: finalClients.length,
      cleanupPerformed: cleanupResult.summary.cleanupPerformed
    };

    await logger.info(LogComponent.WOLF_UI, "Client synchronization completed successfully", {
      userId: targetUserId,
      ...synchronizationStats
    });

    return createSuccessResponse({
      clients: finalClients,
      synchronizationStats
    });

  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error during client synchronization", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Failed to synchronize clients"
    );
  }
}

/**
 * Helper function to extract unique client IDs from Wolf clients
 */
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