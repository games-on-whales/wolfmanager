import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const ENV_FILE_PATH = path.join(process.cwd(), ".env.local");

interface EnvVars {
  NEXTAUTH_SECRET: string;
  ENCRYPTION_KEY: string;
  NEXTAUTH_URL?: string;
  INTERNAL_SERVICE_TOKEN?: string;
}

function generateSecureKey(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

function readEnvFile(): EnvVars {
  try {
    const envContent = fs.readFileSync(ENV_FILE_PATH, "utf-8");
    const envVars: Partial<EnvVars> = {};

    envContent.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) {
        envVars[key.trim() as keyof EnvVars] = value.trim();
      }
    });

    return envVars as EnvVars;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {} as EnvVars;
    }
    throw error;
  }
}

function writeEnvFile(envVars: EnvVars): void {
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  fs.writeFileSync(ENV_FILE_PATH, envContent, "utf-8");
}

// Function to get the local IP address
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === "IPv4") {
        return iface.address;
      }
    }
  }
  return "localhost"; // Fallback to localhost if no IP found
}

export function ensureSecureKeys(): void {
  try {
    // Check if NEXTAUTH_SECRET is already set in environment (container case)
    const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
    const hasEncryptionKey = !!process.env.ENCRYPTION_KEY;
    
    // If both keys are already available in environment, no need to proceed
    if (hasNextAuthSecret && hasEncryptionKey) {
      console.log("[ENV] Secure keys already available in environment");
      return;
    }

    console.log("[ENV] Checking and ensuring secure keys are available...");
    
    const envVars = readEnvFile();
    let needsUpdate = false;
    let keysGenerated: string[] = [];

    // Ensure NEXTAUTH_SECRET exists (check environment first, then .env.local)
    if (!hasNextAuthSecret && !envVars.NEXTAUTH_SECRET) {
      envVars.NEXTAUTH_SECRET = generateSecureKey(64);
      needsUpdate = true;
      keysGenerated.push("NEXTAUTH_SECRET");
    }

    // Ensure INTERNAL_SERVICE_TOKEN exists and is exactly 64 bytes
    if (!envVars.INTERNAL_SERVICE_TOKEN || envVars.INTERNAL_SERVICE_TOKEN.length !== 64) {
      envVars.INTERNAL_SERVICE_TOKEN = generateSecureKey(64);
      needsUpdate = true;
      keysGenerated.push("INTERNAL_SERVICE_TOKEN");
    }

    // Ensure ENCRYPTION_KEY exists and is exactly 32 bytes
    if (!hasEncryptionKey && (!envVars.ENCRYPTION_KEY || envVars.ENCRYPTION_KEY.length !== 32)) {
      envVars.ENCRYPTION_KEY = generateSecureKey(32);
      needsUpdate = true;
      keysGenerated.push("ENCRYPTION_KEY");
    }
// Validate INTERNAL_SERVICE_TOKEN at runtime
if (!process.env.INTERNAL_SERVICE_TOKEN) {
  console.warn("[ENV] Warning: INTERNAL_SERVICE_TOKEN is missing. Ensure it is set for secure communication.");
}

    // Ensure NEXTAUTH_URL exists in development
    if (process.env.NODE_ENV === "development" && !process.env.NEXTAUTH_URL && !envVars.NEXTAUTH_URL) {
      // Use the actual IP address for NEXTAUTH_URL
      const localIp = getLocalIpAddress();
      envVars.NEXTAUTH_URL = `http://${localIp}:3000`;
      needsUpdate = true;
      keysGenerated.push("NEXTAUTH_URL");
    }

    // Update .env.local file if needed (but only if we can write to it)
    if (needsUpdate) {
      try {
        writeEnvFile(envVars);
        console.log(`[ENV] Auto-generated secure keys: ${keysGenerated.join(", ")}`);
        console.log("[ENV] Keys saved to .env.local file");
      } catch (error) {
        // In container environments, we might not be able to write to .env.local
        // This is fine as we'll set the environment variables directly
        console.log("[ENV] Could not write to .env.local (container environment), setting environment variables directly");
      }
    }

    // Always set environment variables for the current process
    // Use environment variables first, then fall back to .env.local values
    if (!hasNextAuthSecret) {
      process.env.NEXTAUTH_SECRET = envVars.NEXTAUTH_SECRET;
    }
    if (!hasEncryptionKey) {
      process.env.ENCRYPTION_KEY = envVars.ENCRYPTION_KEY;
    }
    if (envVars.NEXTAUTH_URL && !process.env.NEXTAUTH_URL) {
      process.env.NEXTAUTH_URL = envVars.NEXTAUTH_URL;
    }

    if (keysGenerated.length > 0) {
      console.log("[ENV] Secure environment setup completed successfully");
    } else {
      console.log("[ENV] All secure keys were already present");
    }

  } catch (error) {
    console.error("[ENV] Failed to ensure secure keys:", error);
    throw new Error("Failed to initialize secure environment variables");
  }
}
