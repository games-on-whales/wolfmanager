"use server";

import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import type { PendingPairRequest } from "@/lib/api/wolf-pair"; // Import PendingPairRequest
import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { SocketService } from "@/lib/services/socket-service";
import type { ClientDevice } from "@/types/client";
import { getServerSession } from "next-auth/next";

// Database imports
import {
  addClientDevice,
  deleteClientDevice,
  getAllUsers,
  getClientDeviceById,
  getClientDeviceByWolfClientId,
  getClientDevicesByUserId,
  getUserByUsername,
} from "@/lib/db/helpers";

interface WolfPairResponse {
  success: boolean;
  error?: string;
}

// Helper to get username from session
async function getUsername(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Got session details",
      {
        username: session?.user?.name ?? "none",
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id ?? "none",
        userRole: session?.user?.role ?? "none",
        requiresFirstTimeSetup: session?.requiresFirstTimeSetup ?? false,
        sessionError: session?.error ?? "none",
        timestamp: new Date().toISOString(),
      }
    );
    return session?.user?.name ?? null;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Failed to get session",
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: new Date().toISOString(),
      }
    );
    return null;
  }
}

// Helper to get a client directly from Wolf API (Server-side only)
async function getWolfClient(deviceId: string): Promise<any | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for Wolf client request",
        {
          deviceId,
        }
      );
      return null;
    }

    logger.debug(LogComponent.WOLF_UI, "[Action] Getting Wolf client", {
      deviceId,
      userId: session.user.id,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(
      session,
      `/clients/${deviceId}`,
      {
        method: "GET",
      }
    );

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to get client from Wolf",
        new Error(response.error || "Unknown error"),
        { deviceId, userId: session.user.id }
      );
      return null;
    }

    logger.debug(LogComponent.WOLF_UI, "[Action] Got Wolf client", {
      deviceId,
      userId: session.user.id,
      hasResponse: !!response.data,
    });
    return response.data;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to get client from Wolf",
      error instanceof Error ? error : new Error(String(error)),
      { deviceId }
    );
    return null;
  }
}

