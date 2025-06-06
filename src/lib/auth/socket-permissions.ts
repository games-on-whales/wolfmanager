/**
 * Socket Permissions and Security Controls
 * 
 * This module defines permission constants and validation functions for socket access.
 * It provides centralized security controls for both Wolf and Docker socket operations.
 */

import { Session } from "next-auth";
import { LogComponent, logger } from "@/lib/logger";

// Permission levels for socket access
export const SOCKET_PERMISSIONS = {
  /** Full administrative access to all socket operations */
  ADMIN: "admin",
  /** Read-only access to socket operations */
  READ_ONLY: "read_only",
  /** No socket access */
  NONE: "none",
} as const;

export type SocketPermission = (typeof SOCKET_PERMISSIONS)[keyof typeof SOCKET_PERMISSIONS];

// Socket types that can be accessed
export const SOCKET_TYPES = {
  /** Wolf application socket */
  WOLF: "wolf",
  /** Docker daemon socket */
  DOCKER: "docker",
} as const;

export type SocketType = (typeof SOCKET_TYPES)[keyof typeof SOCKET_TYPES];

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  /** Maximum requests per minute per user for Wolf socket */
  WOLF_MAX_REQUESTS_PER_MINUTE: 60,
  /** Maximum requests per minute per user for Docker socket */
  DOCKER_MAX_REQUESTS_PER_MINUTE: 30,
  /** Time window for rate limiting in milliseconds */
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
} as const;

// Socket operation types for granular permissions
export const SOCKET_OPERATIONS = {
  /** Read operations (GET requests, log reading) */
  READ: "read",
  /** Write operations (POST, PUT, DELETE requests) */
  WRITE: "write",
  /** Administrative operations (container management, system operations) */
  ADMIN: "admin",
} as const;

export type SocketOperation = (typeof SOCKET_OPERATIONS)[keyof typeof SOCKET_OPERATIONS];

/**
 * Validates if a user session has permission to access a specific socket type
 * 
 * @param session - NextAuth session object
 * @param socketType - Type of socket being accessed
 * @param operation - Type of operation being performed
 * @returns true if access is granted, false otherwise
 */
export async function validateSocketAccess(
  session: Session | null,
  socketType: SocketType,
  operation: SocketOperation = SOCKET_OPERATIONS.READ
): Promise<boolean> {
  try {
    // Check if session exists and is valid
    if (!session?.user) {
      await logger.warn(LogComponent.AUTH, "Socket access denied: No valid session", {
        socketType,
        operation,
      });
      return false;
    }

    // Check for session expiration
    if (session.error === "SessionExpired") {
      await logger.warn(LogComponent.AUTH, "Socket access denied: Session expired", {
        userId: session.user.id,
        socketType,
        operation,
      });
      return false;
    }

    const userRole = session.user.role;
    const isAdmin = userRole === "admin";

    // Admin users have full access to all sockets and operations
    if (isAdmin) {
      await logger.debug(LogComponent.AUTH, "Socket access granted: Admin user", {
        userId: session.user.id,
        socketType,
        operation,
      });
      return true;
    }

    // For non-admin users, apply granular permissions
    switch (socketType) {
      case SOCKET_TYPES.WOLF:
        // Regular users can read Wolf socket data but cannot perform admin operations
        if (operation === SOCKET_OPERATIONS.ADMIN) {
          await logger.warn(LogComponent.AUTH, "Socket access denied: Admin operation required", {
            userId: session.user.id,
            socketType,
            operation,
            userRole,
          });
          return false;
        }
        // Allow read and write operations for Wolf socket
        return true;

      case SOCKET_TYPES.DOCKER:
        // Docker socket access is restricted to admin users only
        await logger.warn(LogComponent.AUTH, "Socket access denied: Docker access requires admin", {
          userId: session.user.id,
          socketType,
          operation,
          userRole,
        });
        return false;

      default:
        await logger.error(LogComponent.AUTH, "Socket access denied: Unknown socket type", {
          userId: session.user.id,
          socketType,
          operation,
        });
        return false;
    }
  } catch (error) {
    await logger.error(LogComponent.AUTH, "Error validating socket access", error, {
      socketType,
      operation,
      userId: session?.user?.id,
    });
    return false;
  }
}

/**
 * Gets the appropriate permission level for a user and socket type
 * 
 * @param session - NextAuth session object
 * @param socketType - Type of socket being accessed
 * @returns Permission level for the user
 */
export async function getSocketPermission(
  session: Session | null,
  socketType: SocketType
): Promise<SocketPermission> {
  if (!session?.user || session.error === "SessionExpired") {
    return SOCKET_PERMISSIONS.NONE;
  }

  const isAdmin = session.user.role === "admin";

  if (isAdmin) {
    return SOCKET_PERMISSIONS.ADMIN;
  }

  // Regular users get read-only access to Wolf socket, no access to Docker
  switch (socketType) {
    case SOCKET_TYPES.WOLF:
      return SOCKET_PERMISSIONS.READ_ONLY;
    case SOCKET_TYPES.DOCKER:
      return SOCKET_PERMISSIONS.NONE;
    default:
      return SOCKET_PERMISSIONS.NONE;
  }
}

/**
 * Validates socket operation based on HTTP method
 * 
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @returns Corresponding socket operation type
 */
export function getOperationFromMethod(method: string): SocketOperation {
  switch (method.toUpperCase()) {
    case "GET":
    case "HEAD":
      return SOCKET_OPERATIONS.READ;
    case "POST":
    case "PUT":
    case "PATCH":
      return SOCKET_OPERATIONS.WRITE;
    case "DELETE":
      return SOCKET_OPERATIONS.ADMIN;
    default:
      return SOCKET_OPERATIONS.READ;
  }
}

/**
 * Checks if an endpoint requires admin privileges
 * 
 * @param endpoint - API endpoint being accessed
 * @param socketType - Type of socket
 * @returns true if admin privileges are required
 */
export function requiresAdminAccess(endpoint: string, socketType: SocketType): boolean {
  // Admin-only endpoints for Wolf socket
  if (socketType === SOCKET_TYPES.WOLF) {
    const adminEndpoints = [
      "/config",
      "/users",
      "/system",
      "/admin",
    ];
    return adminEndpoints.some(adminEndpoint => endpoint.startsWith(adminEndpoint));
  }

  // All Docker operations require admin access
  if (socketType === SOCKET_TYPES.DOCKER) {
    return true;
  }

  return false;
}