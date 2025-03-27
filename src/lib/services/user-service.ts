import {
  API_ERROR_CODES,
  createErrorResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { ClientDevice } from "@/lib/config";

export class UserService {
  /**
   * Add a client device to a user's paired clients list
   */
  static async addClientToUser(
    username: string,
    deviceId: string,
    friendlyName: string
  ): Promise<ApiResponse<{ client: ClientDevice }>> {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          friendlyName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return error;
      }

      return await response.json();
    } catch (error) {
      return createErrorResponse(
        "Failed to pair client",
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  /**
   * Remove a client device from a user's paired clients list
   */
  static async removeClientFromUser(
    username: string,
    deviceId: string
  ): Promise<ApiResponse<{ client: ClientDevice }>> {
    try {
      const response = await fetch(`/api/users?deviceId=${deviceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        return error;
      }

      return await response.json();
    } catch (error) {
      return createErrorResponse(
        "Failed to unpair client",
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  /**
   * Get all paired clients for a user
   */
  static async getUserClients(
    username: string
  ): Promise<ApiResponse<{ clients: ClientDevice[] }>> {
    try {
      const response = await fetch("/api/users");

      if (!response.ok) {
        const error = await response.json();
        return error;
      }

      return await response.json();
    } catch (error) {
      return createErrorResponse(
        "Failed to get clients",
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  }
}