// Helper to get all clients from Wolf API (Server-side only)
async function getWolfClients(): Promise<any[]> {
  let responseData: any = null; // Variable to store the parsed response
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for Wolf clients request"
      );
      return [];
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Getting all Wolf clients (getWolfClients)",
      { userId: session.user.id }
    );

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/clients", {
      method: "GET",
    });

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to get clients from Wolf",
        new Error(response.error || "Unknown error"),
        { userId: session.user.id }
      );
      return [];
    }

    responseData = response.data;

    // Check the structure of the response
    if (
      typeof responseData === "object" &&
      responseData !== null &&
      responseData.success === true &&
      Array.isArray(responseData.clients)
    ) {
      // Extract the raw clients array
      const rawClients = responseData.clients;

      // Enhanced deduplication based on client_id/id and pair_secret
      const uniqueClientsMap = new Map<string, any>();
      const pairSecretMap = new Map<string, any>();
      const duplicateStats = {
        byId: 0,
        byPairSecret: 0,
        withoutId: 0
      };

      rawClients.forEach((client: any) => {
        const clientId = client.client_id || client.id;
        const pairSecret = client.pair_secret;
        
        if (!clientId) {
          duplicateStats.withoutId++;
          logger.warn(
            LogComponent.WOLF_UI,
            "[Action] Client without ID detected in Wolf API response",
            { client }
          );
          return;
        }

        // Check for ID duplicates
        if (uniqueClientsMap.has(clientId)) {
          duplicateStats.byId++;
          logger.debug(
            LogComponent.WOLF_UI,
            "[Action] Duplicate client ID detected in /clients API response",
            {
              clientId,
              existingClient: uniqueClientsMap.get(clientId),
              duplicateClient: client
            }
          );
        }

        // Check for pair secret duplicates
        if (pairSecret && pairSecretMap.has(pairSecret)) {
          duplicateStats.byPairSecret++;
          const existingClient = pairSecretMap.get(pairSecret);
          logger.debug(
            LogComponent.WOLF_UI,
            "[Action] Duplicate pair secret detected in /clients API response",
            {
              pairSecret,
              clientId,
              existingClientId: existingClient.client_id || existingClient.id,
              duplicateClient: client
            }
          );
        }

        // Always take the latest entry (overwrites previous)
        uniqueClientsMap.set(clientId, client);
        if (pairSecret) {
          pairSecretMap.set(pairSecret, client);
        }
      });

      const uniqueClients = Array.from(uniqueClientsMap.values());

      // Log deduplication summary and send unpair requests if duplicates were found
      if (duplicateStats.byId > 0 || duplicateStats.byPairSecret > 0 || duplicateStats.withoutId > 0) {
        logger.warn(
          LogComponent.WOLF_UI,
          "[Action] Wolf clients duplicates detected - sending unpair requests",
          {
            originalCount: rawClients.length,
            deduplicatedCount: uniqueClients.length,
            duplicatesById: duplicateStats.byId,
            duplicatesByPairSecret: duplicateStats.byPairSecret,
            clientsWithoutId: duplicateStats.withoutId,
            totalIssues: duplicateStats.byId + duplicateStats.byPairSecret + duplicateStats.withoutId
          }
        );

        // Send unpair requests for duplicate client IDs
        if (duplicateStats.byId > 0) {
          const socketService = SocketService.getInstance();
          const duplicateClientIds = new Set<string>();
          
          // Find all client IDs that have duplicates
          const clientIdCounts = new Map<string, number>();
          rawClients.forEach((client: any) => {
            const clientId = client.client_id || client.id;
            if (clientId) {
              clientIdCounts.set(clientId, (clientIdCounts.get(clientId) || 0) + 1);
            }
          });
          
          // Collect client IDs that appear more than once
          Array.from(clientIdCounts.entries()).forEach(([clientId, count]) => {
            if (count > 1) {
              duplicateClientIds.add(clientId);
            }
          });

          let unpairRequestsSent = 0;
          const unpairedClientIds: string[] = [];

          for (const clientId of Array.from(duplicateClientIds)) {
            const duplicateCount = clientIdCounts.get(clientId) || 0;
            logger.warn(
              LogComponent.WOLF_UI,
              "[Action] Sending unpair request for duplicate client ID",
              {
                clientId,
                duplicateCount,
                note: "Wolf will remove all instances of this client ID"
              }
            );

            try {
              const unpairResponse = await socketService.callWolfApi(session, "/unpair/client", {
                method: "POST",
                body: { client_id: clientId },
                headers: { "Content-Type": "application/json" }
              });

              if (unpairResponse.success) {
                unpairRequestsSent++;
                unpairedClientIds.push(clientId);
                logger.info(
                  LogComponent.WOLF_UI,
                  "[Action] Successfully sent unpair request for duplicate client ID",
                  {
                    clientId,
                    duplicateCount,
                    totalUnpairsSent: unpairRequestsSent,
                    unpairResponse: unpairResponse.data
                  }
                );
              } else {
                logger.error(
                  LogComponent.WOLF_UI,
                  "[Action] Failed to send unpair request for duplicate client ID",
                  new Error(unpairResponse.error || "Unpair request failed"),
                  {
                    clientId,
                    duplicateCount,
                    error: unpairResponse.error,
                    statusCode: unpairResponse.statusCode
                  }
                );
              }
            } catch (unpairError) {
              logger.error(
                LogComponent.WOLF_UI,
                "[Action] Exception during unpair request for duplicate client",
                unpairError instanceof Error ? unpairError : new Error(String(unpairError)),
                {
                  clientId,
                  duplicateCount
                }
              );
            }
          }

          logger.info(
            LogComponent.WOLF_UI,
            "[Action] Wolf duplicate cleanup completed via unpair requests",
            {
              duplicateClientIds: Array.from(duplicateClientIds),
              unpairRequestsSent,
              unpairedClientIds,
              totalDuplicatesDetected: duplicateStats.byId
            }
          );

          // If unpair requests were sent, throw an error to stop the pairing process
          if (unpairRequestsSent > 0) {
            throw new Error(`DUPLICATES_REMOVED: Duplicate clients were detected and removed from Wolf. Please retry the pairing process. Removed ${unpairRequestsSent} duplicate client ID(s): ${unpairedClientIds.join(', ')}`);
          }
        }

        logger.info(
          LogComponent.WOLF_UI,
          "[Action] Wolf clients deduplication completed",
          {
            originalCount: rawClients.length,
            deduplicatedCount: uniqueClients.length,
            duplicatesById: duplicateStats.byId,
            duplicatesByPairSecret: duplicateStats.byPairSecret,
            clientsWithoutId: duplicateStats.withoutId,
            totalIssues: duplicateStats.byId + duplicateStats.byPairSecret + duplicateStats.withoutId
          }
        );
      }

      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] Extracted and deduplicated Wolf clients array",
        {
          originalCount: rawClients.length,
          uniqueCount: uniqueClients.length,
          // Optionally log first few client IDs for confirmation
          // firstFewIds: clients.slice(0, 3).map((c: any) => c.client_id || c.id)
        }
      );
      return uniqueClients;
    } else {
      // Log unexpected response structure
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Unexpected response structure from /clients endpoint",
        {
          responseType: typeof responseData,
          responseData: JSON.stringify(responseData, null, 2),
        }
      );
      return []; // Return empty array if structure is wrong
    }
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to get clients from Wolf",
      error instanceof Error ? error : new Error(String(error)),
      { responseData: JSON.stringify(responseData, null, 2) } // Log response data on error too
    );
    return []; // Return empty on error
  }
}

