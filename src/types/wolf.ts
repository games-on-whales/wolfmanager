export interface PairedClient {
  app_state_folder: string;
  client_id: string;
  settings?: ClientSettings;
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

export interface ClientSettings {
  controllers_override: Array<'auto' | 'xbox' | 'nintendo' | 'ps'>;
  mouse_acceleration: number;
  h_scroll_acceleration: number;
  v_scroll_acceleration: number;
}

export interface UpdateClientSettingsRequest {
  client_id: string;
  settings: ClientSettings;
}

export interface UpdateClientSettingsResponse {
  success: boolean;
  error?: string;
}
