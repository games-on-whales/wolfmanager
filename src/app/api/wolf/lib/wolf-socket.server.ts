import { LogComponent, logger } from "@/lib/logger";
import fs from "fs";
import http from "http";

const WOLF_SOCKET_PATH = "/var/run/wolf/wolf.sock";

async function checkDevContainer() {
  try {
    // Check if we're in a dev container
    const isDevContainer =
      process.env.REMOTE_CONTAINERS === "true" ||
      process.env.CODESPACES === "true" ||
      fs.existsSync("/.dockerenv");

    await logger.debug(LogComponent.API, "[WOLF_SOCKET] Environment", {
      isDevContainer,
      dockerEnv: fs.existsSync("/.dockerenv"),
      remoteContainers: process.env.REMOTE_CONTAINERS,
      codespaces: process.env.CODESPACES,
      user: process.env.USER,
      uid: process.getuid?.(),
      gid: process.getgid?.(),
    });

    return isDevContainer;
  } catch (error) {
    await logger.warn(
      LogComponent.API,
      "[WOLF_SOCKET] Error checking dev container",
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}

async function checkSocketPermissions() {
  try {
    const stats = fs.statSync(WOLF_SOCKET_PATH);
    await logger.debug(LogComponent.API, "[WOLF_SOCKET] Socket permissions", {
      path: WOLF_SOCKET_PATH,
      mode: stats.mode.toString(8),
      uid: stats.uid,
      gid: stats.gid,
      isSocket: stats.isSocket(),
    });
    return true;
  } catch (error) {
    await logger.error(
      LogComponent.API,
      "[WOLF_SOCKET] Permission check failed",
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

interface WolfApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
}

interface SystemError extends Error {
  code?: string;
  syscall?: string;
  address?: string;
}

/**
 * Makes a request to the Wolf API through the Unix domain socket
 */
export async function callWolfApi(
  endpoint: string,
  options: WolfApiOptions = {}
): Promise<unknown> {
  const { method = "GET", body } = options;

  await logger.debug(LogComponent.API, "Wolf API call initiated", {
    endpoint,
    method,
    hasBody: !!body,
    timestamp: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const requestOptions = {
      socketPath: WOLF_SOCKET_PATH,
      path: `/api/v1${endpoint}`,
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(body
          ? { "Content-Length": Buffer.from(JSON.stringify(body)).length }
          : {}),
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", async () => {
        try {
          await logger.debug(LogComponent.API, "Wolf API response received", {
            endpoint,
            method,
            statusCode: res.statusCode,
            dataSize: data.length,
          });

          if (!data) {
            await logger.debug(
              LogComponent.API,
              "Wolf API empty response",
              { endpoint, method }
            );
            resolve({});
            return;
          }

          const jsonResponse = JSON.parse(data);
          await logger.debug(
            LogComponent.API,
            "Wolf API response parsed successfully",
            {
              endpoint,
              method,
              responseType: typeof jsonResponse,
            }
          );
          resolve(jsonResponse);
        } catch (error) {
          await logger.error(
            LogComponent.API,
            "Wolf API JSON parse error",
            error instanceof Error ? error : new Error(String(error)),
            { endpoint, method, rawDataPreview: data.substring(0, 200) }
          );
          reject(new Error("Failed to parse Wolf API response"));
        }
      });
    });

    req.on("error", async (error: SystemError) => {
      await logger.error(
        LogComponent.API,
        "Wolf API request error",
        error,
        {
          endpoint,
          method,
          code: error.code,
          syscall: error.syscall,
          address: error.address,
        }
      );
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}
