import type { ClientDevice } from "@/types/client";

// Extended client type for Wolf API responses
export type WolfClientWithMetadata = ClientDevice & {
  device_type?: string;
  last_seen?: string;
  status?: string;
  owner?: string;
};

// Types for Wolf API responses
export interface WolfPairResponse {
  success: boolean;
  error?: string;
  client_id?: string;
}

export interface WolfClientResponse {
  id: string;
  client_id?: string;
  hostname?: string;
  ip?: string;
  mac?: string;
  status?: string;
  last_seen?: string;
  [key: string]: unknown;
}

export interface WolfClientsListResponse {
  success: boolean;
  clients: WolfClientResponse[];
}

export interface PendingPairRequest {
  id: string;
  pin: string;
  pair_secret: string;
  timestamp: string;
  expires_at: string;
}

export interface WolfPendingRequestsResponse {
  success: boolean;
  requests: PendingPairRequest[];
}