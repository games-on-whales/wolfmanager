export const STEAM_API_BASE_URL = "https://api.steampowered.com";
export const STEAM_GRID_API_BASE_URL = "https://www.steamgriddb.com/api/v2";

export const STEAM_API_ENDPOINTS = {
  GET_OWNED_GAMES: "/IPlayerService/GetOwnedGames/v1",
  GET_PLAYER_SUMMARIES: "/ISteamUser/GetPlayerSummaries/v2",
} as const;

export const STEAM_GRID_ENDPOINTS = {
  GET_GRID: "/grids/steam",
} as const;

export const STEAM_CACHE_CONFIG = {
  ARTWORK_CACHE_DIR: "/config/cache/artwork",
  GAMES_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
  ARTWORK_CACHE_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

export const STEAM_ERROR_CODES = {
  INVALID_API_KEY: "INVALID_API_KEY",
  INVALID_STEAM_ID: "INVALID_STEAM_ID",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  API_ERROR: "API_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export const STEAM_ARTWORK_CONFIG = {
  PREFERRED_STYLES: ["alternate", "blurred", "material", "white_logo"] as const,
  PREFERRED_DIMENSIONS: {
    width: 600,
    height: 900,
  },
  MAX_BATCH_SIZE: 50,
  REQUEST_DELAY: 100, // ms between requests to avoid rate limiting
} as const;
