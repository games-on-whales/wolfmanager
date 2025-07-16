"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { getAuthenticatedSession } from "./auth";
import { deduplicateWolfClients } from "./utils";

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