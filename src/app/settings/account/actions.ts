"use server";

import { authOptions } from "@/lib/auth";
import {
  changeUserPassword,
  loadConfig,
  updateUserSteamInfo,
} from "@/lib/config";
import { LogComponent, logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

interface UpdateSteamSettingsData {
  steamId: string;
  steamApiKey: string;
}

export async function updateSteamSettings(data: UpdateSteamSettingsData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      throw new Error("Unauthorized");
    }

    await logger.debug(LogComponent.STEAM, "Updating Steam settings", {
      userId: session.user.name,
      steamId: data.steamId,
      hasApiKey: !!data.steamApiKey,
    });

    // Update the user's Steam information
    updateUserSteamInfo(session.user.name, data.steamId, data.steamApiKey);

    await logger.info(
      LogComponent.STEAM,
      "Steam settings updated successfully",
      {
        userId: session.user.name,
      }
    );

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    await logger.error(
      LogComponent.STEAM,
      "Failed to update Steam settings",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update Steam settings",
    };
  }
}

interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

export async function updateUserPassword(data: UpdatePasswordData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      throw new Error("Unauthorized");
    }

    await logger.debug(LogComponent.AUTH, "Updating user password", {
      userId: session.user.name,
    });

    // Load config and validate current password
    const config = loadConfig();
    const user = config.users[session.user.name];

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValidPassword = bcrypt.compareSync(
      data.currentPassword,
      user.password_hash
    );
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    // Update password
    changeUserPassword(session.user.name, data.newPassword);

    await logger.info(LogComponent.AUTH, "Password updated successfully", {
      userId: session.user.name,
    });

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    await logger.error(
      LogComponent.AUTH,
      "Failed to update password",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update password",
    };
  }
}

// --- Add new action to test Steam credentials ---
interface TestSteamCredentialsData {
  steamId: string;
  steamApiKey: string;
}

export async function testSteamCredentials(data: TestSteamCredentialsData) {
  let sessionUsername: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      throw new Error("Unauthorized");
    }
    sessionUsername = session.user.name;

    await logger.debug(LogComponent.STEAM, "Testing Steam credentials", {
      userId: sessionUsername,
      steamId: data.steamId,
      hasApiKey: !!data.steamApiKey,
    });

    // --- Use external Steam API for validation ---
    const steamApiKey = data.steamApiKey;
    const steamId = data.steamId;
    const validationUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`;

    const response = await fetch(validationUrl);

    let isValid = false;
    if (response.ok) {
      // status 200-299
      // Check if response body confirms the user exists (optional but good practice)
      const result = await response.json();
      if (
        result?.response?.players?.length > 0 &&
        result.response.players[0].steamid === steamId
      ) {
        isValid = true;
        await logger.debug(
          LogComponent.STEAM,
          "Steam API validation successful via GetPlayerSummaries",
          { userId: sessionUsername }
        );
      } else {
        // Status OK but unexpected body? Could be private profile + limited key, or invalid ID format?
        // Treat as potentially valid based on OK status, but log a warning.
        isValid = true; // Assume OK status means key is generally valid
        await logger.warn(
          LogComponent.STEAM,
          "Steam API validation returned OK but unexpected body",
          { userId: sessionUsername, steamId: steamId, responseBody: result }
        );
      }
    } else if (response.status === 401 || response.status === 403) {
      isValid = false;
      await logger.warn(
        LogComponent.STEAM,
        "Steam API validation failed (401/403 Unauthorized/Forbidden)",
        { userId: sessionUsername, steamId: steamId, status: response.status }
      );
    } else {
      // Other error (e.g., 5xx from Steam)
      const errorText = await response.text();
      throw new Error(
        `Steam API validation request failed with status ${response.status}: ${errorText}`
      );
    }
    // --- End of external API validation ---

    await logger.info(LogComponent.STEAM, "Steam credential test completed", {
      userId: sessionUsername,
      isValid: isValid,
    });

    return { success: true, isValid: isValid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await logger.error(
      LogComponent.STEAM,
      `Failed to test Steam credentials: ${errorMessage}`,
      { stack: errorStack },
      { userId: sessionUsername }
    );
    return {
      success: false,
      isValid: false,
      error:
        error instanceof Error ? error.message : "Failed to test credentials",
    };
  }
}
// --- End of new action ---
