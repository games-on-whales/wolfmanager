"use server";

import { authOptions } from "@/lib/auth";
import { changeUserPassword } from "@/lib/config";
import { getServerSession } from "next-auth";

export async function updatePassword(newPassword: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      throw new Error("Unauthorized");
    }

    // Update password directly using the config utility
    await changeUserPassword(session.user.name, newPassword);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update password",
    };
  }
}
