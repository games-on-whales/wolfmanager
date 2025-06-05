/**
 * Centralized Socket Service
 * 
 * This module provides a secure, centralized service for handling both Wolf and Docker
 * socket communication with proper authentication, error handling, logging, and rate limiting.
 * 
 * Features:
 * - Server-side only execution with runtime checks
 * - NextAuth session validation integration
 * - Comprehensive error handling and logging
 * - Rate limiting and security controls
 * - Support for both Wolf and Docker sockets
 * - Singleton pattern for efficient resource management
 */

import { Session } from "next-auth";
import { LogComponent, logger } from "@/lib/logger";
import {
  validateSocketAccess,
  getSocketPermission,
  getOperationFromMethod,
  requiresAdminAccess,
  SOCKET_TYPES,
  SOCKET_OPERATIONS,
  SOCKET_PERMISSIONS,
  RATE_LIMIT_CONFIG,
  type SocketType,
  type SocketOperation,
  type SocketPermission,
} from "@/lib/auth/socket-permissions";
import http from "http";
import fs from "fs";
import Docker from "dockerode";

// Runtime environment check
function ensureServerSide(): void {
  if (typeof window !== "undefined") {
    throw new Error("SocketService can only be used on the server side");
  }
}

// Socket paths configuration
const SOCKET_PATHS = {
  [SOCKET_TYPES.WOLF]: "/var/run/wolf/wolf.sock",
  [SOCKET_TYPES.DOCKER]: "/var/run/docker.sock",
} as const;

// Rate limiting store (in-memory for now, could be Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Interface for Wolf API request options
 */
export interface WolfApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Interface for Docker operation options
 */
export interface DockerOperationOptions {
  containerId?: string;
  operation: "logs" | "list" | "inspect" | "start" | "stop" | "restart";
  options?: Record<string, unknown>;
}

/**
 * Standard API response interface
 */
export interface SocketServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * System error interface for socket operations
 */
interface SystemError extends Error {
  code?: string;
  syscall?: string;
  address?: string;
}

/**
 * Centralized Socket Service Class
 * 
 * Provides secure access to Wolf and Docker sockets with comprehensive
 * authentication, authorization, rate limiting, and error handling.
 */
export class SocketService {
  private static instance: SocketService | null = null;
  private dockerClient: Docker | null = null;

  private constructor() {
    ensureServerSide();
    this.initializeDockerClient();
  }

  /**
   * Get singleton instance of SocketService
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Docker client if available
   */
  private initializeDockerClient(): void {
    try {
      if (fs.existsSync(SOCKET_PATHS[SOCKET_TYPES.DOCKER])) {
        this.dockerClient = new Docker({ 
          socketPath: SOCKET_PATHS[SOCKET_TYPES.DOCKER] 
        });
        logger.debug(LogComponent.CONTAINER, "Docker client initialized successfully");
      } else {
        logger.warn(LogComponent.CONTAINER, "Docker socket not found", {
          path: SOCKET_PATHS[SOCKET_TYPES.DOCKER],
        });
      }
    } catch (error) {
      logger.error(LogComponent.CONTAINER, "Failed to initialize Docker client", error);
    }
  }

