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

export interface PairedClient {
  id: string;
  friendlyName: string;
  pairSecret: string;
}

export const wolfPairServerApi = {
  // Fetch pending pair requests (server-side)
  getPendingRequests: async (sessionToken?: string): Promise<PendingPairRequest[]> => {
    try {
      // Use internal fetch to proxy endpoint for server-side calls
      // For server-side calls within container, always use internal port 3000
      // NEXTAUTH_URL is for external access, but we need internal container communication
      const baseUrl = 'http://localhost:3000';
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // If we have a session token, pass it in the headers
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const response = await fetch(`${baseUrl}/api/wolf/pair/pending`, {
        method: "GET",
        headers,
        cache: 'no-store', // Don't cache server-side requests
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as WolfPairResponse;

      if (!data || !data.success) {
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
        "Successfully fetched pending pair requests (server)",
        {
          count: transformedRequests.length,
        }
      );

      return transformedRequests;
    } catch (error) {
      await logger.error(
        LogComponent.WOLF_UI,
        "Failed to fetch pending pair requests (server)",
        { error }
      );
      throw error;
    }
  },

  // Get paired clients (server-side)
  getClients: async (): Promise<PairedClient[]> => {
    try {
      // Use internal fetch to proxy endpoint for server-side calls
      // For server-side calls within container, always use internal port 3000
      // NEXTAUTH_URL is for external access, but we need internal container communication
      const baseUrl = 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/wolf/clients`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: 'no-store', // Don't cache server-side requests
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as WolfClientsResponse;

      if (!data || !data.success) {
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

      await logger.debug(LogComponent.WOLF_UI, "Successfully fetched clients (server)", {
        count: clients.length,
        clients,
      });

      return clients;
    } catch (error) {
      await logger.error(LogComponent.WOLF_UI, "Failed to fetch clients (server)", {
        error,
      });
      throw error;
    }
  },
};