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
  
  for (const client of clients) {
    const clientId = client.client_id || client.id;
    if (clientId) {
      // Always take the latest entry (overwrites previous)
      clientMap.set(clientId, client);
    }
  }
  
  return Array.from(clientMap.values());
}

/**
 * Helper function to extract unique client IDs from Wolf clients
 */
function extractUniqueClientIds(clients: any[]): Set<string> {
  const deduplicatedClients = deduplicateWolfClients(clients);
  return new Set(
    deduplicatedClients
      .map(c => c.client_id || c.id)
      .filter(Boolean)
  );
}

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

    // 2. Load configuration to get user-specific client mappings
    let config: Config;
    try {
      config = (await loadConfig(true)) as Config;
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to load config for client filtering", error);
      return createErrorResponse(
        API_ERROR_CODES.CONFIG_LOAD_FAILED,
        "Failed to load configuration"
      );
    }

    // 3. Get user's clients from config
    const userConfig = config.users?.[username];
    const userClientIds = new Set(userConfig?.clients?.map((c) => c.id) || []);

    // 4. Deduplicate Wolf clients and filter to only include user's clients
    const deduplicatedClients = deduplicateWolfClients(data.clients);
    const userClients: WolfClientWithMetadata[] = [];

    await logger.debug(LogComponent.WOLF_UI, "Processing Wolf clients for user filtering", {
      userId: session.user.id,
      username,
      totalWolfClients: data.clients.length,
      deduplicatedWolfClients: deduplicatedClients.length,
      duplicatesRemoved: data.clients.length - deduplicatedClients.length,
    });

    for (const wolfClient of deduplicatedClients) {
      const clientId = wolfClient.client_id || wolfClient.id;
      if (!clientId || !userClientIds.has(clientId)) {
        continue; // Skip clients not owned by this user
      }

      // Find the client in user's config to get friendly name and pair secret
      const configClient = userConfig?.clients?.find((c) => c.id === clientId);
      
      const clientData: WolfClientWithMetadata = {
        id: clientId,
        friendly_name: configClient?.friendly_name || (wolfClient as any).friendly_name || (wolfClient as any).hostname || `Client ${clientId}`,
        pair_secret: configClient?.pair_secret || (wolfClient as any).pair_secret || undefined,
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
 * Pair a new client with Wolf
 */
export async function pairWolfClientAction(
  pin: string,
  pairSecret: string,
  friendlyName?: string
): Promise<ApiResponse<{ success: boolean; clientId?: string }>> {
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

    if (!pin || !pairSecret) {
      return createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        "PIN and pair secret are required"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Attempting client pairing", {
      userId: session.user.id,
      username,
      pinLength: pin.length,
      hasPairSecret: !!pairSecret,
    });

    // Step 1: Get initial client list before pairing
    const socketService = SocketService.getInstance();
    const initialClientsResponse = await socketService.callWolfApi(session, "/clients", {
      method: "GET",
    });

    if (!initialClientsResponse.success) {
      await logger.error(LogComponent.WOLF_UI, "Failed to get initial client list for pairing", {
        userId: session.user.id,
        error: initialClientsResponse.error,
      });
      return createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        "Failed to prepare for pairing"
      );
    }

    const initialClientsData = initialClientsResponse.data as any;
    const initialClients = initialClientsData.clients || [];
    const initialClientIds = extractUniqueClientIds(initialClients);

    await logger.debug(LogComponent.WOLF_UI, "Initial client list retrieved for pairing", {
      userId: session.user.id,
      totalInitialClients: initialClients.length,
      uniqueInitialClientIds: initialClientIds.size,
      duplicatesDetected: initialClients.length > initialClientIds.size,
    });

    // Step 2: Perform pairing
    const response = await socketService.callWolfApi(session, "/pair/client", {
      method: "POST",
      body: {
        pin,
        pair_secret: pairSecret,
      },
    });

    if (!response.success) {
      await logger.warn(LogComponent.WOLF_UI, "Client pairing failed", {
        userId: session.user.id,
        error: response.error,
        statusCode: response.statusCode,
      });
      return createErrorResponse(
        API_ERROR_CODES.PAIRING_FAILED,
        response.error || "Pairing failed"
      );
    }

    await logger.debug(LogComponent.WOLF_UI, "Wolf pairing API call successful", {
      userId: session.user.id,
      responseData: response.data,
    });

    // Step 3: Find the new client by comparing before/after client lists
    let newClientId: string | null = null;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 500; // ms

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        await logger.debug(LogComponent.WOLF_UI, `Retrying client detection (attempt ${attempt}/${MAX_RETRIES})`, {
          userId: session.user.id,
        });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }

      const currentClientsResponse = await socketService.callWolfApi(session, "/clients", {
        method: "GET",
      });

      if (!currentClientsResponse.success) {
        await logger.warn(LogComponent.WOLF_UI, `Failed to get client list on attempt ${attempt}`, {
          userId: session.user.id,
          error: currentClientsResponse.error,
        });
        continue;
      }

      const currentClientsData = currentClientsResponse.data as any;
      const currentClients = currentClientsData.clients || [];
      const currentClientIds = extractUniqueClientIds(currentClients);

      await logger.debug(LogComponent.WOLF_UI, `Client detection attempt ${attempt}`, {
        userId: session.user.id,
        totalCurrentClients: currentClients.length,
        uniqueCurrentClientIds: currentClientIds.size,
        duplicatesDetected: currentClients.length > currentClientIds.size,
        initialClientIds: Array.from(initialClientIds),
        currentClientIds: Array.from(currentClientIds),
      });

      // Find new client ID by comparing unique sets
      for (const clientId of Array.from(currentClientIds)) {
        if (!initialClientIds.has(clientId)) {
          newClientId = clientId;
          await logger.debug(LogComponent.WOLF_UI, "New client detected after pairing", {
            userId: session.user.id,
            newClientId,
            attempt,
            totalClientsBeforePairing: initialClientIds.size,
            totalClientsAfterPairing: currentClientIds.size,
          });
          break;
        }
      }

      if (newClientId) break;
    }

    if (!newClientId) {
      await logger.warn(LogComponent.WOLF_UI, "Could not detect new client after pairing", {
        userId: session.user.id,
        pairSecret,
        maxRetries: MAX_RETRIES,
      });
      return createErrorResponse(
        API_ERROR_CODES.PAIRING_FAILED,
        "Pairing may have succeeded but could not detect new client"
      );
    }

    const clientId = newClientId;

    // Save client to user's config
    let config: Config;
    try {
      await logger.debug(LogComponent.WOLF_UI, "Loading config for pairing save", {
        userId: session.user.id,
        username,
        clientId,
      });
      config = (await loadConfig(true)) as Config;
      await logger.debug(LogComponent.WOLF_UI, "Config loaded successfully for pairing", {
        userId: session.user.id,
        hasUsers: !!config.users,
        userExists: !!config.users?.[username],
      });
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to load config after pairing", error);
      // Return success since Wolf pairing worked, just warn about config
      await logger.warn(LogComponent.WOLF_UI, "Returning success despite config load failure", {
        userId: session.user.id,
        clientId,
      });
      return createSuccessResponse({
        success: true,
        clientId: clientId,
      });
    }

    try {
      // Initialize user config if needed
      if (!config.users) {
        await logger.debug(LogComponent.WOLF_UI, "Initializing users object in config", { userId: session.user.id });
        config.users = {};
      }
      
      if (!config.users[username]) {
        await logger.debug(LogComponent.WOLF_UI, "Creating new user config entry", {
          userId: session.user.id,
          username
        });
        config.users[username] = {
          id: username,
          username: username,
          password_hash: "", // Will be set elsewhere
          is_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          has_changed_password: false,
          clients: [],
        };
      }
      
      if (!config.users[username].clients) {
        await logger.debug(LogComponent.WOLF_UI, "Initializing clients array for user", {
          userId: session.user.id,
          username
        });
        config.users[username].clients = [];
      }

      // Add the new client to user's config
      const newClient: ClientDevice = {
        id: clientId,
        friendly_name: friendlyName || `Client ${clientId}`, // Use provided friendly name or default
        pair_secret: pairSecret,
      };

      await logger.debug(LogComponent.WOLF_UI, "Adding client to user config", {
        userId: session.user.id,
        username,
        newClient,
        existingClientsCount: config.users[username].clients.length,
      });

      config.users[username].clients.push(newClient);

      // Save updated config
      await logger.debug(LogComponent.WOLF_UI, "Attempting to save config after pairing", {
        userId: session.user.id,
        username,
        totalClientsForUser: config.users[username].clients.length,
      });
      
      await saveConfig(config);
      
      await logger.info(LogComponent.WOLF_UI, "Client pairing and config save successful", {
        userId: session.user.id,
        username,
        clientId,
        savedToConfig: true,
      });
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to save config after pairing", error);
      // Return success since Wolf pairing worked, just warn about config
      await logger.warn(LogComponent.WOLF_UI, "Returning success despite config save failure", {
        userId: session.user.id,
        clientId,
      });
      return createSuccessResponse({
        success: true,
        clientId: clientId,
      });
    }

    return createSuccessResponse({
      success: true,
      clientId: clientId,
    });
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error during client pairing", error);
    return createErrorResponse(
      API_ERROR_CODES.INTERNAL_ERROR,
      "Pairing operation failed"
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