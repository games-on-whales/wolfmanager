import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import { ZodError } from "zod";
import { STEAM_ERROR_CODES } from "./constants";
import {
  appIdSchema,
  paginationSchema,
  steamApiKeySchema,
  steamCredentialsSchema,
  steamIdSchema,
} from "./schemas";
import { SteamApiError } from "./service";
import type { SteamUserCredentials } from "./types";

export function validateSteamId(steamId: string): boolean {
  try {
    steamIdSchema.parse(steamId);
    return true;
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(LogComponent.SYSTEM, "Invalid Steam ID format", undefined, {
        steamId,
        errors: error.errors,
      });
    }
    return false;
  }
}

export function validateSteamApiKey(apiKey: string): boolean {
  try {
    steamApiKeySchema.parse(apiKey);
    return true;
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        LogComponent.SYSTEM,
        "Invalid Steam API key format",
        undefined,
        {
          errors: error.errors,
        }
      );
    }
    return false;
  }
}

export function validateAppId(appId: number | string): boolean {
  try {
    appIdSchema.parse(appId);
    return true;
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(LogComponent.SYSTEM, "Invalid app ID format", undefined, {
        appId,
        errors: error.errors,
      });
    }
    return false;
  }
}

export function validateSteamCredentials(
  credentials: SteamUserCredentials
): void {
  try {
    steamCredentialsSchema.parse(credentials);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      if (firstError.path.includes("steamId")) {
        throw new SteamApiError(
          firstError.message,
          STEAM_ERROR_CODES.INVALID_STEAM_ID
        );
      }
      if (firstError.path.includes("steamApiKey")) {
        throw new SteamApiError(
          firstError.message,
          STEAM_ERROR_CODES.INVALID_API_KEY
        );
      }
      throw new SteamApiError(
        "Invalid Steam credentials",
        STEAM_ERROR_CODES.INVALID_CREDENTIALS
      );
    }
    throw error;
  }
}

export function validatePaginationParams(
  page?: number,
  pageSize?: number
): { page: number; pageSize: number } {
  try {
    const result = paginationSchema.parse({ page, pageSize });

    // Log if values were adjusted
    if (result.page !== page || result.pageSize !== pageSize) {
      logger.debug(
        LogComponent.SYSTEM,
        "Pagination parameters adjusted",
        undefined,
        {
          originalPage: page,
          originalPageSize: pageSize,
          adjustedPage: result.page,
          adjustedPageSize: result.pageSize,
        }
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn(
        LogComponent.SYSTEM,
        "Invalid pagination parameters",
        undefined,
        {
          page,
          pageSize,
          errors: error.errors,
        }
      );
      // Return default values on validation failure
      return paginationSchema.parse({});
    }
    throw error;
  }
}
