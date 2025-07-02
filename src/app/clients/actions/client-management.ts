"use server";
import { getServerSession } from "next-auth/next";
import { LogComponent, logger } from "@/lib/logger";
import { authOptions } from "@/lib/auth";
import {
  addClientDevice,
  deleteClientDevice,
  updateClientDevice,
  getClientDeviceById,
  getClientDeviceByWolfClientId,
} from "@/lib/db/helpers";
import { SocketService } from "@/lib/services/socket-service";

// Action to add a client
export async function addClientAction(clientData: any): Promise<any> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for add client action"
      );
      return null;
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Adding client",
      { userId: session.user.id, clientData }
    );

    const result = await addClientDevice(clientData);

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully added client",
      { userId: session.user.id, clientId: result.id }
    );

    return result;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error adding client",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

// Action to remove a client (includes Wolf API unpair call)
export async function removeClientAction(clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for remove client action"
      );
      return { success: false, error: "No valid session" };
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Removing client",
      { userId: session.user.id, clientId }
    );

    // First, try to get the client by database ID
    let client = await getClientDeviceById(clientId);
    
    // If not found by ID, try by Wolf client ID
    if (!client) {
      client = await getClientDeviceByWolfClientId(clientId);
    }
    
    if (!client) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client not found for removal",
        { userId: session.user.id, clientId }
      );
      return { success: false, error: "Client not found" };
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Found client for removal",
      {
        userId: session.user.id,
        clientId,
        databaseId: client.id,
        wolfClientId: client.wolfClientId,
        friendlyName: client.friendlyName
      }
    );

    // Call Wolf API to unpair the client
    if (client.wolfClientId) {
      try {
        const socketService = SocketService.getInstance();
        const unpairResponse = await socketService.callWolfApi(session, "/unpair/client", {
          method: "POST",
          body: { client_id: client.wolfClientId }
        });

        if (!unpairResponse.success) {
          logger.warn(
            LogComponent.WOLF_UI,
            "[Action] Wolf API unpair failed, proceeding with database removal anyway",
            {
              userId: session.user.id,
              wolfClientId: client.wolfClientId,
              error: unpairResponse.error,
              statusCode: unpairResponse.statusCode
            }
          );
          // Continue with database removal even if Wolf API call fails
        } else {
          logger.info(
            LogComponent.WOLF_UI,
            "[Action] Successfully unpaired client from Wolf",
            { userId: session.user.id, wolfClientId: client.wolfClientId }
          );
        }
      } catch (wolfError) {
        logger.error(
          LogComponent.WOLF_UI,
          "[Action] Exception during Wolf API unpair call, proceeding with database removal",
          wolfError instanceof Error ? wolfError : new Error(String(wolfError)),
          { userId: session.user.id, wolfClientId: client.wolfClientId }
        );
        // Continue with database removal even if Wolf API call throws
      }
    } else {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No Wolf client ID found, skipping Wolf API unpair call",
        { userId: session.user.id, databaseId: client.id }
      );
    }

    // Remove from database
    await deleteClientDevice(client.id);

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully removed client from database",
      {
        userId: session.user.id,
        databaseId: client.id,
        wolfClientId: client.wolfClientId,
        friendlyName: client.friendlyName
      }
    );

    return { success: true };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error removing client",
      error instanceof Error ? error : new Error(String(error))
    );
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Action to update client settings
export async function updateClientSettingsAction(
  clientId: string,
  settings: any
): Promise<any> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for update client settings action"
      );
      return null;
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Updating client settings",
      { userId: session.user.id, clientId, settings }
    );

    const result = await updateClientDevice(clientId, settings);

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully updated client settings",
      { userId: session.user.id, clientId }
    );

    return result;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error updating client settings",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}