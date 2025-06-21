import { LogComponent, logger } from "@/lib/logger";
import type { ClientSettings, UpdateClientSettingsResponse } from "@/types/wolf";

interface WolfPairResponse {
  success: boolean;
  requests: Array<{
    pair_secret: string;
    client_ip: string;
  }>;
}

interface WolfClientsResponse {
  success: boolean;
  clients: Array<{
    client_id: string;
    friendly_name: string;
    pair_secret: string;
  }>;
}

export interface PendingPairRequest {
  id: string;
  deviceType: string;
  timestamp: number;
  pair_secret: string;
}

export interface PairClientRequest {
  requestId: string;
  friendlyName: string;
  pin: string;
}

export interface PairedClient {
  id: string;
  friendlyName: string;
  pairSecret: string;
}

export const wolfPairApi = {
  // Fetch pending pair requests
  getPendingRequests: async (): Promise<PendingPairRequest[]> => {
    try {
      // Use fetch to call through the proxy route
      const response = await fetch("/api/wolf/pair/pending", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as WolfPairResponse;

      if (!data || !data.success) {
        // Check if data itself is null/undefined or success is false
        throw new Error(
          `API returned unsuccessful or invalid response for pending requests. Response: ${JSON.stringify(
            data
          )}`
        );
      }

      // Transform the response to match our interface
      const transformedRequests: PendingPairRequest[] = data.requests.map(
        (request) => ({
          id: request.pair_secret,
          deviceType: `Device at ${request.client_ip}`,
          timestamp: Date.now(),
          pair_secret: request.pair_secret,
        })
      );

      await logger.debug(
        LogComponent.WOLF_UI,
        "Successfully fetched pending pair requests",
        {
          count: transformedRequests.length,
        }
      );

      return transformedRequests;
    } catch (error) {
      await logger.error(
        LogComponent.WOLF_UI,
        "Failed to fetch pending pair requests",
        { error }
      );
      throw error;
    }
  },

  // Submit pairing request
  submitPairing: async (data: PairClientRequest): Promise<void> => {
    try {
      await logger.debug(LogComponent.WOLF_UI, "Submitting pairing request", {
        requestId: data.requestId,
        friendlyName: data.friendlyName,
      });

      // Use fetch to call through the proxy route
      const response = await fetch("/api/wolf/pair/client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          pair_secret: data.requestId,
          friendly_name: data.friendlyName,
          pin: data.pin,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = (await response.json()) as { success: boolean; error?: string; client_id?: string }; // Define expected response shape

      // Check the response structure and success status
      if (!responseData || !responseData.success) {
        const errorMessage =
          responseData?.error || "Pairing failed with unknown reason";
        await logger.error(LogComponent.WOLF_UI, "Pairing request failed", {
          error: errorMessage,
          requestData: {
            requestId: data.requestId,
            friendlyName: data.friendlyName,
          },
          responseData,
        });
        throw new Error(`Failed to pair client: ${errorMessage}`);
      }

      await logger.debug(LogComponent.WOLF_UI, "Pairing request successful", {
        clientId: data.requestId,
        response: responseData,
      });
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to pair client", {
        error: error instanceof Error ? error : new Error(String(error)),
        requestData: {
          requestId: data.requestId,
          friendlyName: data.friendlyName,
        },
      });
      throw error;
    }
  },

  // Get paired clients
  getClients: async (): Promise<PairedClient[]> => {
    try {
      // Use fetch to call through the proxy route
      const response = await fetch("/api/wolf/clients", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as WolfClientsResponse;

      if (!data || !data.success) {
        // Check if data itself is null/undefined or success is false
        throw new Error(
          `API returned unsuccessful or invalid response for clients. Response: ${JSON.stringify(
            data
          )}`
        );
      }

      // Transform the response to match our interface
      const clients: PairedClient[] = data.clients.map((client) => ({
        id: client.client_id,
        friendlyName: client.friendly_name,
        pairSecret: client.pair_secret,
      }));

      await logger.debug(LogComponent.WOLF_UI, "Successfully fetched clients", {
        count: clients.length,
        clients,
      });

      return clients;
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to fetch clients", {
        error,
      });
      throw error;
    }
  },

  // Update client settings
  updateClientSettings: async (clientId: string, settings: ClientSettings): Promise<void> => {
    try {
      await logger.debug(LogComponent.WOLF_UI, "Updating client settings", {
        clientId,
        settings,
      });

      // Use fetch to call through the proxy route
      const response = await fetch("/api/wolf/clients/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          client_id: clientId,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = (await response.json()) as UpdateClientSettingsResponse;

      // Check the response structure and success status
      if (!responseData || !responseData.success) {
        const errorMessage =
          responseData?.error || "Settings update failed with unknown reason";
        await logger.error(LogComponent.WOLF_UI, "Client settings update failed", {
          error: errorMessage,
          requestData: {
            clientId,
            settings,
          },
          responseData,
        });
        throw new Error(`Failed to update client settings: ${errorMessage}`);
      }

      await logger.debug(LogComponent.WOLF_UI, "Client settings update successful", {
        clientId,
        response: responseData,
      });
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to update client settings", {
        error: error instanceof Error ? error : new Error(String(error)),
        requestData: {
          clientId,
          settings,
        },
      });
      throw error;
    }
  },
};
