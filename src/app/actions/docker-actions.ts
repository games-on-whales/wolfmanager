"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DockerLogService, type ContainerInfo, type LogEntry, type LogOptions } from "@/lib/services/docker-log-service";
import { SocketService } from "@/lib/services/socket-service";
import { LogComponent, logger } from "@/lib/logger";
import { API_ERROR_CODES, createErrorResponse, type ApiResponse } from "@/lib/api-utils";

/**
 * Docker Actions
 * 
 * Server actions for Docker operations that require admin permissions.
 * All actions use the centralized socket service for secure Docker access.
 */

// Action result type for consistent responses
export interface DockerActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Get container logs for a specific container
 */
export async function getContainerLogs(
  containerId: string,
  options: LogOptions = { tail: 100, timestamps: true }
): Promise<DockerActionResult<{ logs: LogEntry[]; container: ContainerInfo | null }>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated Docker action attempt", {
        action: "getContainerLogs",
        containerId,
      });
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin Docker action attempt", {
        userId: session.user.id,
        userRole: session.user.role,
        action: "getContainerLogs",
        containerId,
      });
      return {
        success: false,
        error: "Admin access required for Docker operations",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Getting container logs via action", {
      userId: session.user.id,
      containerId,
      options,
    });

    // Get container logs
    const logsResult = await DockerLogService.getContainerLogs(session, containerId, options);
    
    if (!logsResult.success) {
      return {
        success: false,
        error: logsResult.error?.message || "Failed to fetch container logs",
        code: logsResult.error?.code,
      };
    }

    // Get container info
    let containerInfo = null;
    const containerInfoResult = await DockerLogService.getContainerInfo(session, containerId);
    
    if (containerInfoResult.success) {
      containerInfo = containerInfoResult.data;
    } else {
      logger.warn(LogComponent.CONTAINER, "Could not fetch container info in action", {
        userId: session.user.id,
        containerId,
        error: containerInfoResult.error,
      });
    }

    return {
      success: true,
      data: {
        logs: logsResult.data || [],
        container: containerInfo || null,
      },
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in getContainerLogs action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * Get Wolf container logs
 */
export async function getWolfContainerLogs(
  options: LogOptions = { tail: 100, timestamps: true }
): Promise<DockerActionResult<{ logs: LogEntry[]; container: ContainerInfo }>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated Wolf container logs attempt");
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin Wolf container logs attempt", {
        userId: session.user.id,
        userRole: session.user.role,
      });
      return {
        success: false,
        error: "Admin access required for Docker operations",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Getting Wolf container logs via action", {
      userId: session.user.id,
      options,
    });

    // Find Wolf container
    const containerResult = await DockerLogService.findWolfContainer(session);
    
    if (!containerResult.success) {
      return {
        success: false,
        error: containerResult.error?.message || "Wolf container not found",
        code: containerResult.error?.code,
      };
    }

    const containerInfo = containerResult.data!;

    // Get container logs
    const logsResult = await DockerLogService.getContainerLogs(session, containerInfo.id, options);
    
    if (!logsResult.success) {
      return {
        success: false,
        error: logsResult.error?.message || "Failed to fetch Wolf container logs",
        code: logsResult.error?.code,
      };
    }

    return {
      success: true,
      data: {
        logs: logsResult.data || [],
        container: containerInfo,
      },
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in getWolfContainerLogs action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * Get Wolf container status and information
 */
export async function getWolfContainerStatus(): Promise<DockerActionResult<ContainerInfo>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated Wolf container status attempt");
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin Wolf container status attempt", {
        userId: session.user.id,
        userRole: session.user.role,
      });
      return {
        success: false,
        error: "Admin access required for Docker operations",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Getting Wolf container status via action", {
      userId: session.user.id,
    });

    const containerResult = await DockerLogService.findWolfContainer(session);
    
    if (!containerResult.success) {
      return {
        success: false,
        error: containerResult.error?.message || "Wolf container not found",
        code: containerResult.error?.code,
      };
    }

    return {
      success: true,
      data: containerResult.data!,
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in getWolfContainerStatus action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * Start a container
 */
export async function startContainer(containerId: string): Promise<DockerActionResult<unknown>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated container start attempt", {
        containerId,
      });
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin container start attempt", {
        userId: session.user.id,
        userRole: session.user.role,
        containerId,
      });
      return {
        success: false,
        error: "Admin access required for container management",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Starting container via action", {
      userId: session.user.id,
      containerId,
    });

    const socketService = SocketService.getInstance();
    const result = await socketService.executeDockerOperation(session, {
      operation: "start",
      containerId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to start container",
        code: API_ERROR_CODES.INTERNAL_ERROR,
      };
    }

    logger.info(LogComponent.CONTAINER, "Container started successfully", {
      userId: session.user.id,
      containerId,
    });

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in startContainer action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * Stop a container
 */