  /**
   * Check if user has hit rate limit
   */
  private checkRateLimit(userId: string, socketType: SocketType): boolean {
    const key = `${userId}:${socketType}`;
    const now = Date.now();
    const limit = socketType === SOCKET_TYPES.WOLF 
      ? RATE_LIMIT_CONFIG.WOLF_MAX_REQUESTS_PER_MINUTE
      : RATE_LIMIT_CONFIG.DOCKER_MAX_REQUESTS_PER_MINUTE;

    const userLimit = rateLimitStore.get(key);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + RATE_LIMIT_CONFIG.RATE_LIMIT_WINDOW_MS,
      });
      return false;
    }

    if (userLimit.count >= limit) {
      logger.warn(LogComponent.AUTH, "Rate limit exceeded", {
        userId,
        socketType,
        count: userLimit.count,
        limit,
      });
      return true;
    }

    // Increment count
    userLimit.count++;
    return false;
  }

  /**
   * Validate session and permissions for socket access
   */
  private async validateAccess(
    session: Session | null,
    socketType: SocketType,
    operation: SocketOperation,
    endpoint?: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check session validity
      if (!session?.user) {
        return { valid: false, error: "Authentication required" };
      }

      // Check for session expiration
      if (session.error === "SessionExpired") {
        return { valid: false, error: "Session expired" };
      }

      // Check rate limiting
      if (this.checkRateLimit(session.user.id, socketType)) {
        return { valid: false, error: "Rate limit exceeded" };
      }

      // Validate socket access permissions
      const hasAccess = await validateSocketAccess(session, socketType, operation);
      if (!hasAccess) {
        return { valid: false, error: "Insufficient permissions" };
      }

      // Check admin-only endpoints
      if (endpoint && requiresAdminAccess(endpoint, socketType)) {
        const permission = await getSocketPermission(session, socketType);
        if (permission !== SOCKET_PERMISSIONS.ADMIN) {
          return { valid: false, error: "Admin access required for this endpoint" };
        }
      }

      return { valid: true };
    } catch (error) {
      logger.error(LogComponent.AUTH, "Error validating socket access", error, {
        socketType,
        operation,
        endpoint,
        userId: session?.user?.id,
      });
      return { valid: false, error: "Access validation failed" };
    }
  }

  /**
   * Check socket permissions and availability
   */
  private async checkSocketAvailability(socketType: SocketType): Promise<boolean> {
    try {
      const socketPath = SOCKET_PATHS[socketType];
      
      if (!fs.existsSync(socketPath)) {
        logger.error(LogComponent.SYSTEM, "Socket not found", { socketType, socketPath });
        return false;
      }

      const stats = fs.statSync(socketPath);
      if (!stats.isSocket()) {
        logger.error(LogComponent.SYSTEM, "Path is not a socket", { socketType, socketPath });
        return false;
      }

      logger.debug(LogComponent.SYSTEM, "Socket availability verified", {
        socketType,
        socketPath,
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid,
      });

      return true;
    } catch (error) {
      logger.error(LogComponent.SYSTEM, "Socket availability check failed", error, {
        socketType,
      });
      return false;
    }
  }

  /**
   * Make a request to the Wolf API through Unix domain socket
   * 
   * @param session - User session for authentication
   * @param endpoint - API endpoint (e.g., "/clients", "/users")
   * @param options - Request options including method, body, headers
   * @returns Promise with API response
   */
  public async callWolfApi(
    session: Session | null,
    endpoint: string,
    options: WolfApiOptions = {}
  ): Promise<SocketServiceResponse> {
    ensureServerSide();

    const { method = "GET", body, headers = {} } = options;
    const operation = getOperationFromMethod(method);

    try {
      // Validate access permissions
      const accessCheck = await this.validateAccess(
        session,
        SOCKET_TYPES.WOLF,
        operation,
        endpoint
      );

      if (!accessCheck.valid) {
        return {
          success: false,
          error: accessCheck.error,
          statusCode: 403,
        };
      }

      // Check socket availability
      const socketAvailable = await this.checkSocketAvailability(SOCKET_TYPES.WOLF);
      if (!socketAvailable) {
        return {
          success: false,
          error: "Wolf socket not available",
          statusCode: 503,
        };
      }

      logger.debug(LogComponent.API, "Making Wolf API request", {
        endpoint,
        method,
        userId: session?.user?.id,
        hasBody: !!body,
      });

      // Prepare request
      const requestData = body ? JSON.stringify(body) : undefined;
      const requestOptions = {
        socketPath: SOCKET_PATHS[SOCKET_TYPES.WOLF],
        path: `/api/v1${endpoint}`,
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
          ...(requestData ? { "Content-Length": Buffer.byteLength(requestData) } : {}),
        },
      };

      // Execute request
      const response = await this.executeHttpRequest(requestOptions, requestData);

      logger.debug(LogComponent.API, "Wolf API request completed", {
        endpoint,
        method,
        statusCode: response.statusCode,
        userId: session?.user?.id,
      });

      return response;
    } catch (error) {
      logger.error(LogComponent.API, "Wolf API request failed", error, {
        endpoint,
        method,
        userId: session?.user?.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        statusCode: 500,
      };
    }
  }

  /**
   * Execute Docker operations through Docker socket
   * 
   * @param session - User session for authentication
   * @param options - Docker operation options
   * @returns Promise with operation response
   */
  public async executeDockerOperation(
    session: Session | null,
    options: DockerOperationOptions
  ): Promise<SocketServiceResponse> {
    ensureServerSide();

    const { operation, containerId, options: dockerOptions = {} } = options;

    try {
      // All Docker operations require at least read access, some require admin
      const requiredOperation = ["start", "stop", "restart"].includes(operation)
        ? SOCKET_OPERATIONS.ADMIN
        : SOCKET_OPERATIONS.READ;

      // Validate access permissions
      const accessCheck = await this.validateAccess(
        session,
        SOCKET_TYPES.DOCKER,
        requiredOperation
      );

      if (!accessCheck.valid) {
        return {
          success: false,
          error: accessCheck.error,
          statusCode: 403,
        };
      }

      // Check Docker client availability
      if (!this.dockerClient) {
        return {
          success: false,
          error: "Docker client not available",
          statusCode: 503,
        };
      }

      logger.debug(LogComponent.CONTAINER, "Executing Docker operation", {
        operation,
        containerId,
        userId: session?.user?.id,
      });

      let result: unknown;

      switch (operation) {
        case "list":
          result = await this.dockerClient.listContainers(dockerOptions);
          break;

        case "logs":
          if (!containerId) {
            return { success: false, error: "Container ID required for logs operation" };
          }
          const container = this.dockerClient.getContainer(containerId);
          result = await container.logs({
            stdout: true,
            stderr: true,
            timestamps: true,
            tail: 100,
            ...dockerOptions,
          });
          break;

        case "inspect":
          if (!containerId) {
            return { success: false, error: "Container ID required for inspect operation" };
          }
          result = await this.dockerClient.getContainer(containerId).inspect();
          break;

        case "start":
        case "stop":
        case "restart":
          if (!containerId) {
            return { success: false, error: `Container ID required for ${operation} operation` };
          }
          const targetContainer = this.dockerClient.getContainer(containerId);
          if (operation === "start") {
            result = await targetContainer.start();
          } else if (operation === "stop") {
            result = await targetContainer.stop();
          } else if (operation === "restart") {
            result = await targetContainer.restart();
          }
          break;

        default:
          return { success: false, error: `Unsupported Docker operation: ${operation}` };
      }

      logger.info(LogComponent.CONTAINER, "Docker operation completed", {
        operation,
        containerId,
        userId: session?.user?.id,
      });

      return {
        success: true,
        data: result,
        statusCode: 200,
      };
    } catch (error) {
      logger.error(LogComponent.CONTAINER, "Docker operation failed", error, {
        operation,
        containerId,
        userId: session?.user?.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Docker operation failed",
        statusCode: 500,
      };
    }
  }

  /**
   * Execute HTTP request over Unix domain socket
   */
  private executeHttpRequest(
    requestOptions: http.RequestOptions,
    requestData?: string
  ): Promise<SocketServiceResponse> {
    return new Promise((resolve) => {
      const req = http.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            // Handle empty response
            if (!data) {
              resolve({
                success: true,
                data: {},
                statusCode: res.statusCode,
              });
              return;
            }

            // Try to parse JSON response
            let parsedData: unknown;
            try {
              parsedData = JSON.parse(data);
            } catch {
              // If not JSON, return raw string
              parsedData = data;
            }

            const success = (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300;

            resolve({
              success,
              data: parsedData,
              statusCode: res.statusCode,
              error: success ? undefined : `HTTP ${res.statusCode}: ${res.statusMessage}`,
            });
          } catch (error) {
            resolve({
              success: false,
              error: "Failed to parse response",
              statusCode: res.statusCode ?? 500,
            });
          }
        });
      });

      req.on("error", (error: SystemError) => {
        logger.error(LogComponent.API, "Socket request error", error, {
          code: error.code,
          syscall: error.syscall,
          address: error.address,
        });

        resolve({
          success: false,
          error: error.message,
          statusCode: 500,
        });
      });

      // Write request body if present
      if (requestData) {
        req.write(requestData);
      }

      req.end();
    });
  }

  /**
   * Get service status and health information
   */
  public async getServiceStatus(session: Session | null): Promise<SocketServiceResponse> {
    try {
      // Basic authentication check
      if (!session?.user) {
        return {
          success: false,
          error: "Authentication required",
          statusCode: 401,
        };
      }

      const wolfSocketAvailable = await this.checkSocketAvailability(SOCKET_TYPES.WOLF);
      const dockerSocketAvailable = await this.checkSocketAvailability(SOCKET_TYPES.DOCKER);

      const status = {
        wolfSocket: {
          available: wolfSocketAvailable,
          path: SOCKET_PATHS[SOCKET_TYPES.WOLF],
        },
        dockerSocket: {
          available: dockerSocketAvailable,
          path: SOCKET_PATHS[SOCKET_TYPES.DOCKER],
        },
        permissions: {
          wolf: await getSocketPermission(session, SOCKET_TYPES.WOLF),
          docker: await getSocketPermission(session, SOCKET_TYPES.DOCKER),
        },
        rateLimits: {
          wolf: RATE_LIMIT_CONFIG.WOLF_MAX_REQUESTS_PER_MINUTE,
          docker: RATE_LIMIT_CONFIG.DOCKER_MAX_REQUESTS_PER_MINUTE,
        },
      };

      return {
        success: true,
        data: status,
        statusCode: 200,
      };
    } catch (error) {
      logger.error(LogComponent.SYSTEM, "Failed to get service status", error);
      return {
        success: false,
        error: "Failed to retrieve service status",
        statusCode: 500,
      };
    }
  }

  /**
   * Clear rate limiting data for a user (admin only)
   */
  public async clearRateLimit(session: Session | null, userId: string): Promise<SocketServiceResponse> {
    try {
      // Validate admin access
      const accessCheck = await this.validateAccess(
        session,
        SOCKET_TYPES.WOLF, // Use Wolf socket for admin operations
        SOCKET_OPERATIONS.ADMIN
      );

      if (!accessCheck.valid) {
        return {
          success: false,
          error: accessCheck.error,
          statusCode: 403,
        };
      }

      // Clear rate limit data for user
      const keysToDelete = Array.from(rateLimitStore.keys()).filter(key => 
        key.startsWith(`${userId}:`)
      );

      keysToDelete.forEach(key => rateLimitStore.delete(key));

      logger.info(LogComponent.AUTH, "Rate limit cleared for user", {
        targetUserId: userId,
        adminUserId: session?.user?.id,
        keysCleared: keysToDelete.length,
      });

      return {
        success: true,
        data: { cleared: keysToDelete.length },
        statusCode: 200,
      };
    } catch (error) {
      logger.error(LogComponent.AUTH, "Failed to clear rate limit", error);
      return {
        success: false,
        error: "Failed to clear rate limit",
        statusCode: 500,
      };
    }
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();

// Export types for external use
export type {
  SocketType,
  SocketOperation,
  SocketPermission,
};