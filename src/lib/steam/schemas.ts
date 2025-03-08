import { z } from "zod";
import { STEAM_ARTWORK_CONFIG, STEAM_ERROR_CODES } from "./constants";

// Create a type-safe enum for artwork styles using the literal type from constants
export type PreferredStyle =
  (typeof STEAM_ARTWORK_CONFIG.PREFERRED_STYLES)[number];
export const artworkStyleEnum = z.enum(STEAM_ARTWORK_CONFIG.PREFERRED_STYLES);

// Create a type-safe enum for error codes
export type ErrorCode =
  (typeof STEAM_ERROR_CODES)[keyof typeof STEAM_ERROR_CODES];
export const errorCodeEnum = z.enum(
  Object.values(STEAM_ERROR_CODES) as [string, ...string[]]
);

// Base schemas
export const steamIdSchema = z.string().regex(/^\d{17}$/, {
  message: "Steam ID must be a 17-digit number",
});

export const steamApiKeySchema = z.string().regex(/^[A-F0-9]{32}$/i, {
  message: "Steam API key must be a 32-character hexadecimal string",
});

export const appIdSchema = z.union([
  z.number().positive(),
  z.string().regex(/^\d+$/).transform(Number),
]);

export const steamCredentialsSchema = z.object({
  steamId: steamIdSchema,
  steamApiKey: steamApiKeySchema,
});

export const paginationSchema = z.object({
  page: z.number().positive().default(1),
  pageSize: z.number().positive().max(100).default(50),
});

// Error schema
export const apiErrorSchema = z.object({
  message: z.string(),
  code: errorCodeEnum,
});

// Response schemas
export const steamGameSchema = z.object({
  appid: z.number(),
  name: z.string(),
  playtime_forever: z.number(),
  img_icon_url: z.string(),
  has_community_visible_stats: z.boolean().optional(),
  playtime_windows_forever: z.number().optional(),
  playtime_mac_forever: z.number().optional(),
  playtime_linux_forever: z.number().optional(),
  playtime_deck_forever: z.number().optional(),
  content_descriptorids: z.array(z.number()).optional(),
  playtime_disconnected: z.number().optional(),
});

export const steamGridImageSchema = z.object({
  id: z.string(),
  score: z.number(),
  style: artworkStyleEnum,
  width: z.number(),
  height: z.number(),
  nsfw: z.boolean(),
  humor: z.boolean().optional(),
  notes: z.string().nullable(),
  mime: z.string().optional(),
  language: z.string().optional(),
  url: z.string().url(),
  thumb: z.string().url().optional(),
  lock: z.boolean().optional(),
  epilepsy: z.boolean().optional(),
});

// API Response schemas
export const baseResponseSchema = z.object({
  success: z.boolean(),
  error: apiErrorSchema.optional(),
});

export const steamApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  baseResponseSchema.extend({
    data: dataSchema,
  });

export const getOwnedGamesResponseSchema = z.object({
  game_count: z.number(),
  games: z.array(steamGameSchema),
});

export const getArtworkResponseSchema = steamApiResponseSchema(
  z.array(steamGridImageSchema)
);

export const refreshArtworkResponseSchema = steamApiResponseSchema(
  z.object({
    processed: z.number(),
    total: z.number(),
  })
);

// Types
export type SteamId = z.infer<typeof steamIdSchema>;
export type SteamApiKey = z.infer<typeof steamApiKeySchema>;
export type AppId = z.infer<typeof appIdSchema>;
export type SteamCredentials = z.infer<typeof steamCredentialsSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type SteamGame = z.infer<typeof steamGameSchema>;
export type SteamGridImage = z.infer<typeof steamGridImageSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

// API Response Types
export type SteamApiResponse<T> = {
  success: boolean;
  data: T;
  error?: ApiError;
};
export type GetOwnedGamesResponse = z.infer<typeof getOwnedGamesResponseSchema>;
export type GetArtworkResponse = z.infer<typeof getArtworkResponseSchema>;
export type RefreshArtworkResponse = z.infer<
  typeof refreshArtworkResponseSchema
>;
