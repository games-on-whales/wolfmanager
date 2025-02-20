import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const ENV_FILE_PATH = path.join(process.cwd(), ".env.local");

interface EnvVars {
  NEXTAUTH_SECRET: string;
  ENCRYPTION_KEY: string;
  NEXTAUTH_URL?: string;
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
  const envVars = readEnvFile();
  let needsUpdate = false;

  // Ensure NEXTAUTH_SECRET exists
  if (!envVars.NEXTAUTH_SECRET) {
    envVars.NEXTAUTH_SECRET = generateSecureKey(64);
    needsUpdate = true;
  }

  // Ensure ENCRYPTION_KEY exists and is exactly 32 bytes
  if (!envVars.ENCRYPTION_KEY || envVars.ENCRYPTION_KEY.length !== 32) {
    envVars.ENCRYPTION_KEY = generateSecureKey(32);
    needsUpdate = true;
  }

  // Ensure NEXTAUTH_URL exists in development
  if (process.env.NODE_ENV === "development" && !envVars.NEXTAUTH_URL) {
    // Use the actual IP address for NEXTAUTH_URL
    const localIp = getLocalIpAddress();
    envVars.NEXTAUTH_URL = `http://${localIp}:3000`;
    needsUpdate = true;
  }

  if (needsUpdate) {
    writeEnvFile(envVars);
    console.log("Generated secure keys and updated .env.local");
  }

  // Set environment variables for the current process
  process.env.NEXTAUTH_SECRET = envVars.NEXTAUTH_SECRET;
  process.env.ENCRYPTION_KEY = envVars.ENCRYPTION_KEY;
  if (envVars.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = envVars.NEXTAUTH_URL;
  }
}