// Helper to synchronize local client list with Wolf (Server-side only)
async function synchronizeClientsInternal(username: string): Promise<boolean> {
  try {
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Starting client synchronization",
      { username }
    );

    // Get user from database first
    const user = await getUserByUsername(username);
    if (!user) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] User not found in database",
        undefined,
        { username }
      );
      return false;
    }

    // Try to get current user's client devices from database
    let userClients: any[] = [];
    try {
      userClients = await getClientDevicesByUserId(user.id);
    } catch (error) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Failed to get user clients during sync, skipping sync",
        {
          username,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return false; // Skip sync if we can't read from database
    }

    // Get clients from Wolf
    const wolfClients = await getWolfClients();
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Wolf API response",
      { wolfClients }
    );
    const wolfClientIds = new Set(wolfClients.map((c: any) => c.id || c.client_id).filter(Boolean));

    const initialCount = userClients.length;
    let removedCount = 0;

    // Remove orphaned clients (clients in DB but not in Wolf)
    for (const client of userClients) {
      if (!wolfClientIds.has(client.wolfClientId)) {
        logger.info(
          LogComponent.WOLF_UI,
          `[Action] Removing orphaned client: ${client.id} (Wolf ID: ${client.wolfClientId})`,
          { username, clientId: client.id, wolfClientId: client.wolfClientId }
        );
        try {
          await deleteClientDevice(client.id);
          removedCount++;
        } catch (error) {
          logger.warn(
            LogComponent.WOLF_UI,
            "[Action] Failed to remove orphaned client",
            {
              username,
              clientId: client.id,
              wolfClientId: client.wolfClientId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Client synchronization completed",
      {
        username,
        userId: user.id,
        initialCount,
        removedCount,
        finalCount: initialCount - removedCount,
      }
    );
    return true;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to synchronize clients",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    return false;
  }
}

// Helper to verify PIN with Wolf API (Modified slightly for new flow)
async function attemptPairingWithWolf(
  pin: string,
  pair_secret: string
): Promise<WolfPairResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for pairing attempt"
      );
      return { success: false, error: "Authentication required" };
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Attempting pairing with Wolf API",
      {
        pinLength: pin.length,
        hasPairSecret: !!pair_secret,
        userId: session.user.id,
      }
    );

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/pair/client", {
      method: "POST",
      body: {
        pair_secret,
        pin,
      },
    });

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Pairing attempt failed",
        new Error(response.error || "Unknown error"),
        { userId: session.user.id }
      );
      return { success: false, error: response.error || "Pairing failed" };
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Raw Wolf API pair response",
      { response }
    );
    const pairResponse = response.data as WolfPairResponse;

    logger.debug(LogComponent.WOLF_UI, "[Action] Pairing attempt response", {
      success: pairResponse?.success ?? false,
      error: pairResponse?.error,
      userId: session.user.id,
    });
    // Return the raw response object
    return pairResponse ?? { success: false, error: "No response from API" };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to attempt pairing with Wolf",
      error instanceof Error ? error : new Error(String(error)),
      { hasPairSecret: !!pair_secret }
    );
    // Return a structured error response matching WolfPairResponse
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during pairing attempt",
    };
  }
}

// Helper to unpair client with Wolf API
async function unpairClientWithWolf(deviceId: string): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for unpair attempt",
        {
          deviceId,
        }
      );
      return false;
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Sending unpair request to Wolf API",
      {
        deviceId,
        userId: session.user.id,
        endpoint: "/unpair/client",
        requestBody: { client_id: deviceId },
      }
    );

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(
      session,
      "/unpair/client",
      {
        method: "POST",
        body: {
          client_id: deviceId,
        },
      }
    );

    logger.info(LogComponent.WOLF_UI, "[Action] Wolf API unpair response received", {
      deviceId,
      userId: session.user.id,
      responseSuccess: response.success,
      responseError: response.error,
      statusCode: response.statusCode,
      hasData: !!response.data
    });

    if (!response.success) {
      logger.warn(LogComponent.WOLF_UI, "[Action] Wolf API unpair request failed", {
        deviceId,
        userId: session.user.id,
        error: response.error,
        statusCode: response.statusCode,
      });
      return false;
    }

    const unpairResponse = response.data as WolfPairResponse;
    logger.info(LogComponent.WOLF_UI, "[Action] Wolf API unpair data response", {
      deviceId,
      userId: session.user.id,
      dataSuccess: unpairResponse?.success ?? false,
      dataError: unpairResponse?.error,
      fullResponse: unpairResponse
    });

    if (!unpairResponse?.success) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Wolf API unpair data indicated failure",
        {
          deviceId,
          userId: session.user.id,
          error: unpairResponse?.error,
          fullResponse: unpairResponse
        }
      );
      return false;
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Wolf API unpair completed successfully",
      { deviceId, userId: session.user.id }
    );

    return true;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to unpair client with Wolf",
      error instanceof Error ? error : new Error(String(error)),
      { deviceId }
    );
    return false;
  }
}

// Helper to detect and cleanup duplicate clients from Wolf API
async function detectAndCleanupWolfDuplicates(wolfClients: any[]): Promise<{
  duplicatesFound: boolean;
  duplicatesRemoved: number;
  cleanedClientIds: string[];
}> {
  try {
    // Group clients by client_id to find duplicates
    const clientGroups: { [key: string]: any[] } = {};
    
    wolfClients.forEach((client) => {
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
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] No duplicate clients found in Wolf API response",
        { totalClients: wolfClients.length }
      );
      return {
        duplicatesFound: false,
        duplicatesRemoved: 0,
        cleanedClientIds: []
      };
    }

    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] Duplicate clients detected in Wolf API response",
      {
        duplicateGroups: duplicateGroups.length,
        duplicateClientIds: duplicateGroups.map(([clientId, clients]) => ({ clientId, count: clients.length }))
      }
    );

    // Unpair all duplicates from Wolf
    const cleanedClientIds: string[] = [];
    let duplicatesRemoved = 0;

    for (const [clientId, clients] of duplicateGroups) {
      logger.warn(
        LogComponent.WOLF_UI,
        `[Action] Found duplicate client group - attempting to unpair from Wolf`,
        {
          clientId,
          duplicateCount: clients.length,
          duplicateInstances: clients.map(c => ({
            id: c.id || c.client_id,
            hostname: c.hostname,
            status: c.status
          }))
        }
      );

      // Unpair all instances of this duplicate client ID
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        logger.info(
          LogComponent.WOLF_UI,
          `[Action] Attempting to unpair duplicate client instance ${i + 1}/${clients.length}`,
          {
            clientId,
            instanceIndex: i + 1,
            totalInstances: clients.length,
            clientData: {
              id: client.id || client.client_id,
              hostname: client.hostname,
              status: client.status
            }
          }
        );

        const unpairSuccess = await unpairClientWithWolf(clientId);
        if (unpairSuccess) {
          duplicatesRemoved++;
          if (!cleanedClientIds.includes(clientId)) {
            cleanedClientIds.push(clientId);
          }
          logger.info(
            LogComponent.WOLF_UI,
            `[Action] Successfully unpaired duplicate client instance from Wolf`,
            {
              clientId,
              instanceIndex: i + 1,
              totalRemoved: duplicatesRemoved
            }
          );
        } else {
          logger.error(
            LogComponent.WOLF_UI,
            `[Action] Failed to unpair duplicate client instance from Wolf`,
            new Error("Unpair request failed"),
            {
              clientId,
              instanceIndex: i + 1,
              totalInstances: clients.length
            }
          );
        }
      }
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Wolf duplicate cleanup completed",
      {
        duplicateGroupsFound: duplicateGroups.length,
        duplicatesRemoved,
        cleanedClientIds
      }
    );

    return {
      duplicatesFound: true,
      duplicatesRemoved,
      cleanedClientIds
    };

  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error during Wolf duplicate detection and cleanup",
      error instanceof Error ? error : new Error(String(error)),
      { totalClients: wolfClients.length }
    );
    
    // Return safe defaults on error
    return {
      duplicatesFound: false,
      duplicatesRemoved: 0,
      cleanedClientIds: []
    };
  }
}

