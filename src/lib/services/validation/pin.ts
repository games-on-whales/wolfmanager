import { LogComponent, logger } from "@/lib/logger";
import { z } from "zod";

export const PINSchema = z.string().regex(/^[0-9]{4}$/, {
  message: "PIN must be exactly 4 digits",
});

export type PINValidationError = {
  type: "FORMAT" | "API" | "RATE_LIMIT";
  message: string;
};

export class PINValidationService {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private static attempts = new Map<string, number[]>();

  static validateFormat(pin: string) {
    return PINSchema.safeParse(pin);
  }

  static isRateLimited(userId: string): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(userId) || [];

    // Clean up old attempts
    const recentAttempts = userAttempts.filter(
      (timestamp) => now - timestamp < this.WINDOW_MS
    );

    if (recentAttempts.length >= this.MAX_ATTEMPTS) {
      return true;
    }

    // Update attempts
    this.attempts.set(userId, [...recentAttempts, now]);
    return false;
  }

  static resetAttempts(userId: string) {
    this.attempts.delete(userId);
  }

  static async validatePIN(pin: string, userId: string): Promise<boolean> {
    try {
      // Check rate limiting
      if (this.isRateLimited(userId)) {
        await logger.warn(
          LogComponent.PAIRING,
          "Rate limit exceeded for PIN validation",
          {
            userId,
          }
        );
        throw {
          type: "RATE_LIMIT",
          message: "Too many attempts. Please try again later.",
        };
      }

      // Validate format
      const formatResult = this.validateFormat(pin);
      if (!formatResult.success) {
        await logger.warn(LogComponent.PAIRING, "Invalid PIN format", {
          userId,
        });
        throw { type: "FORMAT", message: "PIN must be exactly 4 digits" };
      }

      return true;
    } catch (error) {
      if ((error as PINValidationError).type) {
        throw error;
      }
      await logger.error(
        LogComponent.PAIRING,
        "Unexpected error in PIN validation",
        error,
        { userId }
      );
      throw { type: "API", message: "An unexpected error occurred" };
    }
  }
}
