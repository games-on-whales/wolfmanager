import {
  API_ERROR_CODES,
  createErrorResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { LogComponent, logger } from "@/lib/logger";
import { SocketService, type SocketServiceResponse } from "@/lib/services/socket-service";
import { Session } from "next-auth";

// Type definitions
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  created: number;
}

export interface LogOptions {
  tail?: number;
  since?: number; // Unix timestamp
  timestamps?: boolean;
  // `follow` is not applicable for sample logs
}

export interface LogEntry {
  message: string;
  timestamp?: string;
  stream: "stdout" | "stderr";
}

// Docker Log Service
export const DockerLogService = {
  // Target container image
  TARGET_IMAGE: "ghcr.io/games-on-whales/wolf",

  // Get SocketService instance
  getSocketService(): SocketService {
    return SocketService.getInstance();
  },

  // Find Wolf container by image name
  async findWolfContainer(session: Session | null): Promise<ApiResponse<ContainerInfo>> {
    try {
      const socketService = this.getSocketService();
      const response = await socketService.executeDockerOperation(session, {
        operation: "list",
        options: { all: false },
      });

      if (!response.success) {
        logger.error(
          LogComponent.CONTAINER,
          "Failed to list containers via socket service",
          new Error(response.error || "Unknown error")
        );
        return createErrorResponse(
          response.error || "Failed to list containers",
          response.statusCode === 403 ? API_ERROR_CODES.UNAUTHORIZED : API_ERROR_CODES.INTERNAL_ERROR
        );
      }

      const containers = response.data as any[];

      logger.debug(LogComponent.CONTAINER, "Searching for Wolf container", {
        totalContainers: containers.length,
        targetImage: this.TARGET_IMAGE,
        userId: session?.user?.id,
      });

      // Filter containers by image name
      const wolfContainers = containers.filter((container) =>
        container.Image.startsWith(this.TARGET_IMAGE)
      );

      if (wolfContainers.length === 0) {
        logger.warn(
          LogComponent.CONTAINER,
          "No running Wolf containers found",
          { targetImage: this.TARGET_IMAGE, userId: session?.user?.id }
        );
        return createErrorResponse(
          "No running Wolf containers found",
          API_ERROR_CODES.NOT_FOUND
        );
      }

      if (wolfContainers.length > 1) {
        logger.info(
          LogComponent.CONTAINER,
          "Multiple Wolf containers found, using the most recent one",
          {
            count: wolfContainers.length,
            containerIds: wolfContainers.map((c) => c.Id).join(", "),
            userId: session?.user?.id,
          }
        );
      }

      // Sort by creation time (newest first) and take the first one
      wolfContainers.sort((a, b) => b.Created - a.Created);
      const targetContainer = wolfContainers[0];

      // Extract container info
      const containerInfo: ContainerInfo = {
        id: targetContainer.Id,
        name: targetContainer.Names[0].replace(/^\//, ""), // Remove leading slash
        image: targetContainer.Image,
        status: targetContainer.Status,
        created: targetContainer.Created,
      };

      logger.info(
        LogComponent.CONTAINER,
        "Found Wolf container",
        { ...containerInfo, userId: session?.user?.id }
      );

      return {
        success: true,
        data: containerInfo,
      };
    } catch (error) {
      logger.error(
        LogComponent.CONTAINER,
        "Error finding Wolf container",
        error instanceof Error ? error : new Error(String(error)),
        { userId: session?.user?.id }
      );

      return createErrorResponse(
        `Failed to find Wolf container: ${
          error instanceof Error ? error.message : String(error)
        }`,
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  // Get container logs (sample)
  async getContainerLogs(
    session: Session | null,
    containerId: string,
    // Default options if none provided
    options: LogOptions = { tail: 100, timestamps: true }
  ): Promise<ApiResponse<LogEntry[]>> {
    try {
      const socketService = this.getSocketService();

      logger.debug(LogComponent.CONTAINER, "Retrieving container logs sample", {
        containerId,
        options,
        userId: session?.user?.id,
      });

      // Prepare log options for Docker socket service
      const dockerOptions: Record<string, unknown> = {
        stdout: true,
        stderr: true,
        timestamps: options.timestamps !== false,
        follow: false, // Explicitly false for sample logs
      };

      // Add 'since' or 'tail' based on options provided
      if (options.since && options.since > 0) {
        dockerOptions.since = options.since;
        logger.debug(LogComponent.CONTAINER, "Using 'since' option for logs", {
          since: options.since,
          userId: session?.user?.id,
        });
      } else {
        dockerOptions.tail = options.tail || 100;
        logger.debug(LogComponent.CONTAINER, "Using 'tail' option for logs", {
          tail: dockerOptions.tail,
          userId: session?.user?.id,
        });
      }

      // Execute Docker logs operation through socket service
      const response = await socketService.executeDockerOperation(session, {
        operation: "logs",
        containerId,
        options: dockerOptions,
      });

      if (!response.success) {
        logger.error(
          LogComponent.CONTAINER,
          "Failed to retrieve container logs via socket service",
          new Error(response.error || "Unknown error"),
          { containerId, userId: session?.user?.id }
        );
        return createErrorResponse(
          response.error || "Failed to retrieve container logs",
          response.statusCode === 403 ? API_ERROR_CODES.UNAUTHORIZED : API_ERROR_CODES.INTERNAL_ERROR
        );
      }

      const logBuffer = response.data as Buffer;

      // Ensure logBuffer is a Buffer before parsing
      if (!Buffer.isBuffer(logBuffer)) {
        logger.warn(
          LogComponent.CONTAINER,
          "Socket service did not return a Buffer as expected",
          { containerId, resultType: typeof logBuffer, userId: session?.user?.id }
        );
        // Return empty logs if the result is not a buffer
        return {
          success: true,
          data: [],
        };
      }

      const logs = this.parseDockerLogs(logBuffer);

      logger.debug(LogComponent.CONTAINER, "Retrieved container logs sample", {
        containerId,
        count: logs.length,
        userId: session?.user?.id,
      });

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      logger.error(
        LogComponent.CONTAINER,
        "Error retrieving container logs sample",
        error instanceof Error ? error : new Error(String(error)),
        { containerId, userId: session?.user?.id }
      );

      return createErrorResponse(
        `Failed to retrieve container logs sample: ${
          error instanceof Error ? error.message : String(error)
        }`,
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  // Get container information
  async getContainerInfo(
    session: Session | null,
    containerId: string
  ): Promise<ApiResponse<ContainerInfo>> {
    try {
      const socketService = this.getSocketService();

      logger.debug(LogComponent.CONTAINER, "Retrieving container info", {
        containerId,
        userId: session?.user?.id,
      });

      const response = await socketService.executeDockerOperation(session, {
        operation: "inspect",
        containerId,
      });

      if (!response.success) {
        logger.error(
          LogComponent.CONTAINER,
          "Failed to inspect container via socket service",
          new Error(response.error || "Unknown error"),
          { containerId, userId: session?.user?.id }
        );
        return createErrorResponse(
          response.error || "Failed to inspect container",
          response.statusCode === 403 ? API_ERROR_CODES.UNAUTHORIZED : API_ERROR_CODES.NOT_FOUND
        );
      }

      const containerData = response.data as any;
      const containerInfo: ContainerInfo = {
        id: containerData.Id,
        name: containerData.Name.replace(/^\//, ''),
        image: containerData.Config.Image,
        status: containerData.State.Status,
        created: new Date(containerData.Created).getTime() / 1000,
      };

      logger.debug(LogComponent.CONTAINER, "Retrieved container info", {
        containerInfo,
        userId: session?.user?.id,
      });

      return {
        success: true,
        data: containerInfo,
      };
    } catch (error) {
      logger.error(
        LogComponent.CONTAINER,
        "Error retrieving container info",
        error instanceof Error ? error : new Error(String(error)),
        { containerId, userId: session?.user?.id }
      );

      return createErrorResponse(
        `Failed to retrieve container info: ${
          error instanceof Error ? error.message : String(error)
        }`,
        API_ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  // Parse Docker logs from buffer
  // Docker multiplexes stdout/stderr by prepending 8 bytes to each line
  // First byte is stream type (01 = stdout, 02 = stderr)
  parseDockerLogs(buffer: Buffer): LogEntry[] {
    const logs: LogEntry[] = [];
    let position = 0;

    while (position < buffer.length) {
      // Docker log format: [8-byte header][content]
      // Header: [stream type][0, 0, 0][size 4 bytes]
      const streamType = buffer[position];
      const size = buffer.readUInt32BE(position + 4);

      // Move past the header
      position += 8;

      if (position + size > buffer.length) {
        break; // Incomplete log entry
      }

      const content = buffer.slice(position, position + size).toString();
      position += size;

      // Parse timestamp if present
      let message = content;
      let timestamp: string | undefined;

      const timestampMatch = content.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+Z) (.*)/
      );
      if (timestampMatch) {
        timestamp = timestampMatch[1];
        message = timestampMatch[2];
      }

      logs.push({
        message: message.trim(),
        timestamp,
        stream: streamType === 1 ? "stdout" : "stderr",
      });
    }

    return logs;
  },

  // createLogStream and processLogChunk are removed as they were for WebSockets
};
