"use server";

import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { LogComponent } from "@/lib/logger/types";
import {
  getMetadataProviderByName,
  addMetadataProvider,
  updateMetadataProvider
} from "@/lib/db/helpers/system";
import { METADATA_PROVIDER_NAMES } from "@/lib/db/schema/system";
import { encrypt } from "@/lib/crypto";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

// Define the schema for input validation using Zod
const SettingsSchema = z
  .object({
    enabled: z.boolean(),
    apiKey: z.string().optional(), // Optional, but must be non-empty if provided
  })
  .refine((data) => !data.apiKey || data.apiKey.length > 0, {
    message: "'apiKey' cannot be empty if provided",
    path: ["apiKey"], // Specify the path of the error
  });

export type SettingsFormState = {
  message: string;
  success: boolean;
  errors?: {
    enabled?: string[];
    apiKey?: string[];
    _form?: string[]; // General form errors
  };
  updatedStatus?: {
    // Include updated status to refresh UI if needed
    enabled: boolean;
    isApiKeySet: boolean;
  };
};

export async function updateSteamGridDbSettings(
  prevState: SettingsFormState, // Required for useFormState
  formData: FormData
): Promise<SettingsFormState> {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "admin") {
    logger.warn(
      LogComponent.SYSTEM, // Use SYSTEM instead of ACTIONS
      "Unauthorized attempt to update SteamGridDB settings",
      null,
      { userId: session?.user?.id ?? "anonymous" }
    );
    // Don't reveal specific error messages for auth failures
    return { success: false, message: "Authentication failed." };
  }

  const rawData = {
    enabled: formData.get("enabled") === "on", // Checkbox value is 'on' or null
    apiKey: formData.get("apiKey") as string | null,
  };

  // Filter out null/empty apiKey before validation
  const dataToValidate: { enabled: boolean; apiKey?: string } = {
    enabled: rawData.enabled,
  };
  if (rawData.apiKey) {
    dataToValidate.apiKey = rawData.apiKey;
  }

  const validatedFields = SettingsSchema.safeParse(dataToValidate);

  // Handle validation errors
  if (!validatedFields.success) {
    logger.warn(
      LogComponent.SYSTEM, // Use SYSTEM instead of ACTIONS
      "Invalid SteamGridDB settings input",
      null,
      {
        userId: session.user.id,
        errors: validatedFields.error.flatten().fieldErrors,
      }
    );
    return {
      success: false,
      message: "Validation failed. Please check the fields.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { enabled, apiKey } = validatedFields.data;

  try {
    logger.debug(
      LogComponent.SYSTEM,
      "Admin user updating SteamGridDB settings via Server Action",
      { userId: session.user.id, data: { enabled, apiKeyProvided: !!apiKey } }
    );

    // Get existing SteamGridDB provider from database
    const existingProvider = await getMetadataProviderByName(METADATA_PROVIDER_NAMES.STEAMGRID_DB);

    let provider;
    if (existingProvider) {
      // Update existing provider
      const updates: any = { enabled };
      
      if (apiKey !== undefined) {
        // Encrypt the API key before storing
        updates.apiKey = apiKey ? encrypt(apiKey) : null;
        logger.info(
          LogComponent.SYSTEM,
          "SteamGridDB API key will be updated (value not logged)",
          { userId: session.user.id }
        );
      }

      provider = await updateMetadataProvider(existingProvider.id, updates);
    } else {
      // Create new provider
      const encryptedApiKey = apiKey ? encrypt(apiKey) : null;
      provider = await addMetadataProvider({
        name: METADATA_PROVIDER_NAMES.STEAMGRID_DB,
        enabled,
        apiKey: encryptedApiKey,
        config: JSON.stringify({}), // Default empty config
      });
    }

    logger.info(
      LogComponent.SYSTEM,
      "Successfully updated SteamGridDB settings via Server Action",
      {
        userId: session.user.id,
        enabled,
        apiKeyProvided: apiKey !== undefined,
      }
    );

    // Return success state and the updated key status
    const isApiKeySet = !!provider.apiKey && provider.apiKey.length > 0;

    return {
      success: true,
      message: "SteamGridDB settings saved successfully.",
      updatedStatus: { enabled, isApiKeySet },
    };
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM, // Use SYSTEM instead of ACTIONS
      "Error updating SteamGridDB settings via Server Action",
      error instanceof Error ? error : new Error(String(error)),
      { userId: session.user.id }
    );
    return {
      success: false,
      message: "Internal Server Error: Could not save settings.",
      errors: { _form: ["An unexpected error occurred."] },
    };
  }
}
