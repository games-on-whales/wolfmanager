"use server";

import { loadConfig } from "@/lib/config";
import {
  getPlatformLibrary,
  savePlatformLibrary,
  updateMasterGame,
} from "@/lib/library-service";

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  playtime_linux_forever: number;
  rtime_last_played: number;
}

interface SteamLibraryResponse {
  response: {
    game_count: number;
    games: SteamGame[];
  };
}

async function fetchSteamLibrary(
  steamId: string,
  apiKey: string
): Promise<SteamGame[]> {
  const url = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Steam API error: ${response.statusText}`);
    }

    const data: SteamLibraryResponse = await response.json();
    return data.response.games || [];
  } catch (error) {
    console.error("Failed to fetch Steam library:", error);
    throw error;
  }
}

export async function syncSteamLibrary() {
  try {
    // Load users config to get Steam credentials - with decryption enabled
    const users = loadConfig(true);

    // Load current Steam library state
    let steamLibrary = getPlatformLibrary("steam");

    // Update metadata
    steamLibrary.metadata.last_sync = new Date().toISOString();

    // Process each user with Steam credentials
    for (const [userId, user] of Object.entries(users.users)) {
      if (user.steam_id && user.steam_api_key) {
        // Fetch Steam library
        const games = await fetchSteamLibrary(
          user.steam_id,
          user.steam_api_key
        );

        // Update master games list and user library
        const userGames = [];

        for (const game of games) {
          // Update master games list
          updateMasterGame(steamLibrary, game.appid.toString(), {
            name: game.name,
            icon_url: game.img_icon_url,
          });

          // Add to user's games list
          userGames.push({
            platform_id: game.appid.toString(),
            playtime_total: game.playtime_forever,
            playtime_linux: game.playtime_linux_forever,
            last_played: game.rtime_last_played,
          });
        }

        // Update user library
        steamLibrary.user_libraries[userId] = {
          steam_id: user.steam_id,
          games: userGames,
        };
      }
    }

    // Save updated library config
    savePlatformLibrary("steam", steamLibrary);

    return { success: true };
  } catch (error: unknown) {
    console.error("Steam library sync failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: errorMessage };
  }
}
