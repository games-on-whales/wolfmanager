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
  }>;
}

export interface PendingPairRequest {
  id: string;
  deviceType: string;
  timestamp: number;
}

export interface PairClientRequest {
  requestId: string;
  friendlyName: string;
  pin: string;
}

export interface PairedClient {
  id: string;
  friendlyName: string;
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
          deviceType: `Device at ${request.client_ip}`, // Using IP as device type for now
          timestamp: Date.now(), // Using current timestamp since API doesn't provide one
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
      // Validate endpoint exists - remove /api/wolf prefix for validation
      const isValid = await isValidWolfEndpoint("/pair/client", "POST");
      if (!isValid) {
        throw new Error("Endpoint /pair/client is not available");
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `Failed to pair client: ${response.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`
        );
      }

      await logger.debug(LogComponent.WOLF_UI, "Successfully paired client", {
        clientId: data.requestId,
      });

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to pair client", {
        error,
        requestData: data,
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
      }));

      await logger.debug(LogComponent.WOLF_UI, "Successfully fetched clients", {
        count: clients.length,
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
