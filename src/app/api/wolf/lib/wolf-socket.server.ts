import fs from "fs";
import http from "http";

const WOLF_SOCKET_PATH = "/var/run/wolf/wolf.sock";

function checkDevContainer() {
  try {
    // Check if we're in a dev container
    const isDevContainer =
      process.env.REMOTE_CONTAINERS === "true" ||
      process.env.CODESPACES === "true" ||
      fs.existsSync("/.dockerenv");

    console.log("[WOLF_SOCKET] Environment:", {
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
    console.warn("[WOLF_SOCKET] Error checking dev container:", error);
    return false;
  }
}

function checkSocketPermissions() {
  try {
    const stats = fs.statSync(WOLF_SOCKET_PATH);
    console.log("[WOLF_SOCKET] Socket permissions:", {
      path: WOLF_SOCKET_PATH,
      mode: stats.mode.toString(8),
      uid: stats.uid,
      gid: stats.gid,
      isSocket: stats.isSocket(),
    });
    return true;
  } catch (error) {
    console.error("[WOLF_SOCKET] Permission check failed:", error);
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

      res.on("end", () => {
        try {
          // Add logging for the raw data received before parsing
          console.log("[WOLF_SOCKET_RAW_DATA]", {
            endpoint,
            method,
            statusCode: res.statusCode,
            headers: res.headers,
            rawData: data, // Log the raw string data
          });

          // Handle empty response
          if (!data) {
            console.log("[WOLF_SOCKET_EMPTY_RESPONSE]", { endpoint, method });
            resolve({});
            return;
          }

          const jsonResponse = JSON.parse(data);
          // Add logging for the parsed response before resolving
          console.log("[WOLF_SOCKET_PARSED_RESPONSE]", {
            endpoint,
            method,
            jsonResponse,
          });
          resolve(jsonResponse);
        } catch (error) {
          console.error("[WOLF_SOCKET_PARSE_ERROR]", {
            endpoint,
            method,
            rawData: data, // Include raw data in parse error log
            error,
          });
          reject(new Error("Failed to parse Wolf API response"));
        }
      });
    });

    req.on("error", (error: SystemError) => {
      console.error("[WOLF_SOCKET_REQUEST_ERROR]", {
        code: error.code,
        message: error.message,
        syscall: error.syscall,
        address: error.address,
      });
      reject(error);
    });

    // Write request body if present
    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}
