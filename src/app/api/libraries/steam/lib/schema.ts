import {
  getArtworkResponseSchema,
  getOwnedGamesResponseSchema,
  refreshArtworkResponseSchema,
} from "@/lib/steam/schemas";
import { z } from "zod";

export const steamEndpoints = [
  {
    path: "/api/libraries/steam/games",
    method: "GET",
    summary: "Get Steam Games",
    description: "Retrieve the list of games owned by the authenticated user",
    responseSchema: getOwnedGamesResponseSchema,
  },
  {
    path: "/api/libraries/steam/games/artwork/refresh",
    method: "POST",
    summary: "Refresh Game Artwork",
    description: "Refresh artwork for all games in the user's library",
    responseSchema: refreshArtworkResponseSchema,
  },
  {
    path: "/api/libraries/steam/games/{appId}/artwork",
    method: "GET",
    summary: "Get Game Artwork",
    description: "Get artwork for a specific game by its Steam App ID",
    requestSchema: z.object({
      appId: z.string().regex(/^\d+$/, "App ID must be a number"),
    }),
    responseSchema: getArtworkResponseSchema,
  },
] as const;

export async function getAvailableSteamEndpoints() {
  return steamEndpoints.map((endpoint) => ({
    ...endpoint,
    components: {
      schemas: {
        GetOwnedGamesResponse: getOwnedGamesResponseSchema,
        GetArtworkResponse: getArtworkResponseSchema,
        RefreshArtworkResponse: refreshArtworkResponseSchema,
      },
    },
  }));
}