// --- Server Actions ---

// New action to handle the full pairing and adding process
export async function pairAndAddClientAction(
  pin: string,
  friendlyName: string,
  pair_secret: string
): Promise<ApiResponse<{ client: ClientDevice }>> {
  const username = await getUsername();
  if (!username) {
    return createErrorResponse(
      API_ERROR_CODES.UNAUTHORIZED,
      "User not authenticated."
    );
  }

  logger.info(LogComponent.WOLF_UI, "[Action] Starting Pair & Add Client", {
    username,
    friendlyName,
    hasPin: !!pin,
    hasPairSecret: !!pair_secret,
  });

  // --- Pre-Pairing Database Load ---
  let user: any;
  let initialClientIds: Set<string>;
  try {
    user = await getUserByUsername(username);
    if (!user) {
      throw new Error(`User '${username}' not found in database`);
    }

    const userClients = await getClientDevicesByUserId(user.id);
    initialClientIds = new Set(userClients.map((c) => c.id));
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Loaded initial client IDs from database",
      { username, userId: user.id, count: initialClientIds.size }
    );
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to load user data before pairing",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    return createErrorResponse(
      API_ERROR_CODES.CONFIG_LOAD_FAILED,
      "Failed to load user configuration."
    );
  }

  // --- Attempt Pairing with Wolf API ---
  const pairResponse = await attemptPairingWithWolf(pin, pair_secret);

  if (!pairResponse.success) {
    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] Pairing attempt failed via Wolf API",
      { username, friendlyName, error: pairResponse.error }
    );
    return createErrorResponse(
      API_ERROR_CODES.PAIRING_FAILED,
      `Pairing failed: ${pairResponse.error || "Unknown reason"}`
    );
  }

  logger.info(
    LogComponent.WOLF_UI,
    "[Action] Pairing successful via Wolf API",
    { username, friendlyName }
  );

  // --- Post-Pairing: Find New Client ID ---
  let newDeviceId: string | null = null;
  const MAX_CONFIRM_RETRIES = 3;
  const CONFIRM_RETRY_DELAY = 500; // ms

  // Get client counts before pairing
  let beforeClients: any[];
  try {
    beforeClients = await getWolfClients();
  } catch (error) {
    // Check if this is a duplicate cleanup error
    if (error instanceof Error && error.message.startsWith('DUPLICATES_REMOVED:')) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Duplicates detected and cleaned up before pairing confirmation",
        { username, friendlyName, error: error.message }
      );
      return createErrorResponse(
        API_ERROR_CODES.CONFLICT,
        error.message.replace('DUPLICATES_REMOVED: ', '')
      );
    }
    throw error; // Re-throw if it's not a duplicate cleanup error
  }
  
  const beforeCounts = new Map<string, number>();
  beforeClients.forEach((client) => {
    const clientId = client.client_id || client.id;
    if (clientId) {
      beforeCounts.set(clientId, (beforeCounts.get(clientId) || 0) + 1);
    }
  });

  for (let attempt = 1; attempt <= MAX_CONFIRM_RETRIES; attempt++) {
    logger.debug(
      LogComponent.WOLF_UI,
      `[Action] DIAGNOSIS: Confirming new client, attempt ${attempt}`,
      { username, friendlyName }
    );
    let foundDeviceIdsInAttempt: string[] = []; // Track IDs found in *this* attempt
    try {
      if (attempt > 1) {
        logger.debug(
          LogComponent.WOLF_UI,
          `[Action] Retrying client list fetch (Attempt ${attempt}/${MAX_CONFIRM_RETRIES})`,
          { username }
        );
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIRM_RETRY_DELAY)
        );
      }

      let wolfClients: any[];
      try {
        wolfClients = await getWolfClients(); // Fetch all clients from Wolf API
      } catch (error) {
        // Check if this is a duplicate cleanup error
        if (error instanceof Error && error.message.startsWith('DUPLICATES_REMOVED:')) {
          logger.warn(
            LogComponent.WOLF_UI,
            "[Action] Duplicates detected and cleaned up during client confirmation",
            { username, friendlyName, attempt, error: error.message }
          );
          return createErrorResponse(
            API_ERROR_CODES.CONFLICT,
            error.message.replace('DUPLICATES_REMOVED: ', '')
          );
        }
        throw error; // Re-throw if it's not a duplicate cleanup error
      }
      
      const currentWolfClientIds = new Set(
        wolfClients.map((c: any) => c.id || c.client_id).filter(Boolean)
      ); // Ensure we get ID/client_id and filter nulls/undefined
      logger.debug(
        LogComponent.WOLF_UI,
        `[Action] Fetched current Wolf client IDs (Attempt ${attempt})`,
        { username, count: currentWolfClientIds.size }
      );

      // CRITICAL FIX: Add the missing client detection logic
      // Compare current Wolf client IDs with existing user's Wolf client IDs to find new clients
      const newClientIds: string[] = [];
      
      // Get existing user clients to determine which Wolf clients are already paired
      const existingUserClients = await getClientDevicesByUserId(user.id);
      const existingWolfClientIds = new Set(
        existingUserClients.map(uc => uc.wolfClientId).filter(Boolean)
      );
      
      logger.debug(
        LogComponent.WOLF_UI,
        `[Action] Existing Wolf client IDs for user (Attempt ${attempt})`,
        {
          username,
          existingWolfClientIds: Array.from(existingWolfClientIds),
          existingCount: existingWolfClientIds.size
        }
      );
      
      // Convert Set to Array for proper iteration
      for (const wolfClientId of Array.from(currentWolfClientIds)) {
        // Check if this Wolf client ID is not in our existing paired clients
        if (!existingWolfClientIds.has(wolfClientId)) {
          newClientIds.push(wolfClientId);
        }
      }

      logger.debug(
        LogComponent.WOLF_UI,
        `[Action] Client detection results (Attempt ${attempt})`,
        {
          username,
          initialDatabaseClients: initialClientIds.size,
          currentWolfClients: currentWolfClientIds.size,
          newClientIds,
          newClientCount: newClientIds.length
        }
      );

      if (newClientIds.length === 1) {
        newDeviceId = newClientIds[0];
        logger.info(
          LogComponent.WOLF_UI,
          `[Action] Successfully detected new client ID (Attempt ${attempt})`,
          { username, newDeviceId, attempt }
        );
        break; // Exit retry loop on success
      } else if (newClientIds.length > 1) {
        logger.warn(
          LogComponent.WOLF_UI,
          `[Action] Multiple new client IDs detected (Attempt ${attempt})`,
          { username, newClientIds, attempt }
        );
        // Don't break, continue retrying as this might be a timing issue
      } else {
        logger.debug(
          LogComponent.WOLF_UI,
          `[Action] No new client IDs detected yet (Attempt ${attempt})`,
          { username, attempt }
        );
        // Continue retrying
      }

      // If it's the last attempt and still no unique ID, log the failure
      if (attempt === MAX_CONFIRM_RETRIES && newDeviceId === null) {
        logger.error(
          LogComponent.WOLF_UI,
          "[Action] Failed to find a unique new device ID after multiple retries",
          new Error(
            "Could not definitively identify the newly paired device ID after retries."
          ),
          {
            username,
            initialCount: initialClientIds.size,
            attempts: MAX_CONFIRM_RETRIES,
          }
        );
      }
    } catch (error) {
      newDeviceId = null; // Invalidate on error too
      logger.error(
        LogComponent.WOLF_UI,
        `[Action] Error fetching/comparing clients after pairing (Attempt ${attempt})`,
        error instanceof Error ? error : new Error(String(error)),
        { username }
      );
      // Break the loop on error
      break;
    }
  }

  // Check if a unique newDeviceId was found after retries
  if (!newDeviceId) {
    // The error was logged inside the loop on the final attempt or if multiple were found
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Pairing seemed successful, but failed to confirm the new device ID after retries. Please check manually."
    );
  }

  // --- Add New Client to Database ---
  try {
    // Check if Wolf client ID already exists for this user
    const existingClientByWolfId = await getClientDeviceByWolfClientId(newDeviceId);
    if (existingClientByWolfId && existingClientByWolfId.userId === user.id) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Newly paired Wolf client ID already exists for user",
        { username, userId: user.id, wolfClientId: newDeviceId }
      );
      return createErrorResponse(
        API_ERROR_CODES.CONFLICT,
        "Device already registered for this user."
      );
    }

    // Create new client device in database
    const newClientData = {
      wolfClientId: newDeviceId,
      userId: user.id,
      friendlyName: friendlyName,
      pairSecret: pair_secret,
    };

    const savedClient = await addClientDevice(newClientData);

    logger.info(LogComponent.WOLF_UI, "[Action] Saved new client to database", {
      username,
      userId: user.id,
      wolfClientId: newDeviceId,
      databaseId: savedClient.id,
    });

    // Convert database client to ClientDevice format for response
    // Note: The UI expects the Wolf client ID as the main ID
    const clientResponse: ClientDevice = {
      id: savedClient.wolfClientId, // Use Wolf client ID for UI compatibility
      friendly_name: savedClient.friendlyName,
      pair_secret: savedClient.pairSecret,
    };

    return createSuccessResponse({ client: clientResponse });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DUPLICATE_CLIENT:')) {
      logger.warn(LogComponent.WOLF_UI, "[Action] Duplicate client detected during pairing", {
        username, friendlyName, error: error.message
      });
      return createErrorResponse(
        API_ERROR_CODES.CONFLICT,
        error.message.replace('DUPLICATE_CLIENT: ', '')
      );
    }
    if (error instanceof Error && error.message.startsWith('DUPLICATE_CLIENT:')) {
      logger.warn(LogComponent.WOLF_UI, "[Action] Duplicate client detected during pairing", {
        username, friendlyName, error: error.message
      });
      return createErrorResponse(
        API_ERROR_CODES.CONFLICT,
        error.message.replace('DUPLICATE_CLIENT: ', '')
      );
    }
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to add client to database",
      error instanceof Error
        ? error
        : new Error(String(error ?? "Unknown error during database save")),
      { username, userId: user.id, deviceId: newDeviceId }
    );
    const errCode = API_ERROR_CODES.INTERNAL_ERROR;
    const errMsg = "Failed to save client device after pairing.";
    return createErrorResponse(errCode, errMsg);
  }
}

