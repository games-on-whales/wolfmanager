import { isValidWolfEndpoint } from "@/app/api/wolf/lib/schema";
import { LogComponent, logger } from "@/lib/logger";

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
      // Validate endpoint exists - remove /api/wolf prefix for validation
      const isValid = await isValidWolfEndpoint("/pair/pending", "GET");
      if (!isValid) {
        throw new Error("Endpoint /pair/pending is not available");
      }

      const response = await fetch("/api/wolf/pair/pending", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch pending requests: ${response.statusText}`
        );
      }

      const data = (await response.json()) as WolfPairResponse;

      if (!data.success) {
        throw new Error("API returned unsuccessful response");
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

      // Validate endpoint exists - remove /api/wolf prefix for validation
      const isValid = await isValidWolfEndpoint("/pair/client", "POST");
      if (!isValid) {
        const error = "Endpoint /pair/client is not available";
        await logger.error(LogComponent.WOLF_UI, error);
        throw new Error(error);
      }

      const response = await fetch("/api/wolf/pair/client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          pair_secret: data.requestId,
          friendly_name: data.friendlyName,
          pin: data.pin,
        }),
      });

      let errorData;
      if (!response.ok) {
        try {
          errorData = await response.json();
          await logger.error(LogComponent.WOLF_UI, "Pairing request failed", {
            status: response.status,
            statusText: response.statusText,
            errorData,
          });
        } catch (parseError) {
          await logger.error(
            LogComponent.WOLF_UI,
            "Failed to parse error response",
            {
              status: response.status,
              statusText: response.statusText,
            }
          );
        }
        throw new Error(
          `Failed to pair client: ${response.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`
        );
      }

      const responseData = await response.json();
      await logger.debug(LogComponent.WOLF_UI, "Pairing request successful", {
        clientId: data.requestId,
        response: responseData,
      });

      return responseData;
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
      // Validate endpoint exists - remove /api/wolf prefix for validation
      const isValid = await isValidWolfEndpoint("/clients", "GET");
      if (!isValid) {
        throw new Error("Endpoint /clients is not available");
      }

      const response = await fetch("/api/wolf/clients", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch clients: ${response.statusText}`);
      }

      const data = (await response.json()) as WolfClientsResponse;

      if (!data.success) {
        throw new Error("API returned unsuccessful response");
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
};
