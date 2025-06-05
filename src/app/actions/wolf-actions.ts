"use server";

import { getServerSession } from "next-auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    await logger.warn(LogComponent.WOLF_UI, "Wolf action attempted without authentication");
    return null;
  }
  return session;
}

/**
 * Get client data from Wolf API with config integration
 * Used by the Clients page to display paired clients for the authenticated user
 */
export async function getWolfClientsAction(): Promise<ApiResponse<{ clients: WolfClientWithMetadata[] }>> {
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

    // 4. Filter and map Wolf clients to only include user's clients
    const userClients: WolfClientWithMetadata[] = [];

    for (const wolfClient of data.clients) {
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
    const session = await getAuthenticatedSession();
    if (!session) {
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
    let requests: any[] = [];
    if (Array.isArray(data.requests)) {
      requests = data.requests;
    } else if (Array.isArray(data)) {
      requests = data;
    } else if (data.success && Array.isArray(data.data)) {
      requests = data.data;
    }

    await logger.debug(LogComponent.WOLF_UI, "Successfully retrieved pending requests", {
      userId: session.user.id,
      count: requests.length,
      sampleRequest: requests[0] || "none",
    });

    return createSuccessResponse({ requests });
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
    const initialClientIds = new Set(
      (initialClientsData.clients || []).map((c: any) => c.client_id).filter(Boolean)
    );

    await logger.debug(LogComponent.WOLF_UI, "Initial client list retrieved for pairing", {
      userId: session.user.id,
      initialClientCount: initialClientIds.size,
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
      const currentClientIds = (currentClientsData.clients || []).map((c: any) => c.client_id).filter(Boolean);

      // Find new client ID
      for (const clientId of currentClientIds) {
        if (!initialClientIds.has(clientId)) {
          newClientId = clientId;
          await logger.debug(LogComponent.WOLF_UI, "New client detected after pairing", {
            userId: session.user.id,
            newClientId,
            attempt,
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