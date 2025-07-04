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

    // Transform camelCase database fields to snake_case for UI compatibility
    const clients = rawClients.map(client => ({
      id: client.id,
      wolf_client_id: client.wolfClientId,
      friendly_name: client.friendlyName,
      pair_secret: client.pairSecret,
      created_at: client.createdAt,
      updated_at: client.updatedAt,
      last_seen: client.lastSeen,
      user_id: client.userId,
      // Add default values for fields that UI expects
      device_type: 'Unknown',
      status: 'paired',
      owner: 'Current User'
    }));

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully fetched and transformed paired clients with settings",
      { userId: session.user.id, clientCount: clients.length }
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