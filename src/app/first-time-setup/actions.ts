"use server";

import { authOptions } from "@/lib/auth";
import { changeUserPassword } from "@/lib/config";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export async function updatePassword(newPassword: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      throw new Error("Unauthorized");
    }

    // Update password directly using the config utility
    await changeUserPassword(session.user.name, newPassword);

    // Force a redirect to refresh the session and update requiresFirstTimeSetup
    // This ensures the middleware will no longer redirect to first-time setup
    return { success: true, requiresRefresh: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update password",
    };
  }
}
