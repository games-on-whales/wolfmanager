// File: /app/pair/actions.ts
"use server";

import { callWolfApi } from "@/app/api/wolf/lib/wolf-socket.server";
import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { authOptions } from "@/lib/auth";
import type { Config } from "@/lib/config";
import { loadConfig, saveConfig } from "@/lib/config";
import { LogComponent, logger } from "@/lib/logger";
import type { ClientDevice } from "@/types/client";
import { getServerSession } from "next-auth";

// Helper to get username from session
async function getUsername(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    await logger.debug(LogComponent.WOLF_UI, "[Action] Got session", {
      username: session?.user?.name ?? "none",
      hasSession: !!session,
    });
    return session?.user?.name ?? null;
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to get session",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

export async function addClientAction(
  deviceId: string,
  friendlyName: string
): Promise<ApiResponse<{ client: ClientDevice }>> {
  await logger.debug(
    LogComponent.WOLF_UI,
    "[Action] Starting addClientAction",
    {
      deviceId,
      friendlyName,
    }
  );

  const username = await getUsername();
  if (!username) {
    await logger.warn(
      LogComponent.WOLF_UI,
      "[Action] Unauthorized - no username in session"
    );
    return createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED);
  }

  try {
    // 1. Check if client exists in Wolf
    const wolfClient = await getWolfClient(deviceId);
    if (!wolfClient) {
      await logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client not found in Wolf",
        { deviceId }
      );
      return createErrorResponse(
        "Client device not found via Wolf API",
        API_ERROR_CODES.NOT_FOUND
      );
    }

    // 2. Load config
    await logger.debug(LogComponent.WOLF_UI, "[Action] Loading config", {
      username,
    });
    const config = (await loadConfig(true)) as Config;
    if (!config.clients) {
      config.clients = [];
    }

    // 3. Check if client already paired
    if (config.clients.some((c) => c.id === deviceId)) {
      await logger.warn(
        LogComponent.WOLF_UI,
        "[Action] Client already paired",
        { deviceId, username }
      );
      return createErrorResponse(
        "Client already paired",
        API_ERROR_CODES.CONFLICT
      );
    }

    // 4. Add client to config
    const newClient: ClientDevice = {
      id: deviceId,
      friendly_name: friendlyName,
      pair_secret: "", // Added as required by type
    };
    config.clients.push(newClient);

    // 5. Save config
    await logger.debug(LogComponent.WOLF_UI, "[Action] Saving config", {
      username,
      deviceId,
    });
    await saveConfig(config);

    await logger.info(
      LogComponent.WOLF_UI,
      "[Action] Client added successfully",
      { username, deviceId, friendlyName }
    );

    return createSuccessResponse({ client: newClient });
  } catch (error) {
    const errorMessage = "Failed to pair client";
    await logger.error(
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

// Helper to get a client directly from Wolf API (Server-side only)
async function getWolfClient(deviceId: string): Promise<any | null> {
  try {
    await logger.debug(LogComponent.WOLF_UI, "[Action] Getting Wolf client", {
      deviceId,
    });
    const response = await callWolfApi(`/clients/${deviceId}`);
    await logger.debug(LogComponent.WOLF_UI, "[Action] Got Wolf client", {
      deviceId,
      hasResponse: !!response,
    });
    return response;
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "[Action] Failed to get client from Wolf",
      error instanceof Error ? error : new Error(String(error)),
      { deviceId }
    );
    return null;
  }
}