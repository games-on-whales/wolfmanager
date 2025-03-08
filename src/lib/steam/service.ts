import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { steamCache } from "./cache";
import {
  STEAM_API_BASE_URL,
  STEAM_API_ENDPOINTS,
  STEAM_ARTWORK_CONFIG,
  STEAM_ERROR_CODES,
  STEAM_GRID_API_BASE_URL,
  STEAM_GRID_ENDPOINTS,
} from "./constants";
import type { PreferredStyle } from "./schemas";
import type {
  GetOwnedGamesResponse,
  SteamApiError as ISteamApiError,
  SteamGame,
  SteamGridImage,
  SteamUserCredentials,
} from "./types";

export class SteamApiError extends Error implements ISteamApiError {
  constructor(message: string, public code: string, public status?: number) {
    super(message);
    this.name = "SteamApiError";
  }
}

export async function getOwnedGames(
  credentials: SteamUserCredentials
): Promise<GetOwnedGamesResponse> {
  const { steamId, steamApiKey } = credentials;

  try {
    // Check cache first
    const cachedGames = steamCache.getCachedGames(steamId);
    if (cachedGames) {
      return {
        game_count: cachedGames.length,
        games: cachedGames,
      };
    }

    logger.debug(LogComponent.SYSTEM, "Fetching owned games", undefined, {
      steamId,
      endpoint: STEAM_API_ENDPOINTS.GET_OWNED_GAMES,
    });

    const url = new URL(
      STEAM_API_ENDPOINTS.GET_OWNED_GAMES,
      STEAM_API_BASE_URL
    );
    url.searchParams.append("key", steamApiKey);
    url.searchParams.append("steamid", steamId);
    url.searchParams.append("include_appinfo", "true");
    url.searchParams.append("format", "json");

    const startTime = Date.now();
    const response = await fetch(url.toString());
    const responseTime = Date.now() - startTime;

    logger.debug(
      LogComponent.SYSTEM,
      "Steam API response received",
      undefined,
      {
        statusCode: response.status,
        responseTime,
        steamId,
      }
    );

    if (!response.ok) {
      throw new SteamApiError(
        `Steam API request failed: ${response.statusText}`,
        STEAM_ERROR_CODES.API_ERROR,
        response.status
      );
    }

    const data = await response.json();

    if (!data.response?.games) {
      throw new SteamApiError(
        "Invalid response from Steam API",
        STEAM_ERROR_CODES.API_ERROR
      );
    }

    const games = data.response.games as SteamGame[];

    // Cache the games
    steamCache.cacheGames(steamId, games);

    logger.info(
      LogComponent.SYSTEM,
      "Successfully fetched owned games",
      undefined,
      {
        steamId,
        gameCount: games.length,
        responseTime,
      }
    );

    return {
      game_count: games.length,
      games,
    };
  } catch (error) {
    if (error instanceof SteamApiError) {
      logger.error(LogComponent.SYSTEM, "Steam API error", error, {
        steamId,
        code: error.code,
        status: error.status,
      });
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      logger.error(LogComponent.SYSTEM, "Network error fetching games", error, {
        steamId,
      });
      throw new SteamApiError(
        "Failed to connect to Steam API",
        STEAM_ERROR_CODES.NETWORK_ERROR
      );
    }

    // Handle other errors
    logger.error(
      LogComponent.SYSTEM,
      "Unexpected error fetching games",
      error,
      {
        steamId,
      }
    );
    throw new SteamApiError(
      "An unexpected error occurred",
      STEAM_ERROR_CODES.API_ERROR
    );
  }
}

export async function validateSteamCredentials(
  credentials: SteamUserCredentials
): Promise<boolean> {
  try {
    await getOwnedGames(credentials);
    return true;
  } catch (error) {
    if (error instanceof SteamApiError) {
      if (error.status === 403) {
        throw new SteamApiError(
          "Invalid Steam API key",
          STEAM_ERROR_CODES.INVALID_API_KEY,
          403
        );
      }
      if (error.status === 500) {
        throw new SteamApiError(
          "Invalid Steam ID",
          STEAM_ERROR_CODES.INVALID_STEAM_ID,
          500
        );
      }
    }
    throw error;
  }
}

