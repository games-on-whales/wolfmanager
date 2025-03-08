import { loadConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import * as TOML from "@iarna/toml";
import fs from "fs";
import path from "path";
import { SteamUserCredentials } from "./types";

interface UserConfig {
  steamId: string;
  steamApiKey: string;
  // ... other user config fields
}

interface DefaultConfig {
  users: Record<string, UserConfig>;
}

const CONFIG_PATH = path.join(process.cwd(), "config", "default.toml");

function getDefaultConfig(): DefaultConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      logger.error(LogComponent.SYSTEM, "Default config not found", undefined, {
        path: CONFIG_PATH,
      });
      return { users: {} };
    }

    const configFile = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = TOML.parse(configFile) as unknown as DefaultConfig;

    // Validate the parsed config has the expected structure
    if (!parsed.users || typeof parsed.users !== "object") {
      logger.error(LogComponent.SYSTEM, "Invalid config structure", undefined, {
        hasUsers: !!parsed.users,
        usersType: typeof parsed.users,
      });
      return { users: {} };
    }

    return parsed;
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to load default config", error);
    return { users: {} };
  }
}

export function getUserSteamCredentials(
  username: string
): SteamUserCredentials | null {
  try {
    // Load config with decryption enabled
    const config = loadConfig(true);
    const user = config.users[username];

    if (!user?.steam_id || !user?.steam_api_key) {
      logger.warn(
        LogComponent.SYSTEM,
        "Steam credentials not found for user",
        undefined,
        {
          username,
          hasConfig: !!user,
          hasSteamId: !!user?.steam_id,
          hasSteamApiKey: !!user?.steam_api_key,
        }
      );
      return null;
    }

    logger.debug(
      LogComponent.SYSTEM,
      "Found Steam credentials for user",
      undefined,
      {
        username,
        steamId: user.steam_id,
      }
    );

    return {
      steamId: user.steam_id,
      steamApiKey: user.steam_api_key,
    };
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load Steam credentials",
      error
    );
    return null;
  }
}

export function updateUserSteamCredentials(
  userId: string,
  credentials: SteamUserCredentials
): void {
  const config = getDefaultConfig();

  config.users[userId] = {
    steamId: credentials.steamId,
    steamApiKey: credentials.steamApiKey,
  };

  try {
    fs.writeFileSync(
      CONFIG_PATH,
      TOML.stringify(config as unknown as TOML.JsonMap)
    );
    logger.info(
      LogComponent.SYSTEM,
      "Updated Steam credentials for user",
      undefined,
      {
        userId,
        steamId: credentials.steamId,
      }
    );
  } catch (error) {
    logger.error(LogComponent.SYSTEM, "Failed to save default config", error);
    throw new Error("Failed to save Steam configuration");
  }
}

export function initializeSteamConfig(
  userId: string,
  steamId: string,
  steamApiKey: string
): void {
  const credentials: SteamUserCredentials = {
    steamId,
    steamApiKey,
  };
  updateUserSteamCredentials(userId, credentials);
}
