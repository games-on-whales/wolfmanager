"use server";

import { SocketService } from "@/lib/services/socket-service";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import type { PendingPairRequest } from "@/lib/api/wolf-pair"; // Import PendingPairRequest
import { authOptions } from "@/lib/auth";
import type { Config } from "@/lib/config";
import { loadConfig, saveConfig } from "@/lib/config";
import { ConfigError } from "@/lib/errors";
import { LogComponent, logger } from "@/lib/logger";
import type { ClientDevice } from "@/types/client";
import { getServerSession } from "next-auth";

interface WolfPairResponse {
  success: boolean;
  error?: string;
}

// Helper to get username from session
async function getUsername(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    logger.debug(LogComponent.WOLF_UI, "[Action] Got session", {
      username: session?.user?.name ?? "none",
      hasSession: !!session,
    });
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

// Helper to get a client directly from Wolf API (Server-side only)
async function getWolfClient(deviceId: string): Promise<any | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(LogComponent.WOLF_UI, "[Action] No session for Wolf client request", {
        deviceId,
      });
      return null;
    }

    logger.debug(LogComponent.WOLF_UI, "[Action] Getting Wolf client", {
      deviceId,
      userId: session.user.id,
    });

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, `/clients/${deviceId}`, {
      method: "GET",
    });

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
      logger.warn(LogComponent.WOLF_UI, "[Action] No session for Wolf clients request");
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

      // Deduplicate based on client_id or id
      const uniqueClientsMap = new Map<string, any>();
      rawClients.forEach((client: any) => {
        const clientId = client.client_id || client.id;
        if (clientId && !uniqueClientsMap.has(clientId)) {
          uniqueClientsMap.set(clientId, client);
        } else if (clientId) {
          // Log detected duplicate from API response using debug level
          logger.debug(
            LogComponent.WOLF_UI,
            "[Action] Duplicate client ID detected in /clients API response",
            { clientId }
          );
        }
      });
      const uniqueClients = Array.from(uniqueClientsMap.values());

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

    // Get clients from Wolf
    const wolfClients = await getWolfClients();
    const wolfClientIds = new Set(wolfClients.map((c: any) => c.id));

    logger.debug(LogComponent.WOLF_UI, "[Action] Loading config", {
      username,
    });
    // Load current user config
    const config = (await loadConfig(true)) as Config;
    if (!config.clients) {
      config.clients = [];
    }

    const initialCount = config.clients.length;
    let changed = false;

    // Remove orphaned clients
    config.clients = config.clients.filter((client: ClientDevice) => {
      const exists = wolfClientIds.has(client.id);
      if (!exists) {
        changed = true;
        logger.info(
          LogComponent.WOLF_UI,
          `[Action] Removing orphaned client: ${client.id}`,
          { username }
        );
      }
      return exists;
    });

    // Save updated config only if changes were made
    if (changed) {
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] Saving updated config",
        {
          username,
          initialCount,
          finalCount: config.clients.length,
        }
      );
      await saveConfig(config);
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Client synchronization completed",
      {
        username,
        initialCount,
        finalCount: config.clients.length,
        removedCount: initialCount - config.clients.length,
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
      logger.warn(LogComponent.WOLF_UI, "[Action] No session for pairing attempt");
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

    const pairResponse = response.data as WolfPairResponse;

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Pairing attempt response",
      {
        success: pairResponse?.success ?? false,
        error: pairResponse?.error,
        userId: session.user.id,
      }
    );
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
      logger.warn(LogComponent.WOLF_UI, "[Action] No session for unpair attempt", {
        deviceId,
      });
      return false;
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Unpairing client with Wolf API",
      { deviceId, userId: session.user.id, requestBody: { client_id: deviceId } }
    );

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(session, "/unpair/client", {
      method: "POST",
      body: {
        client_id: deviceId,
      },
    });

    if (!response.success) {
      logger.warn(LogComponent.WOLF_UI, "[Action] Unpair failed", {
        deviceId,
        userId: session.user.id,
        error: response.error,
      });
      return false;
    }

    const unpairResponse = response.data as WolfPairResponse;
    logger.debug(LogComponent.WOLF_UI, "[Action] Unpair response", {
      deviceId,
      userId: session.user.id,
      success: unpairResponse?.success ?? false,
      error: unpairResponse?.error,
    });

    if (!unpairResponse?.success) {
      logger.warn(LogComponent.WOLF_UI, "[Action] Unpair response indicated failure", {
        deviceId,
        userId: session.user.id,
        error: unpairResponse?.error,
      });
      return false;
    }

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

  logger.info(
    LogComponent.WOLF_UI,
    "[Action] Starting Pair & Add Client",
    {
      username,
      friendlyName,
      hasPin: !!pin,
      hasPairSecret: !!pair_secret,
    }
  );

  // --- Pre-Pairing Config Load ---
  let config: Config;
  let initialClientIds: Set<string>;
  try {
    config = (await loadConfig(true)) as Config; // Load mutable config
    const userConfig = config?.users?.[username];
    initialClientIds = new Set(userConfig?.clients?.map((c) => c.id) ?? []);
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Loaded initial client IDs",
      { username, count: initialClientIds.size }
    );
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to load config before pairing",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    return createErrorResponse(
      API_ERROR_CODES.CONFIG_LOAD_FAILED,
      "Failed to load configuration."
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

  // --- Post-Pairing: Fetch Updated Clients & Find New ID ---
  let newDeviceId: string | null = null;
  const MAX_CONFIRM_RETRIES = 3;
  const CONFIRM_RETRY_DELAY = 500; // ms

  for (let attempt = 1; attempt <= MAX_CONFIRM_RETRIES; attempt++) {
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

      const wolfClients = await getWolfClients(); // Fetch all clients from Wolf API
      const currentWolfClientIds = new Set(
        wolfClients.map((c: any) => c.id || c.client_id).filter(Boolean)
      ); // Ensure we get ID/client_id and filter nulls/undefined
      logger.debug(
        LogComponent.WOLF_UI,
        `[Action] Fetched current Wolf client IDs (Attempt ${attempt})`,
        { username, count: currentWolfClientIds.size }
      );

      // Find the difference(s)
      currentWolfClientIds.forEach((id) => {
        if (!initialClientIds.has(id)) {
          foundDeviceIdsInAttempt.push(id); // Add all new IDs found in this attempt
        }
      });

      // Check the count of *new* IDs found in this specific attempt
      if (foundDeviceIdsInAttempt.length === 1) {
        newDeviceId = foundDeviceIdsInAttempt[0]; // Exactly one new ID found
        logger.info(
          LogComponent.WOLF_UI,
          `[Action] Identified unique new device ID on attempt ${attempt}`,
          { username, newDeviceId }
        );
        break; // Exit retry loop successfully
      } else if (foundDeviceIdsInAttempt.length > 1) {
        // Multiple new IDs found - ambiguous
        newDeviceId = null; // Reset/invalidate newDeviceId for this attempt
        logger.warn(
          LogComponent.WOLF_UI,
          `[Action] Found multiple (${foundDeviceIdsInAttempt.length}) new device IDs on attempt ${attempt}. Ambiguous. Retrying...`,
          { username, foundIds: foundDeviceIdsInAttempt }
        );
        // Continue to next retry attempt
      } else {
        // Zero new IDs found
        newDeviceId = null; // Reset/invalidate newDeviceId for this attempt
        logger.debug(
          LogComponent.WOLF_UI,
          `[Action] No new device IDs found on attempt ${attempt}. Retrying...`,
          { username }
        );
        // Continue to next retry attempt
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

  // --- Add New Client to Config ---
  try {
    // Ensure user structure exists
    if (!config.users) config.users = {};
    if (!config.users[username]) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] User config structure missing after load",
        new ConfigError("User config structure missing"),
        { username }
      );
      throw new ConfigError(
        `Configuration structure for user '${username}' is missing.`
      );
    }
    if (!config.users[username].clients) {
      config.users[username].clients = [];
    }

    // Check if ID already exists IN THE USER'S LIST
    if (
      config.users[username].clients.some((client) => client.id === newDeviceId)
    ) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Newly paired device ID already exists in user config list",
        { username, deviceId: newDeviceId }
      );
      return createErrorResponse(
        API_ERROR_CODES.CONFLICT,
        "Device already registered for this user."
      );
    }

    const newClient: ClientDevice = {
      id: newDeviceId,
      friendly_name: friendlyName,
      pair_secret: pair_secret,
    };

    // ADD TO USER'S LIST (Correct location for ownership tracking)
    config.users[username].clients.push(newClient);
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Added new client to user's config list",
      { username, deviceId: newDeviceId }
    );

    // WORKAROUND: ADD DUPLICATE TO TOP-LEVEL LIST for saveConfig compatibility
    if (!config.clients) {
      config.clients = []; // Initialize top-level array if it doesn't exist
    }
    // Check if the ID already exists in the top-level list before adding
    if (!config.clients.some((client) => client.id === newDeviceId)) {
      config.clients.push(newClient);
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] (Workaround) Added new client to top-level config list",
        { deviceId: newDeviceId }
      );
    } else {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] (Workaround) Client ID already exists in top-level config list, not adding duplicate.",
        { deviceId: newDeviceId }
      );
    }

    await saveConfig(config);
    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Saved config with new client",
      { username, deviceId: newDeviceId }
    );

    return createSuccessResponse({ client: newClient });
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to add client to config or save",
      error instanceof Error
        ? error
        : new Error(String(error ?? "Unknown error during config save")),
      { username, deviceId: newDeviceId }
    );
    const errCode =
      error instanceof ConfigError
        ? API_ERROR_CODES.CONFIG_SAVE_FAILED
        : API_ERROR_CODES.INTERNAL_ERROR;
    const errMsg =
      error instanceof ConfigError
        ? error.message
        : "Failed to save configuration after pairing.";
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
  logger.debug(
    LogComponent.WOLF_UI,
    "[Action] Starting addClientAction",
    {
      deviceId,
      friendlyName,
    }
  );

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
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client not found in Wolf",
        { deviceId }
      );
      return createErrorResponse(
        "Client device not found",
        API_ERROR_CODES.NOT_FOUND
      );
    }

    // 2. Load config
    logger.debug(LogComponent.WOLF_UI, "[Action] Loading config", {
      username,
    });
    const config = (await loadConfig(true)) as Config;
    if (!config.clients) {
      config.clients = [];
    }

    // 3. Add client to config with pair_secret
    const newClient: ClientDevice = {
      id: deviceId,
      friendly_name: friendlyName,
      pair_secret: pair_secret,
    };
    config.clients.push(newClient);

    // 4. Save config
    logger.debug(LogComponent.WOLF_UI, "[Action] Saving config", {
      username,
      deviceId,
    });
    await saveConfig(config);

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Client added successfully",
      { username, deviceId, friendlyName }
    );

    // 5. Synchronize to ensure consistency
    await synchronizeClientsInternal(username);

    return createSuccessResponse({ client: newClient });
  } catch (error) {
    const errorMessage = "Failed to pair client";
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
    // 1. Check if client exists in Wolf API
    const wolfClient = await getWolfClient(deviceId);
    if (!wolfClient) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client not found in Wolf API",
        { username, deviceId }
      );
      // If client doesn't exist in Wolf, we should still clean up TOML
      const config = (await loadConfig(true)) as Config;
      if (config.clients) {
        config.clients = config.clients.filter((c) => c.id !== deviceId);
        await saveConfig(config);
        logger.info(
          LogComponent.WOLF_UI,
          "[Action] Removed orphaned client from config",
          { username, deviceId }
        );
      }
      return createSuccessResponse({}); // Consider it a success as the end state is what we want
    }

    // 2. Unpair with Wolf API since client exists
    const unpairSuccess = await unpairClientWithWolf(deviceId);
    if (!unpairSuccess) {
      return createErrorResponse(
        "Failed to unpair client with Wolf API",
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }

    // 3. Clean up TOML config
    const config = (await loadConfig(true)) as Config;

    // Find the user who owns this client
    let ownerUsername: string | null = null;
    let clientIndex = -1;

    if (config.users) {
      for (const [uName, uConfig] of Object.entries(config.users)) {
        if (uConfig.clients) {
          clientIndex = uConfig.clients.findIndex((c) => c.id === deviceId);
          if (clientIndex !== -1) {
            ownerUsername = uName;
            break;
          }
        }
      }
    }

    // CRITICAL SECURITY CHECK: Verify that the requesting user owns this client
    if (ownerUsername && ownerUsername !== username) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] SECURITY VIOLATION: User attempted to unpair client they don't own",
        {
          requestingUser: username,
          clientOwner: ownerUsername,
          deviceId,
          securityViolation: true
        }
      );
      return createErrorResponse(
        "Unauthorized: You can only unpair your own clients",
        API_ERROR_CODES.UNAUTHORIZED
      );
    }

    // Remove client from the owner's list if found
    let clientRemovedFromConfig = false;
    if (
      ownerUsername &&
      config.users?.[ownerUsername]?.clients &&
      clientIndex !== -1
    ) {
      config.users[ownerUsername].clients.splice(clientIndex, 1);
      clientRemovedFromConfig = true;
      logger.debug(
        LogComponent.WOLF_UI,
        "[Action] Removed client from owner in config object",
        { ownerUsername, deviceId }
      );
    } else {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] SECURITY ISSUE: Client to unpair not found in any user config - possible orphaned client",
        {
          deviceId,
          requestingUser: username,
          securityNote: "Allowing removal since client has no owner in config"
        }
      );
    }

    // 4. Save config if we removed the client
    if (clientRemovedFromConfig) {
      await saveConfig(config);
      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Saved config after removing client",
        { owner: ownerUsername, deviceId }
      );
    } else if (ownerUsername) {
      // This case shouldn't happen if clientIndex was found, but log just in case
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client found in config but removal logic failed?",
        { owner: ownerUsername, deviceId }
      );
    } else if (unpairSuccess) {
      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Client was not in config, but unpairing via API succeeded",
        { deviceId }
      );
    }

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
  const username = await getUsername();
  if (!username) {
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
    // 1. Synchronize first to ensure local config is up-to-date
    const syncSuccess = await synchronizeClientsInternal(username);
    if (!syncSuccess) {
      // Logged internally, but proceed to load potentially stale config
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Proceeding to load clients after sync failure",
        { username }
      );
    }

    // 2. Load config
    const config = (await loadConfig(true)) as Config;
    
    // CRITICAL SECURITY FIX: Filter clients to only show user's own clients
    let userClients: ClientDevice[] = [];
    if (config.users?.[username]?.clients) {
      userClients = config.users[username].clients;
    }

    logger.info(LogComponent.WOLF_UI, "[Action] SECURITY FIX: Fetched only user's clients", {
      username,
      userClientCount: userClients.length,
      totalClientsInConfig: config.clients?.length || 0,
    });

    return createSuccessResponse({ clients: userClients });
  } catch (error) {
    const errorMessage = "Failed to get clients";
    logger.error(
      LogComponent.WOLF_UI,
      `[Action] ${errorMessage}`,
      error instanceof Error ? error : new Error(String(error)),
      { username }
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

    // 2. Load full configuration
    const config = (await loadConfig(true)) as Config;
    logger.debug(LogComponent.WOLF_UI, "[Action] Loaded configuration");

    // 3. Create a map of deviceId -> username from config
    const ownerMap = new Map<string, string>();
    if (config.users) {
      for (const [username, userConfig] of Object.entries(config.users)) {
        if (userConfig.clients) {
          for (const client of userConfig.clients) {
            if (client.id) {
              ownerMap.set(client.id, username);
            }
          }
        }
      }
    }

    // 4. Combine Wolf clients with owner info and config details
    const combinedClients: (ClientDevice & { owner?: string })[] =
      wolfClientsRaw
        .map((wolfClient: any) => {
          const deviceId = wolfClient.id || wolfClient.client_id;
          if (!deviceId) {
            return null;
          }

          const owner = ownerMap.get(deviceId);
          let friendlyName = wolfClient.friendly_name || wolfClient.name || "Unknown";
          let pairSecret: string | undefined = undefined;

          // Try to find the matching client in the config to get pair secret
          let foundInConfig = false;
          if (owner && config.users?.[owner]?.clients) {
            const configClient = config.users[owner].clients.find(
              (c) => c.id === deviceId
            );
            if (configClient) {
              friendlyName = configClient.friendly_name || friendlyName;
              pairSecret = configClient.pair_secret;
              foundInConfig = true;
            }
          }

          // If not found under the mapped owner, search all users
          if (!foundInConfig) {
            if (config.users) {
              outerLoop: for (const userConfig of Object.values(config.users)) {
                if (userConfig.clients) {
                  for (const client of userConfig.clients) {
                    if (client.id === deviceId) {
                      friendlyName = client.friendly_name || friendlyName;
                      pairSecret = client.pair_secret;
                      break outerLoop;
                    }
                  }
                }
              }
            }
          }

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
        totalPairedClients: combinedClients.length
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
      error instanceof Error ? error.message : "Failed to get all paired clients",
      API_ERROR_CODES.INTERNAL_ERROR
    );
  }
}

// --- New Action: List Clients and their Owners (User-Filtered) ---
export async function listClientsAndOwners(): Promise<
  ApiResponse<{ clients: (ClientDevice & { owner?: string })[] }>
> {
  const username = await getUsername();
  logger.debug(
    LogComponent.WOLF_UI,
    "[Action] Starting listClientsAndOwners",
    { requestingUser: username }
  );

  if (!username) {
    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] listClientsAndOwners called without authenticated user"
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

    // 2. Load full configuration
    const config = (await loadConfig(true)) as Config;
    logger.debug(LogComponent.WOLF_UI, "[Action] Loaded configuration");

    // 3. Create a map of deviceId -> username from config
    const ownerMap = new Map<string, string>();
    if (config.users) {
      for (const [username, userConfig] of Object.entries(config.users)) {
        if (userConfig.clients) {
          for (const client of userConfig.clients) {
            if (client.id) {
              // Ensure client has an ID
              // Handle potential duplicates? Last one wins for now.
              if (ownerMap.has(client.id)) {
                logger.warn(
                  LogComponent.WOLF_UI,
                  `[Action] Client ID ${client.id} found for multiple users. Overwriting owner.`,
                  { previousOwner: ownerMap.get(client.id), newOwner: username }
                );
              }
              ownerMap.set(client.id, username);
            }
          }
        }
      }
    }
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Created owner map from config",
      { mapSize: ownerMap.size }
    );

    // 4. Combine Wolf clients with owner info and config details
    const combinedClients: (ClientDevice & { owner?: string })[] =
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

          const owner = ownerMap.get(deviceId);
          let friendlyName =
            wolfClient.friendly_name || wolfClient.name || "Unknown"; // Get name from API if possible
          let pairSecret: string | undefined = undefined; // Initialize pairSecret

          // Try to find the matching client in the config to get friendly_name and PAIR SECRET
          let foundInConfig = false;
          if (owner && config.users?.[owner]?.clients) {
            const configClient = config.users[owner].clients.find(
              (c) => c.id === deviceId
            );
            if (configClient) {
              friendlyName = configClient.friendly_name || friendlyName; // Prefer config name
              pairSecret = configClient.pair_secret; // GET ACTUAL SECRET
              foundInConfig = true;
            }
          }

          // If not found under the mapped owner, search all users
          if (!foundInConfig) {
            if (config.users) {
              outerLoop: for (const userConfig of Object.values(config.users)) {
                if (userConfig.clients) {
                  for (const client of userConfig.clients) {
                    if (client.id === deviceId) {
                      friendlyName = client.friendly_name || friendlyName;
                      pairSecret = client.pair_secret; // GET ACTUAL SECRET
                      break outerLoop;
                    }
                  }
                }
              }
            }
          }

          return {
            id: deviceId,
            friendly_name: friendlyName,
            pair_secret: pairSecret, // Actual secret (or undefined)
            owner: owner,
          };
        })
        .filter(Boolean) as (ClientDevice & { owner?: string })[]; // Filter out any nulls

    // CRITICAL SECURITY FIX: Filter to only show clients owned by the requesting user
    const userFilteredClients = combinedClients.filter((client) => {
      return client.owner === username;
    });

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully filtered clients by user ownership",
      {
        requestingUser: username,
        userOwnedClients: userFilteredClients.length
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
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:4000';
    const response = await fetch(`${baseUrl}/api/wolf/pair/pending`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `next-auth.session-token=${session.user?.id}`, // Pass session info
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json() as { success: boolean; requests: Array<{ pair_secret: string; client_ip: string; }> };

    if (!data || !data.success) {
      throw new Error(`Wolf API returned unsuccessful response: ${JSON.stringify(data)}`);
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
