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
