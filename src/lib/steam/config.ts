import * as TOML from "@iarna/toml";
import fs from "fs";
import path from "path";
import { SteamUserCredentials } from "./types";

interface SteamConfig {
  users: Record<
    string,
    {
      steam_id: string;
      steam_api_key: string;
    }
  >;
}

const STEAM_CONFIG_PATH = path.join(process.cwd(), "config", "steam.toml");

export function getSteamConfig(): SteamConfig {
  try {
    if (!fs.existsSync(STEAM_CONFIG_PATH)) {
      // Create default config if it doesn't exist
      const defaultConfig = { users: {} };
      fs.writeFileSync(
        STEAM_CONFIG_PATH,
        TOML.stringify(defaultConfig as TOML.JsonMap)
      );
      return defaultConfig as SteamConfig;
    }

    const configFile = fs.readFileSync(STEAM_CONFIG_PATH, "utf-8");
    const parsed = TOML.parse(configFile);
    return parsed as unknown as SteamConfig;
  } catch (error) {
    console.error("[STEAM_CONFIG] Failed to load config:", error);
    return { users: {} };
  }
}

export function getUserSteamCredentials(
  userId: string
): SteamUserCredentials | null {
  const config = getSteamConfig();
  const userConfig = config.users[userId];

  if (!userConfig?.steam_id || !userConfig?.steam_api_key) {
    return null;
  }

  return {
    steamId: userConfig.steam_id,
    steamApiKey: userConfig.steam_api_key,
  };
}

export function updateUserSteamCredentials(
  userId: string,
  credentials: SteamUserCredentials
): void {
  const config = getSteamConfig();

  config.users[userId] = {
    steam_id: credentials.steamId,
    steam_api_key: credentials.steamApiKey,
  };

  try {
    fs.writeFileSync(
      STEAM_CONFIG_PATH,
      TOML.stringify(config as unknown as TOML.JsonMap)
    );
  } catch (error) {
    console.error("[STEAM_CONFIG] Failed to save config:", error);
    throw new Error("Failed to save Steam configuration");
  }
}