export async function getGameArtwork(appId: number): Promise<SteamGridImage[]> {
  try {
    // Check cache first
    const cachedArtwork = steamCache.getCachedArtwork(appId);
    if (cachedArtwork) {
      return cachedArtwork;
    }

    logger.debug(LogComponent.SYSTEM, "Fetching game artwork", undefined, {
      appId,
      endpoint: STEAM_GRID_ENDPOINTS.GET_GRID,
    });

    const url = new URL(
      `${STEAM_GRID_ENDPOINTS.GET_GRID}/${appId}`,
      STEAM_GRID_API_BASE_URL
    );

    const startTime = Date.now();
    const response = await fetch(url.toString());
    const responseTime = Date.now() - startTime;

    logger.debug(
      LogComponent.SYSTEM,
      "SteamGridDB API response received",
      undefined,
      {
        statusCode: response.status,
        responseTime,
        appId,
      }
    );

    if (!response.ok) {
      throw new SteamApiError(
        `SteamGridDB API request failed: ${response.statusText}`,
        STEAM_ERROR_CODES.API_ERROR,
        response.status
      );
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.data)) {
      throw new SteamApiError(
        "Invalid response from SteamGridDB API",
        STEAM_ERROR_CODES.API_ERROR
      );
    }

    // Filter and sort artwork based on preferences
    const filteredArtwork = data.data
      .filter((grid: SteamGridImage) => {
        // Filter out NSFW content
        if (grid.nsfw) {
          logger.debug(
            LogComponent.SYSTEM,
            "Filtered out NSFW artwork",
            undefined,
            {
              appId,
              artworkId: grid.id,
            }
          );
          return false;
        }

        // Check for preferred dimensions
        const hasPreferredDimensions =
          grid.width === STEAM_ARTWORK_CONFIG.PREFERRED_DIMENSIONS.width &&
          grid.height === STEAM_ARTWORK_CONFIG.PREFERRED_DIMENSIONS.height;

        // Check for preferred styles
        const hasPreferredStyle =
          STEAM_ARTWORK_CONFIG.PREFERRED_STYLES.includes(
            grid.style as PreferredStyle
          );

        return hasPreferredDimensions || hasPreferredStyle;
      })
      .sort((a: SteamGridImage, b: SteamGridImage) => {
        // Sort by preferred dimensions first
        const aHasPreferredDims =
          a.width === STEAM_ARTWORK_CONFIG.PREFERRED_DIMENSIONS.width &&
          a.height === STEAM_ARTWORK_CONFIG.PREFERRED_DIMENSIONS.height;
        const bHasPreferredDims =
          b.width === STEAM_ARTWORK_CONFIG.PREFERRED_DIMENSIONS.width &&
          b.height === STEAM_ARTWORK_CONFIG.PREFERRED_DIMENSIONS.height;

        if (aHasPreferredDims && !bHasPreferredDims) return -1;
        if (!aHasPreferredDims && bHasPreferredDims) return 1;

        // Then sort by preferred styles
        const aStyleIndex = STEAM_ARTWORK_CONFIG.PREFERRED_STYLES.indexOf(
          a.style as PreferredStyle
        );
        const bStyleIndex = STEAM_ARTWORK_CONFIG.PREFERRED_STYLES.indexOf(
          b.style as PreferredStyle
        );

        if (aStyleIndex !== -1 && bStyleIndex === -1) return -1;
        if (aStyleIndex === -1 && bStyleIndex !== -1) return 1;
        if (aStyleIndex !== -1 && bStyleIndex !== -1)
          return aStyleIndex - bStyleIndex;

        // Finally sort by score
        return b.score - a.score;
      });

    // Cache the filtered artwork
    steamCache.cacheArtwork(appId, filteredArtwork);

    logger.info(
      LogComponent.SYSTEM,
      "Successfully fetched artwork",
      undefined,
      {
        appId,
        totalArtwork: data.data.length,
        filteredCount: filteredArtwork.length,
        responseTime,
      }
    );

    return filteredArtwork;
  } catch (error) {
    if (error instanceof SteamApiError) {
      logger.error(LogComponent.SYSTEM, "Steam Grid API error", error, {
        appId,
        code: error.code,
        status: error.status,
      });
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      logger.error(
        LogComponent.SYSTEM,
        "Network error fetching artwork",
        error,
        { appId }
      );
      throw new SteamApiError(
        "Failed to connect to SteamGridDB API",
        STEAM_ERROR_CODES.NETWORK_ERROR
      );
    }

    // Handle other errors
    logger.error(
      LogComponent.SYSTEM,
      "Unexpected error fetching artwork",
      error,
      {
        appId,
      }
    );
    throw new SteamApiError(
      "An unexpected error occurred",
      STEAM_ERROR_CODES.API_ERROR
    );
  }
}

export async function refreshGameArtwork(
  games: SteamGame[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  const total = games.length;
  let processed = 0;
  let errors = 0;

  logger.info(LogComponent.SYSTEM, "Starting artwork refresh", undefined, {
    totalGames: total,
    batchSize: STEAM_ARTWORK_CONFIG.MAX_BATCH_SIZE,
    requestDelay: STEAM_ARTWORK_CONFIG.REQUEST_DELAY,
  });

  // Process games in batches to avoid rate limiting
  for (let i = 0; i < games.length; i += STEAM_ARTWORK_CONFIG.MAX_BATCH_SIZE) {
    const batch = games.slice(i, i + STEAM_ARTWORK_CONFIG.MAX_BATCH_SIZE);
    const batchNumber = Math.floor(i / STEAM_ARTWORK_CONFIG.MAX_BATCH_SIZE) + 1;

    logger.debug(LogComponent.SYSTEM, "Processing artwork batch", undefined, {
      batchNumber,
      batchSize: batch.length,
      totalProcessed: processed,
    });

    await Promise.all(
      batch.map(async (game) => {
        try {
          await getGameArtwork(game.appid);
          processed++;
          onProgress?.(processed, total);
        } catch (error) {
          errors++;
          logger.error(
            LogComponent.SYSTEM,
            `Failed to refresh artwork for game ${game.name}`,
            error,
            {
              appId: game.appid,
              batchNumber,
              totalProcessed: processed,
              totalErrors: errors,
            }
          );
        }
      })
    );

    // Add delay between batches to avoid rate limiting
    if (i + STEAM_ARTWORK_CONFIG.MAX_BATCH_SIZE < games.length) {
      logger.debug(
        LogComponent.SYSTEM,
        "Applying rate limit delay between batches",
        undefined,
        {
          batchNumber,
          delayMs: STEAM_ARTWORK_CONFIG.REQUEST_DELAY,
        }
      );
      await new Promise((resolve) =>
        setTimeout(resolve, STEAM_ARTWORK_CONFIG.REQUEST_DELAY)
      );
    }
  }

  logger.info(LogComponent.SYSTEM, "Completed artwork refresh", undefined, {
    totalGames: total,
    processed,
    errors,
    successRate: `${(((processed - errors) / total) * 100).toFixed(2)}%`,
  });
}
