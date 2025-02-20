export interface PairedClient {
  app_state_folder: string;
  client_id: string;
}

export interface PairRequest {
  pair_secret: string;
  pin: string;
}

export interface PairResponse {
  requests: PairRequest[];
  success: boolean;
}

export interface UnpairClientRequest {
  client_id: string;
}

export interface WolfApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