/*
 * Manually adds a client device to the user's configuration.
 * Note: This is generally NOT used for the standard PIN-based pairing flow.
 * Use pairAndAddClientAction for that.
 */
export async function addClientAction(
  deviceId: string, // Requires knowing the ID beforehand
  friendlyName: string,
  pair_secret: string // Needs the secret too
): Promise<ApiResponse<{ client: ClientDevice }>> {
  logger.debug(LogComponent.WOLF_UI, "[Action] Starting addClientAction", {
    deviceId,
    friendlyName,
  });

  const username = await getUsername();
  if (!username) {
    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] Unauthorized - no username in session"
    );
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
    // 1. Verify client exists in Wolf after pairing
    const wolfClient = await getWolfClient(deviceId);
    if (!wolfClient) {
      logger.warn(LogComponent.WOLF_UI, "[Action] Client not found in Wolf", {
        deviceId,
      });
      return createErrorResponse(
        "Client device not found",
        API_ERROR_CODES.NOT_FOUND
      );
    }

    // 2. Get user from database
    logger.debug(LogComponent.WOLF_UI, "[Action] Loading user from database", {
      username,
    });
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

    // 3. Add client to database
    const newClientData = {
      wolfClientId: deviceId,
      userId: user.id,
      friendlyName: friendlyName,
      pairSecret: pair_secret,
    };

    const savedClient = await addClientDevice(newClientData);

    logger.info(LogComponent.WOLF_UI, "[Action] Client added successfully", {
      username,
      userId: user.id,
      deviceId,
      friendlyName,
      savedClientId: savedClient.id,
    });

    // 4. Synchronize to ensure consistency
    await synchronizeClientsInternal(username);

    // Convert database client to ClientDevice format for response
    const clientResponse: ClientDevice = {
      id: savedClient.id,
      friendly_name: savedClient.friendlyName,
      pair_secret: savedClient.pairSecret,
    };

    return createSuccessResponse({ client: clientResponse });
  } catch (error) {
    const errorMessage = "Failed to add client";
    logger.error(
      LogComponent.WOLF_UI,
      `[Action] ${errorMessage}`,
      error instanceof Error ? error : new Error(String(error)),
      { username, deviceId }
    );
    return createErrorResponse(
      `${errorMessage}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      API_ERROR_CODES.INTERNAL_ERROR
    );
  }
}

export async function removeClientAction(
  deviceId: string
): Promise<ApiResponse<{}>> {
  const username = await getUsername();
  if (!username) {
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
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

    // 2. Check if client exists in database and is owned by the user
    const clientDevice = await getClientDeviceById(deviceId);
    if (!clientDevice) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client not found in database",
        { username, userId: user.id, deviceId }
      );
      // Try to unpair from Wolf anyway in case it exists there
      const wolfClient = await getWolfClient(deviceId);
      if (wolfClient) {
        await unpairClientWithWolf(deviceId);
        logger.info(
          LogComponent.WOLF_UI,
          "[Action] Unpaired orphaned client from Wolf",
          { deviceId }
        );
      }
      return createSuccessResponse({}); // Consider it a success as the end state is what we want
    }

    // CRITICAL SECURITY CHECK: Verify that the requesting user owns this client
    if (clientDevice.userId !== user.id) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] SECURITY VIOLATION: User attempted to unpair client they don't own",
        {
          requestingUser: username,
          requestingUserId: user.id,
          clientOwnerUserId: clientDevice.userId,
          deviceId,
          securityViolation: true,
        }
      );
      return createErrorResponse(
        "Unauthorized: You can only unpair your own clients",
        API_ERROR_CODES.UNAUTHORIZED
      );
    }

    // 3. Check if client exists in Wolf API and unpair if it does
    const wolfClient = await getWolfClient(deviceId);
    if (wolfClient) {
      const unpairSuccess = await unpairClientWithWolf(deviceId);
      if (!unpairSuccess) {
        logger.error(
          LogComponent.WOLF_UI,
          "[Action] Failed to unpair client with Wolf API",
          undefined,
          { username, userId: user.id, deviceId }
        );
        return createErrorResponse(
          "Failed to unpair client with Wolf API",
          API_ERROR_CODES.INTERNAL_ERROR
        );
      }
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] Successfully unpaired client from Wolf",
        { username, userId: user.id, deviceId }
      );
    } else {
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] Client not found in Wolf API, proceeding with database cleanup",
        { username, userId: user.id, deviceId }
      );
    }

    // 4. Remove client from database
    await deleteClientDevice(deviceId);
    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully removed client from database",
      { username, userId: user.id, deviceId }
    );

    return createSuccessResponse({});
  } catch (error) {
    const errorMessage = "Failed to unpair client";
    logger.error(
      LogComponent.WOLF_UI,
      `[Action] ${errorMessage}`,
      error instanceof Error ? error : new Error(String(error)),
      { username, deviceId }
    );
    return createErrorResponse(
      `${errorMessage}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      API_ERROR_CODES.INTERNAL_ERROR
    );
  }
}

