"use server";

import { LogComponent, logger } from "@/lib/logger";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function validateLogin(data: z.infer<typeof loginSchema>) {
  try {
    // Validate the input data
    const result = loginSchema.safeParse(data);
    if (!result.success) {
      logger.warn(LogComponent.AUTH, "Login validation failed", {
        errors: result.error.errors,
      });
      return {
        success: false,
        error: "Invalid input data",
        validationErrors: result.error.errors,
      };
    }

    // Here you can add additional validation logic
    // For example, checking if the username exists before attempting login
    // This prevents unnecessary auth attempts and provides better error messages

    logger.debug(LogComponent.AUTH, "Login validation successful", {
      username: data.username,
    });

    return { success: true };
  } catch (error) {
    logger.error(
      LogComponent.AUTH,
      "Login validation error",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error: "An unexpected error occurred during validation",
    };
  }
}
