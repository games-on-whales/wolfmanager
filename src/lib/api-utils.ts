import { Session } from "next-auth";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types";

// Use the imported singleton logger instance directly

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
};

export const createSuccessResponse = <T>(data: T): ApiResponse<T> => {
  logger.debug(LogComponent.API, "Creating success response", { data });
  return {
    success: true,
    data,
  };
};

export const createErrorResponse = (
  message: string,
  code: string,
  logError: boolean = true
): ApiResponse<never> => {
  if (logError) {
    logger.error(LogComponent.API, `API Error: ${code}`, new Error(message));
  }
  return {
    success: false,
    error: { message, code },
  };
};

export const checkAdminRole = (session: Session | null): boolean => {
  const isAdmin = session?.user?.role === "admin";
  logger.debug(LogComponent.AUTH, "Checking admin role", {
    userId: session?.user?.id,
    isAdmin,
  });
  return isAdmin;
};

// Common error codes
export const API_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFLICT: "CONFLICT",
  INVALID_INPUT: "INVALID_INPUT",
  CONFIG_LOAD_FAILED: "CONFIG_LOAD_FAILED",
  CONFIG_SAVE_FAILED: "CONFIG_SAVE_FAILED",
  PAIRING_FAILED: "PAIRING_FAILED",
} as const;

// HTTP status codes mapping
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;
