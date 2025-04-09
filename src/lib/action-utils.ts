import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { checkAdminRole } from "./api-utils";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types";

// Use the imported singleton logger instance directly

export type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export const withRoleCheck = async <T>(
  action: () => Promise<T>,
  options: {
    requireAdmin?: boolean;
    actionName: string;
  }
): Promise<ActionResponse<T>> => {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      logger.warn(
        LogComponent.AUTH,
        `Unauthorized attempt to access ${options.actionName}`
      );
      return { success: false, error: "Unauthorized" };
    }

    if (options.requireAdmin && !checkAdminRole(session)) {
      logger.warn(
        LogComponent.AUTH,
        `Non-admin attempt to access ${options.actionName}`,
        {
          userId: session.user.id,
        }
      );
      return { success: false, error: "Admin access required" };
    }

    logger.debug(LogComponent.AUTH, `Executing action: ${options.actionName}`, {
      userId: session.user.id,
      requiresAdmin: options.requireAdmin,
    });

    const result = await action();

    logger.debug(LogComponent.AUTH, `Completed action: ${options.actionName}`, {
      userId: session.user.id,
      success: true,
    });

    return { success: true, data: result };
  } catch (error) {
    logger.error(
      LogComponent.AUTH,
      `Error in action: ${options.actionName}`,
      error instanceof Error ? error : new Error(String(error))
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
