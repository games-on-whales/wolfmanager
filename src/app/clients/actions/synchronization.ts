"use server";
import { getServerSession } from "next-auth/next";
import { LogComponent, logger } from "@/lib/logger";
import { authOptions } from "@/lib/auth";
import {
  getClientDevicesByUserId,
  getAllUsers,
} from "@/lib/db/helpers";

// Action to get clients
import { WolfEventService } from "@/lib/services/wolf-event.service";
import { SocketService } from "@/lib/services/socket-service";

export async function getClientsAction(): Promise<any[]> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for get clients action"
      );
      return [];
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Attempting to fetch clients from cache",
      { userId: session.user.id }
    );

    const cachedClients = WolfEventService.getInstance().getAllClientStates();

    if (cachedClients.length > 0) {
      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Cache hit for clients",
        { userId: session.user.id, clientCount: cachedClients.length }
      );
      return cachedClients;
    }

    logger.warn(
      LogComponent.WOLF_UI,
      "[Action] Cache miss for clients, falling back to database",
      { userId: session.user.id }
    );

    const clients = await getClientDevicesByUserId(session.user.id);

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully fetched clients from database",
      { userId: session.user.id, clientCount: clients.length }
    );

    return clients;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error fetching clients",
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
}

// Internal function to list all clients and their owners
export async function listClientsAndOwners(): Promise<any[]> {
  try {
    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Listing all clients and their owners"
    );

    const users = await getAllUsers();
    const clientsAndOwners = [];

    for (const user of users) {
      const clients = await getClientDevicesByUserId(user.id);
      clientsAndOwners.push({ user, clients });
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully listed clients and owners",
      { userCount: users.length }
    );

    return clientsAndOwners;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error listing clients and owners",
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
}

// Action to get paired clients with settings
export async function getPairedClientsWithSettingsAction(): Promise<{ success: boolean; data?: { clients: any[] }; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for get paired clients action"
      );
      return { success: false, error: "No valid session" };
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Fetching paired clients with settings",
      { userId: session.user.id }
    );

    const rawClients = await getClientDevicesByUserId(session.user.id);

    // Fetch current settings from Wolf API
    let wolfClientsWithSettings: any[] = [];
    try {
      const socketService = SocketService.getInstance();
      const wolfResponse = await socketService.callWolfApi(session, "/clients", {
        method: "GET",
      });

      if (wolfResponse.success) {
        const wolfData = wolfResponse.data as any;
        if (wolfData && typeof wolfData === "object" && wolfData.success === true && Array.isArray(wolfData.clients)) {
          wolfClientsWithSettings = wolfData.clients;
          logger.debug(
            LogComponent.WOLF_UI,
            "[Action] Successfully fetched settings from Wolf API",
            { userId: session.user.id, wolfClientCount: wolfClientsWithSettings.length }
          );
        }
      } else {
        logger.warn(
          LogComponent.WOLF_UI,
          "[Action] Failed to fetch settings from Wolf API, continuing with empty settings",
          { userId: session.user.id, error: wolfResponse.error }
        );
      }
    } catch (error) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Wolf API unavailable, continuing with empty settings",
        error instanceof Error ? error : new Error(String(error)),
        { userId: session.user.id }
      );
    }

    // Create a map of Wolf client settings by client ID for quick lookup
    const wolfSettingsMap = new Map<string, any>();
    wolfClientsWithSettings.forEach(wolfClient => {
      const clientId = wolfClient.client_id || wolfClient.id;
      if (clientId) {
        wolfSettingsMap.set(clientId, wolfClient);
      }
    });

    // Transform camelCase database fields to snake_case for UI compatibility and merge with Wolf API settings
    const clients = rawClients.map(client => {
      const wolfClient = wolfSettingsMap.get(client.wolfClientId);
      let settings = undefined;

      if (wolfClient) {
        // Transform settings from Wolf API format to expected format
        // Wolf API uses uppercase controllers (e.g., "XBOX"), form expects lowercase (e.g., "xbox")
        const rawSettings = wolfClient.settings || wolfClient;
        if (rawSettings) {
          settings = {
            controllers_override: rawSettings.controllers_override?.map((controller: string) =>
              controller.toLowerCase()
            ) || ["auto"],
            mouse_acceleration: rawSettings.mouse_acceleration || 1.0,
            h_scroll_acceleration: rawSettings.h_scroll_acceleration || 1.0,
            v_scroll_acceleration: rawSettings.v_scroll_acceleration || 1.0,
          };
        }
      }

      // **KEY LOGIC**: If Wolf doesn't specify an app_state_folder, populate it with the unique wolf_client_id
      // This makes the default behavior explicit and visible to the user
      // - If Wolf returns undefined: Use client's unique ID as default
      // - If Wolf returns empty string: Respect it (shared root)
      // - If Wolf returns a custom value: Use that value
      const appStateFolder = wolfClient?.app_state_folder !== undefined
        ? wolfClient.app_state_folder
        : client.wolfClientId; // Use unique ID as default

      return {
        id: client.id,
        wolf_client_id: client.wolfClientId,
        friendly_name: client.friendlyName,
        pair_secret: client.pairSecret,
        created_at: client.createdAt,
        updated_at: client.updatedAt,
        last_seen: client.lastSeen,
        user_id: client.userId,
        // Add default values for fields that UI expects
        device_type: wolfClient?.device_type || 'Unknown',
        status: wolfClient?.status || 'paired',
        owner: 'Current User',
        // Include settings from Wolf API
        settings: settings,
        app_state_folder: appStateFolder,
      };
    });

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Successfully fetched and transformed paired clients with settings",
      {
        userId: session.user.id,
        clientCount: clients.length,
        clientsWithSettings: clients.filter(c => c.settings).length,
        wolfApiAvailable: wolfClientsWithSettings.length > 0
      }
    );

    return { success: true, data: { clients } };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error fetching paired clients with settings",
      error instanceof Error ? error : new Error(String(error))
    );
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}