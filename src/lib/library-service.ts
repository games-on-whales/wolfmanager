import * as TOML from "@iarna/toml";
import fs from "fs";
import path from "path";

const LIBRARIES_DIR = path.join(process.cwd(), "config", "libraries");

export interface PlatformMetadata {
  platform: string;
  last_sync: string;
  version: string;
}

export interface GameMaster {
  name: string;
  icon_url: string;
  last_updated: string;
  platform_id: string;
}

export interface UserGameEntry {
  platform_id: string;
  playtime_total: number;
  playtime_linux: number;
  last_played: number;
}

export interface UserLibrary {
  steam_id: string; // Platform-specific ID
  games: UserGameEntry[];
}

export interface LibraryConfig {
  metadata: PlatformMetadata;
  games: Record<string, GameMaster>;
  user_libraries: Record<string, UserLibrary>;
}

/**
 * Ensures the libraries directory exists
 */
function ensureLibrariesDir() {
  if (!fs.existsSync(LIBRARIES_DIR)) {
    fs.mkdirSync(LIBRARIES_DIR, { recursive: true });
  }
}

/**
 * Gets the library configuration for a specific platform
 */
export function getPlatformLibrary(platform: string): LibraryConfig {
  ensureLibrariesDir();
  const libraryPath = path.join(LIBRARIES_DIR, `${platform}.toml`);

  if (!fs.existsSync(libraryPath)) {
    // Return default empty configuration if file doesn't exist
    return {
      metadata: {
        platform,
        last_sync: new Date().toISOString(),
        version: "1.0.0",
      },
      games: {},
      user_libraries: {},
    };
  }

  const fileContent = fs.readFileSync(libraryPath, "utf-8");
  const parsed = TOML.parse(fileContent);
  return parsed as unknown as LibraryConfig;
}

/**
 * Saves the library configuration for a specific platform
 */
export function savePlatformLibrary(
  platform: string,
  config: LibraryConfig
): void {
  ensureLibrariesDir();
  const libraryPath = path.join(LIBRARIES_DIR, `${platform}.toml`);
  const tomlStr = TOML.stringify(config as unknown as TOML.JsonMap);
  fs.writeFileSync(libraryPath, tomlStr, "utf-8");
}

/**
 * Updates a game in the master games list if it doesn't exist or is outdated
 */
export function updateMasterGame(
  config: LibraryConfig,
  platformId: string,
  game: { name: string; icon_url: string }
) {
  config.games[platformId] = {
    ...game,
    platform_id: platformId,
    last_updated: new Date().toISOString(),
  };
}
