import type {
  SteamGame,
  SteamGridImage,
  GetOwnedGamesResponse as ZodGetOwnedGamesResponse,
  RefreshArtworkResponse as ZodRefreshArtworkResponse,
} from "./schemas";

export type { SteamGame, SteamGridImage };

export interface SteamUserCredentials {
  steamId: string;
  steamApiKey: string;
}

export interface SteamApiError {
  message: string;
  code: string;
  status?: number;
}

export interface SteamApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    code: string;
  };
}

export type GetOwnedGamesResponse = ZodGetOwnedGamesResponse;
export type GetArtworkResponse = SteamApiResponse<SteamGridImage[]>;
export type RefreshArtworkResponse = ZodRefreshArtworkResponse;

// API Route Types
export interface GetGamesResponse
  extends SteamApiResponse<GetOwnedGamesResponse> {}
export interface GetArtworkByIdResponse extends GetArtworkResponse {}
export interface RefreshArtworkByIdResponse extends RefreshArtworkResponse {}