export async function stopContainer(containerId: string): Promise<DockerActionResult<unknown>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated container stop attempt", {
        containerId,
      });
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin container stop attempt", {
        userId: session.user.id,
        userRole: session.user.role,
        containerId,
      });
      return {
        success: false,
        error: "Admin access required for container management",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Stopping container via action", {
      userId: session.user.id,
      containerId,
    });

    const socketService = SocketService.getInstance();
    const result = await socketService.executeDockerOperation(session, {
      operation: "stop",
      containerId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to stop container",
        code: API_ERROR_CODES.INTERNAL_ERROR,
      };
    }

    logger.info(LogComponent.CONTAINER, "Container stopped successfully", {
      userId: session.user.id,
      containerId,
    });

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in stopContainer action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * Restart a container
 */
export async function restartContainer(containerId: string): Promise<DockerActionResult<unknown>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated container restart attempt", {
        containerId,
      });
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin container restart attempt", {
        userId: session.user.id,
        userRole: session.user.role,
        containerId,
      });
      return {
        success: false,
        error: "Admin access required for container management",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Restarting container via action", {
      userId: session.user.id,
      containerId,
    });

    const socketService = SocketService.getInstance();
    const result = await socketService.executeDockerOperation(session, {
      operation: "restart",
      containerId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to restart container",
        code: API_ERROR_CODES.INTERNAL_ERROR,
      };
    }

    logger.info(LogComponent.CONTAINER, "Container restarted successfully", {
      userId: session.user.id,
      containerId,
    });

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in restartContainer action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * List all containers
 */
export async function listContainers(includeAll: boolean = false): Promise<DockerActionResult<ContainerInfo[]>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated container list attempt");
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin container list attempt", {
        userId: session.user.id,
        userRole: session.user.role,
      });
      return {
        success: false,
        error: "Admin access required for Docker operations",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Listing containers via action", {
      userId: session.user.id,
      includeAll,
    });

    const socketService = SocketService.getInstance();
    const result = await socketService.executeDockerOperation(session, {
      operation: "list",
      options: { all: includeAll },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to list containers",
        code: API_ERROR_CODES.INTERNAL_ERROR,
      };
    }

    // Transform raw Docker data to ContainerInfo format
    const containers = (result.data as any[]).map((container) => ({
      id: container.Id,
      name: container.Names[0].replace(/^\//, ''),
      image: container.Image,
      status: container.Status,
      created: container.Created,
    }));

    return {
      success: true,
      data: containers,
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in listContainers action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}

/**
 * Get container information
 */
export async function getContainerInfo(containerId: string): Promise<DockerActionResult<ContainerInfo>> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(LogComponent.CONTAINER, "Unauthenticated container info attempt", {
        containerId,
      });
      return {
        success: false,
        error: "Authentication required",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    if (session.user.role !== "admin") {
      logger.warn(LogComponent.CONTAINER, "Non-admin container info attempt", {
        userId: session.user.id,
        userRole: session.user.role,
        containerId,
      });
      return {
        success: false,
        error: "Admin access required for Docker operations",
        code: API_ERROR_CODES.UNAUTHORIZED,
      };
    }

    logger.info(LogComponent.CONTAINER, "Getting container info via action", {
      userId: session.user.id,
      containerId,
    });

    const containerInfoResult = await DockerLogService.getContainerInfo(session, containerId);
    
    if (!containerInfoResult.success) {
      return {
        success: false,
        error: containerInfoResult.error?.message || "Failed to get container info",
        code: containerInfoResult.error?.code,
      };
    }

    return {
      success: true,
      data: containerInfoResult.data!,
    };
  } catch (error) {
    logger.error(LogComponent.CONTAINER, "Error in getContainerInfo action", 
      error instanceof Error ? error : new Error(String(error)));
    
    return {
      success: false,
      error: "Internal server error",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    };
  }
}