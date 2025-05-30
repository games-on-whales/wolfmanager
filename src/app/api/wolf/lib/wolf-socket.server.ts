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

  console.log("[WOLF_SOCKET_DEBUG] callWolfApi started", {
    endpoint,
    method,
    hasBody: !!body,
    bodyType: body ? typeof body : undefined,
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

    console.log("[WOLF_SOCKET_DEBUG] Request options prepared", {
      endpoint,
      method,
      socketPath: requestOptions.socketPath,
      fullPath: requestOptions.path,
      headers: requestOptions.headers,
    });

    const req = http.request(requestOptions, (res) => {
      console.log("[WOLF_SOCKET_DEBUG] Response received", {
        endpoint,
        method,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
      });

      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
        console.log("[WOLF_SOCKET_DEBUG] Data chunk received", {
          endpoint,
          method,
          chunkSize: chunk.length,
          totalDataSize: data.length,
        });
      });

      res.on("end", async () => {
        console.log("[WOLF_SOCKET_DEBUG] Response end event", {
          endpoint,
          method,
          totalDataSize: data.length,
          dataPreview: data.substring(0, 200),
        });

        try {
          await logger.debug(LogComponent.API, "[WOLF_SOCKET_RAW_DATA]", {
            endpoint,
            method,
            statusCode: res.statusCode,
            headers: res.headers,
            rawData: data,
          });

          if (!data) {
            console.log("[WOLF_SOCKET_DEBUG] Empty response, returning empty object");
            await logger.debug(
              LogComponent.API,
              "[WOLF_SOCKET_EMPTY_RESPONSE]",
              { endpoint, method }
            );
            resolve({});
            return;
          }

          console.log("[WOLF_SOCKET_DEBUG] Parsing JSON response...");
          const jsonResponse = JSON.parse(data);
          console.log("[WOLF_SOCKET_DEBUG] JSON parsed successfully", {
            endpoint,
            method,
            responseType: typeof jsonResponse,
            responseKeys: jsonResponse && typeof jsonResponse === 'object' ? Object.keys(jsonResponse) : undefined,
          });

          await logger.debug(
            LogComponent.API,
            "[WOLF_SOCKET_PARSED_RESPONSE]",
            {
              endpoint,
              method,
              jsonResponse,
            }
          );
          resolve(jsonResponse);
        } catch (error) {
          console.error("[WOLF_SOCKET_DEBUG] JSON parse error", {
            endpoint,
            method,
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            rawData: data.substring(0, 500),
          });

          await logger.error(
            LogComponent.API,
            "[WOLF_SOCKET_PARSE_ERROR]",
            error instanceof Error ? error : new Error(String(error)),
            { endpoint, method, rawData: data }
          );
          reject(new Error("Failed to parse Wolf API response"));
        }
      });
    });

    req.on("error", async (error: SystemError) => {
      console.error("[WOLF_SOCKET_DEBUG] Request error", {
        endpoint,
        method,
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorSyscall: error.syscall,
        errorAddress: error.address,
      });

      await logger.error(
        LogComponent.API,
        "[WOLF_SOCKET_REQUEST_ERROR]",
        error,
        {
          code: error.code,
          syscall: error.syscall,
          address: error.address,
        }
      );
      reject(error);
    });

    if (body) {
      console.log("[WOLF_SOCKET_DEBUG] Writing request body", {
        endpoint,
        method,
        bodySize: JSON.stringify(body).length,
      });
      req.write(JSON.stringify(body));
    }

    console.log("[WOLF_SOCKET_DEBUG] Ending request", {
      endpoint,
      method,
    });
    req.end();
  });
}