export async function getClientsAction(): Promise<
  ApiResponse<{ clients: ClientDevice[] }>
> {
  logger.debug(
    LogComponent.WOLF_UI,
    "[Action] DIAGNOSIS: getClientsAction called",
    {
      timestamp: new Date().toISOString(),
    }
  );

  const username = await getUsername();
  if (!username) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: getClientsAction - No username from session",
      {
        timestamp: new Date().toISOString(),
      }
    );
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  logger.debug(
    LogComponent.WOLF_UI,
    "[Action] DIAGNOSIS: getClientsAction proceeding with username",
    {
      username,
      timestamp: new Date().toISOString(),
    }
  );

  try {
    // 1. Ensure database is initialized first
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Ensuring database initialization",
      {
        username,
        timestamp: new Date().toISOString(),
      }
    );

    // Import and call database initialization
    const { initializeDatabaseWithMigration } = await import(
      "@/lib/db/initializer"
    );
    try {
      await initializeDatabaseWithMigration();
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] DIAGNOSIS: Database initialization completed",
        {
          username,
          timestamp: new Date().toISOString(),
        }
      );
    } catch (initError) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] DIAGNOSIS: Database initialization failed",
        initError as Error,
        {
          username,
          timestamp: new Date().toISOString(),
        }
      );
      // Continue anyway, the database might already be initialized
    }

    // 2. Get user from database
    const user = await getUserByUsername(username);
    if (!user) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] DIAGNOSIS: User not found in database",
        undefined,
        {
          username,
          timestamp: new Date().toISOString(),
        }
      );
      return createErrorResponse("User not found", API_ERROR_CODES.NOT_FOUND);
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Found user in database",
      {
        username,
        userId: user.id,
        userCreatedAt: user.createdAt,
        timestamp: new Date().toISOString(),
      }
    );

    // 3. Get user's client devices from database
    const userClientDevices = await getClientDevicesByUserId(user.id);

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Retrieved client devices from database",
      {
        username,
        userId: user.id,
        deviceCount: userClientDevices.length,
        deviceIds: userClientDevices.map((d) => d.id),
        timestamp: new Date().toISOString(),
      }
    );

    // 4. Synchronize with Wolf API to ensure we have latest data
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Starting Wolf API sync",
      {
        username,
        timestamp: new Date().toISOString(),
      }
    );

    const syncSuccess = await synchronizeClientsInternal(username);
    if (!syncSuccess) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] DIAGNOSIS: Wolf sync failed, proceeding with database data",
        { username, timestamp: new Date().toISOString() }
      );
    } else {
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] DIAGNOSIS: Wolf sync successful",
        {
          username,
          timestamp: new Date().toISOString(),
        }
      );
    }

    // 5. Re-fetch client devices after sync
    const updatedUserClientDevices = await getClientDevicesByUserId(user.id);

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Retrieved updated client devices after sync",
      {
        username,
        userId: user.id,
        deviceCount: updatedUserClientDevices.length,
        deviceIds: updatedUserClientDevices.map((d) => d.id),
        timestamp: new Date().toISOString(),
      }
    );

    // Convert database format to ClientDevice format for response
    const userClients: ClientDevice[] = updatedUserClientDevices.map(
      (device) => ({
        id: device.id,
        friendly_name: device.friendlyName,
        pair_secret: device.pairSecret,
      })
    );

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: Final client list prepared",
      {
        username,
        userId: user.id,
        userClientCount: userClients.length,
        clientDetails: userClients.map((c) => ({
          id: c.id,
          name: c.friendly_name,
        })),
        timestamp: new Date().toISOString(),
      }
    );

    return createSuccessResponse({ clients: userClients });
  } catch (error) {
    const errorMessage = "Failed to get clients";
    logger.error(
      LogComponent.WOLF_UI,
      `[Action] DIAGNOSIS: ${errorMessage}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        username,
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }
    );
    return createErrorResponse(errorMessage, API_ERROR_CODES.INTERNAL_ERROR);
  }
}

// --- Helper Action: Get ALL paired clients (for filtering pending requests) ---
export async function getAllPairedClientsInternal(): Promise<
  ApiResponse<{ clients: (ClientDevice & { owner?: string })[] }>
> {
  logger.debug(
    LogComponent.WOLF_UI,
    "[Action] Starting getAllPairedClientsInternal - NO USER FILTERING"
  );

  try {
    // 1. Get clients from Wolf API
    const wolfClientsRaw = await getWolfClients();
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Fetched raw clients from Wolf API for pending request filtering",
      { count: wolfClientsRaw.length }
    );

    // 2. Get all users from database to create owner mapping
    const allUsers = await getAllUsers();
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Loaded all users from database",
      { userCount: allUsers.length }
    );

    // 3. Create a map of deviceId -> username from database
    const ownerMap = new Map<string, string>();
    const deviceDetailsMap = new Map<
      string,
      { friendlyName: string; pairSecret: string }
    >();

    for (const user of allUsers) {
      const userClients = await getClientDevicesByUserId(user.id);
      for (const client of userClients) {
        ownerMap.set(client.wolfClientId, user.username);
        deviceDetailsMap.set(client.wolfClientId, {
          friendlyName: client.friendlyName,
          pairSecret: client.pairSecret,
        });
      }
    }

    // 4. Combine Wolf clients with owner info and database details
    const combinedClients: (ClientDevice & { owner?: string })[] =
      wolfClientsRaw
        .map((wolfClient: any) => {
          const deviceId = wolfClient.id || wolfClient.client_id;
          if (!deviceId) {
            return null;
          }

          const owner = ownerMap.get(deviceId);
          const deviceDetails = deviceDetailsMap.get(deviceId);

          // Use database details if available, otherwise fall back to Wolf API details
          const friendlyName =
            deviceDetails?.friendlyName ||
            wolfClient.friendly_name ||
            wolfClient.name ||
            "Unknown";
          const pairSecret = deviceDetails?.pairSecret;

          return {
            id: deviceId,
            friendly_name: friendlyName,
            pair_secret: pairSecret,
            owner: owner,
          };
        })
        .filter(Boolean) as (ClientDevice & { owner?: string })[];

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully retrieved ALL paired clients for pending request filtering",
      {
        totalPairedClients: combinedClients.length,
        clientsWithOwners: combinedClients.filter((c) => c.owner).length,
      }
    );

    return createSuccessResponse({ clients: combinedClients });
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to get all paired clients",
      error instanceof Error ? error : new Error(String(error))
    );
    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Failed to get all paired clients",
      API_ERROR_CODES.INTERNAL_ERROR
    );
  }
}

// --- New Action: List Clients and their Owners (User-Filtered) ---
export async function listClientsAndOwners(): Promise<
  ApiResponse<{ clients: (ClientDevice & { owner?: string })[] }>
> {
  const username = await getUsername();
  logger.debug(LogComponent.WOLF_UI, "[Action] Starting listClientsAndOwners", {
    requestingUser: username,
  });

  if (!username) {
    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] DIAGNOSIS: listClientsAndOwners UNAUTHORIZED - detailed session state",
      {
        usernameValue: username,
        usernameType: typeof username,
        calledFrom: "listClientsAndOwners",
        timestamp: new Date().toISOString(),
        // Note: session details will be logged by getUsername() above
      }
    );
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
    // 1. Get clients from Wolf API
    const wolfClientsRaw = await getWolfClients(); // This returns the raw API response array
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Fetched raw clients from Wolf API",
      { count: wolfClientsRaw.length }
    );

    // 2. Get user from database
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

    // 3. Get user's client devices from database
    const userClientDevices = await getClientDevicesByUserId(user.id);
    const userDeviceIds = new Set(userClientDevices.map((d) => d.wolfClientId));

    // Create device details map for user's devices
    const deviceDetailsMap = new Map<
      string,
      { friendlyName: string; pairSecret: string }
    >();
    userClientDevices.forEach((device) => {
      deviceDetailsMap.set(device.wolfClientId, {
        friendlyName: device.friendlyName,
        pairSecret: device.pairSecret,
      });
    });

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Loaded user's client devices from database",
      { username, userId: user.id, userDeviceCount: userClientDevices.length }
    );

    // 4. Combine Wolf clients with database details, filtering to user's devices only
    const userFilteredClients: (ClientDevice & { owner?: string })[] =
      wolfClientsRaw
        .map((wolfClient: any) => {
          // Use the same robust ID check as in getWolfClients dedupe logic
          const deviceId = wolfClient.id || wolfClient.client_id;

          if (!deviceId) {
            logger.warn(
              LogComponent.WOLF_UI,
              "[Action] Skipping client from Wolf API due to missing ID",
              { wolfClient }
            );
            return null; // Skip this client if it has no ID
          }

          // Only include devices owned by the requesting user
          if (!userDeviceIds.has(deviceId)) {
            return null;
          }

          const deviceDetails = deviceDetailsMap.get(deviceId);

          // Use database details if available, otherwise fall back to Wolf API details
          const friendlyName =
            deviceDetails?.friendlyName ||
            wolfClient.friendly_name ||
            wolfClient.name ||
            "Unknown";
          const pairSecret = deviceDetails?.pairSecret;

          return {
            id: deviceId,
            friendly_name: friendlyName,
            pair_secret: pairSecret,
            owner: username, // All filtered clients belong to the requesting user
          };
        })
        .filter(Boolean) as (ClientDevice & { owner?: string })[]; // Filter out any nulls

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully filtered clients by user ownership",
      {
        requestingUser: username,
        userId: user.id,
        userOwnedClients: userFilteredClients.length,
      }
    );

    return createSuccessResponse({ clients: userFilteredClients });
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to list clients and owners",
      error instanceof Error ? error : new Error(String(error))
    );
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to list clients",
      API_ERROR_CODES.INTERNAL_ERROR
    );
  }
}

/**
 * Server Action to fetch pending pairing requests.
 * This wraps the wolfPairApi call to be safely invoked from Client Components.
 */
export async function getPendingRequestsAction(): Promise<
  ApiResponse<PendingPairRequest[]>
> {
  const username = await getUsername();
  if (!username) {
    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] getPendingRequestsAction called without authenticated user"
    );
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Getting pending requests for user",
      { requestingUser: username }
    );

    // Use authenticated HTTP call to our own API proxy
    // Server actions have access to session context, so we can make authenticated calls
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth");

    const session = await getServerSession(authOptions);
    if (!session) {
      throw new Error("No session available for API call");
    }

    // Make authenticated request to our own API proxy
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:4000";
    const response = await fetch(`${baseUrl}/api/wolf/pair/pending`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: `next-auth.session-token=${session.user?.id}`, // Pass session info
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      requests: Array<{ pair_secret: string; client_ip: string }>;
    };

    if (!data || !data.success) {
      throw new Error(
        `Wolf API returned unsuccessful response: ${JSON.stringify(data)}`
      );
    }

    // Transform the response to match PendingPairRequest interface
    const requests = data.requests.map((request) => ({
      id: request.pair_secret,
      deviceType: `Device at ${request.client_ip}`,
      timestamp: Date.now(),
      pair_secret: request.pair_secret,
    }));

    // NOTE: Pending requests are intentionally global - any authenticated user can pair with any pending request
    // This is by design as clients don't have user association until after pairing
    return createSuccessResponse(requests);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error fetching requests";
    logger.error(
      LogComponent.SYSTEM, // Use LogComponent.SYSTEM for server action errors
      "getPendingRequestsAction failed",
      error instanceof Error ? error : new Error(errorMessage)
    );
    // Use the standardized error response structure
    return createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, errorMessage);
  }
}
