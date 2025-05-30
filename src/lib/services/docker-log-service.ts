import {
  API_ERROR_CODES,
  createErrorResponse,
  type ApiResponse,
} from "@/lib/api-utils";
import { LogComponent, logger } from "@/lib/logger";
import Docker from "dockerode";

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
  // Docker socket path
  DOCKER_SOCKET_PATH: "/var/run/docker.sock", // Updated to match the volume mount

  // Target container image
  TARGET_IMAGE: "ghcr.io/games-on-whales/wolf",

  // Get Docker client instance
  getDockerClient(): Docker {
    try {
      return new Docker({ socketPath: this.DOCKER_SOCKET_PATH });
    } catch (error) {
      logger.error(
        LogComponent.CONTAINER,
        "Failed to create Docker client",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  },

  // Find Wolf container by image name
  async findWolfContainer(): Promise<ApiResponse<ContainerInfo>> {
    try {
      const docker = this.getDockerClient();
      const containers = await docker.listContainers({ all: false });

      logger.debug(LogComponent.CONTAINER, "Searching for Wolf container", {
        totalContainers: containers.length,
        targetImage: this.TARGET_IMAGE,
      });

      // Filter containers by image name
      const wolfContainers = containers.filter((container) =>
        container.Image.startsWith(this.TARGET_IMAGE)
      );

      if (wolfContainers.length === 0) {
        logger.warn(
          LogComponent.CONTAINER,
          "No running Wolf containers found",
          { targetImage: this.TARGET_IMAGE }
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
        containerInfo
      );

      return {
        success: true,
        data: containerInfo,
      };
    } catch (error) {
      logger.error(
        LogComponent.CONTAINER,
        "Error finding Wolf container",
        error instanceof Error ? error : new Error(String(error))
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
    containerId: string,
    // Default options if none provided
    options: LogOptions = { tail: 100, timestamps: true }
  ): Promise<ApiResponse<LogEntry[]>> {
    try {
      const docker = this.getDockerClient();
      const container = docker.getContainer(containerId);

      logger.debug(LogComponent.CONTAINER, "Retrieving container logs sample", {
        // Updated log message
        containerId,
        options,
      });

      // Prepare log options for dockerode
      const logOptions: Docker.ContainerLogsOptions = {
        stdout: true,
        stderr: true,
        timestamps: options.timestamps !== false,
        follow: false, // Explicitly false for sample logs
      };

      // Add 'since' or 'tail' based on options provided
      if (options.since && options.since > 0) {
        // Ensure since is a valid timestamp > 0
        logOptions.since = options.since;
        // If 'since' is used, 'tail' might behave unexpectedly or be ignored by Docker,
        // so we don't set tail when since is present.
        logger.debug(LogComponent.CONTAINER, "Using 'since' option for logs", {
          since: options.since,
        });
      } else {
        // Default to tail if since is not provided or invalid
        logOptions.tail = options.tail || 100;
        logger.debug(LogComponent.CONTAINER, "Using 'tail' option for logs", {
          tail: logOptions.tail,
        });
      }

      // When follow is false, container.logs() returns a Buffer
      // TypeScript casting needed due to complex overload types
      const logBuffer = await container.logs(logOptions as any) as unknown as Buffer;

      // Ensure logBuffer is a Buffer before parsing
      if (!Buffer.isBuffer(logBuffer)) {
        logger.warn(
          LogComponent.CONTAINER,
          "container.logs did not return a Buffer as expected",
          { containerId, resultType: typeof logBuffer }
        );
        // Return empty logs if the result is not a buffer
        return {
          success: true,
          data: [],
        };
      }

      const logs = this.parseDockerLogs(logBuffer);

      logger.debug(LogComponent.CONTAINER, "Retrieved container logs sample", {
        // Updated log message
        containerId,
        count: logs.length,
      });

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      logger.error(
        LogComponent.CONTAINER,
        "Error retrieving container logs sample", // Updated log message
        error instanceof Error ? error : new Error(String(error)),
        { containerId }
      );

      return createErrorResponse(
        `Failed to retrieve container logs sample: ${
          // Updated message
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
