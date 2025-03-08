import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { STEAM_CACHE_CONFIG } from "./constants";
import { SteamGame, SteamGridImage } from "./types";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SteamCache {
  private static instance: SteamCache;
  private gamesCache: Map<string, CacheEntry<SteamGame[]>>;
  private artworkCache: Map<number, CacheEntry<SteamGridImage[]>>;

  private constructor() {
    this.gamesCache = new Map();
    this.artworkCache = new Map();
  }

  public static getInstance(): SteamCache {
    if (!SteamCache.instance) {
      SteamCache.instance = new SteamCache();
    }
    return SteamCache.instance;
  }

  public getCachedGames(userId: string): SteamGame[] | null {
    const entry = this.gamesCache.get(userId);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > STEAM_CACHE_CONFIG.GAMES_CACHE_TTL) {
      logger.debug(LogComponent.SYSTEM, "Games cache expired", undefined, {
        userId,
        age: now - entry.timestamp,
        ttl: STEAM_CACHE_CONFIG.GAMES_CACHE_TTL,
      });
      this.gamesCache.delete(userId);
      return null;
    }

    logger.debug(LogComponent.SYSTEM, "Using cached games", undefined, {
      userId,
      gameCount: entry.data.length,
      age: now - entry.timestamp,
    });

    return entry.data;
  }

  public cacheGames(userId: string, games: SteamGame[]): void {
    this.gamesCache.set(userId, {
      data: games,
      timestamp: Date.now(),
    });

    logger.debug(LogComponent.SYSTEM, "Cached games", undefined, {
      userId,
      gameCount: games.length,
    });
  }

  public getCachedArtwork(appId: number): SteamGridImage[] | null {
    const entry = this.artworkCache.get(appId);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > STEAM_CACHE_CONFIG.ARTWORK_CACHE_TTL) {
      logger.debug(LogComponent.SYSTEM, "Artwork cache expired", undefined, {
        appId,
        age: now - entry.timestamp,
        ttl: STEAM_CACHE_CONFIG.ARTWORK_CACHE_TTL,
      });
      this.artworkCache.delete(appId);
      return null;
    }

    logger.debug(LogComponent.SYSTEM, "Using cached artwork", undefined, {
      appId,
      artworkCount: entry.data.length,
      age: now - entry.timestamp,
    });

    return entry.data;
  }

  public cacheArtwork(appId: number, artwork: SteamGridImage[]): void {
    this.artworkCache.set(appId, {
      data: artwork,
      timestamp: Date.now(),
    });

    logger.debug(LogComponent.SYSTEM, "Cached artwork", undefined, {
      appId,
      artworkCount: artwork.length,
    });
  }

  public clearCache(): void {
    this.gamesCache.clear();
    this.artworkCache.clear();
    logger.info(LogComponent.SYSTEM, "Cache cleared");
  }
}

export const steamCache = SteamCache.getInstance();
