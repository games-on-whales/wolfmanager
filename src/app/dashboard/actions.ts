"use server";

import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";

export async function refreshDashboardData() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await logger.info(
      LogComponent.WOLF_UI,
      "Dashboard data refresh requested",
      {
        userId: session.user.id,
      }
    );

    // Add your dashboard data refresh logic here
    // For example, fetching updated stats, user data, etc.

    return { success: true };
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Failed to refresh dashboard data",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to refresh dashboard data",
    };
  }
}
