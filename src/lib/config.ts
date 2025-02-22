import TOML from "@iarna/toml";
import bcrypt from "bcryptjs";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import toml from "toml";
import { decrypt, encrypt } from "./crypto";

export interface SystemConfig {
  name: string;
  version: string;
}

export interface ClientDevice {
  id: string;
  friendly_name: string;
}

export interface UserConfig {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  has_changed_password: boolean;
  requiresFirstTimeSetup: boolean;
  steam_id?: string;
  steam_api_key?: string;
  clients: ClientDevice[];
}

export interface Config {
  system: SystemConfig;
  users: { [username: string]: UserConfig };
}

export function isValidConfig(config: unknown): config is Config {
  const c = config as Config;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.system === "object" &&
    c.system !== null &&
    typeof c.system.name === "string" &&
    typeof c.system.version === "string" &&
    typeof c.users === "object" &&
    c.users !== null
  );
}

const configPath = path.join(process.cwd(), "config", "default.toml");

// Ensure config directory exists
if (!fs.existsSync(path.dirname(configPath))) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

// Generate a hash for password "admin"
const defaultAdminHash = bcrypt.hashSync("admin", 10);

function isEncryptedString(str: string): boolean {
  // Check if the string matches our encryption format (base64:base64:base64)
  const parts = str.split(":");
  return (
    parts.length === 3 &&
    parts.every((part) => /^[A-Za-z0-9+/]*={0,2}$/.test(part))
  );
}

let cachedConfig: Config | null = null;

export async function getConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), "config", "default.toml");
  const configFile = await fsPromises.readFile(configPath, "utf-8");
  const config = toml.parse(configFile) as Config;

  cachedConfig = config;
  return config;
}

export function loadConfig(decryptSensitiveData: boolean = false): Config {
  try {
    const configFile = fs.readFileSync(configPath, "utf-8");
    const parsedConfig = TOML.parse(configFile);

    if (!isValidConfig(parsedConfig)) {
      throw new Error("Invalid configuration structure");
    }

    // Only decrypt sensitive data if explicitly requested
    if (decryptSensitiveData) {
      Object.values(parsedConfig.users).forEach((user) => {
        if (user.steam_id && isEncryptedString(user.steam_id)) {
          try {
            user.steam_id = decrypt(user.steam_id);
          } catch (error) {
            console.error(
              `Failed to decrypt steam_id for user ${user.username}`
            );
            user.steam_id = "";
          }
        }

        if (user.steam_api_key && isEncryptedString(user.steam_api_key)) {
          try {
            user.steam_api_key = decrypt(user.steam_api_key);
          } catch (error) {
            console.error(
              `Failed to decrypt steam_api_key for user ${user.username}`
            );
            user.steam_api_key = "";
          }
        }
      });
    }

    // Initialize empty clients array if not present
    Object.values(parsedConfig.users).forEach((user) => {
      if (!user.clients) {
        user.clients = [];
      }
    });

    return parsedConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // If the file doesn't exist, create it with default settings
      const defaultConfig: Config = {
        system: {
          name: "WolfUI",
          version: "1.0.0",
        },
        users: {
          admin: {
            id: "1",
            username: "admin",
            password_hash: defaultAdminHash,
            is_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            has_changed_password: false,
            requiresFirstTimeSetup: true,
            clients: [],
            steam_id: "",
            steam_api_key: "",
          },
        },
      };
      saveConfig(defaultConfig);
      return defaultConfig;
    }
    throw error;
  }
}

export function saveConfig(config: Config): void {
  // Sort users by ID to maintain consistent order
  const sortedUsers = Object.entries(config.users).sort(
    (a, b) => Number(a[1].id) - Number(b[1].id)
  );

  // Create a deep copy and encrypt sensitive data before saving
  const encryptedConfig = {
    system: config.system,
    users: Object.fromEntries(
      sortedUsers.map(([username, user]) => {
        const encryptedUser = { ...user };
        // Only encrypt non-empty strings that aren't already encrypted
        if (
          encryptedUser.steam_id &&
          encryptedUser.steam_id.length > 0 &&
          !isEncryptedString(encryptedUser.steam_id)
        ) {
          encryptedUser.steam_id = encrypt(encryptedUser.steam_id);
        }
        if (
          encryptedUser.steam_api_key &&
          encryptedUser.steam_api_key.length > 0 &&
          !isEncryptedString(encryptedUser.steam_api_key)
        ) {
          encryptedUser.steam_api_key = encrypt(encryptedUser.steam_api_key);
        }
        return [username, encryptedUser];
      })
    ),
  };

  const configString = TOML.stringify(
    encryptedConfig as unknown as TOML.JsonMap
  );
  fs.writeFileSync(configPath, configString, "utf-8");
}

export function updateUserSteamInfo(
  username: string,
  steamId: string,
  steamApiKey: string
): void {
  const config = loadConfig();
  const user = config.users[username];

  if (!user) {
    throw new Error("User not found");
  }

  user.steam_id = steamId;
  user.steam_api_key = steamApiKey;
  user.updated_at = new Date().toISOString();

  saveConfig(config);
}

export function addUserClient(
  username: string,
  deviceId: string,
  friendlyName: string
): void {
  const config = loadConfig();
  const user = config.users[username];

  if (!user) {
    throw new Error("User not found");
  }

  // Check if device ID already exists
  if (user.clients.some((client) => client.id === deviceId)) {
    throw new Error("Device ID already exists");
  }

  user.clients.push({
    id: deviceId,
    friendly_name: friendlyName,
  });
  user.updated_at = new Date().toISOString();

  saveConfig(config);
}

export function removeUserClient(username: string, deviceId: string): void {
  const config = loadConfig();
  const user = config.users[username];

  if (!user) {
    throw new Error("User not found");
  }

  const clientIndex = user.clients.findIndex(
    (client) => client.id === deviceId
  );
  if (clientIndex === -1) {
    throw new Error("Client device not found");
  }

  user.clients.splice(clientIndex, 1);
  user.updated_at = new Date().toISOString();

  saveConfig(config);
}

export function changeUserPassword(
  username: string,
  newPassword: string
): void {
  const config = loadConfig();
  const user = config.users[username];

  if (!user) {
    throw new Error("User not found");
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);

  user.password_hash = passwordHash;
  user.has_changed_password = true;
  user.updated_at = new Date().toISOString();

  saveConfig(config);
}

export function addUser(
  username: string,
  password: string,
  isAdmin: boolean = false
): Omit<UserConfig, "password_hash"> {
  const config = loadConfig();

  if (config.users[username]) {
    throw new Error("Username already exists");
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  const newUser: UserConfig = {
    id: String(Object.keys(config.users).length + 1),
    username,
    password_hash: passwordHash,
    is_admin: isAdmin,
    created_at: now,
    updated_at: now,
    has_changed_password: false,
    requiresFirstTimeSetup: true,
    clients: [],
    steam_id: "",
    steam_api_key: "",
  };

  config.users[username] = newUser;
  saveConfig(config);

  // Return a copy without sensitive data
  const { password_hash: _, ...userCopy } = newUser;
  return userCopy;
}

export function removeUser(userId: string): void {
  const config = loadConfig();
  const userToRemove = Object.entries(config.users).find(
    ([_, user]) => user.id === userId
  );

  if (!userToRemove) {
    throw new Error("User not found");
  }

  const [username, user] = userToRemove;

  if (
    user.is_admin &&
    Object.values(config.users).filter((u) => u.is_admin).length === 1
  ) {
    throw new Error("Cannot remove the last admin user");
  }

  delete config.users[username];
  saveConfig(config);
}

export function validateUser(username: string, password: string): UserConfig {
  const config = loadConfig();
  const user = config.users[username];

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  return user;
}

// Add a new function to verify Steam credentials
export function verifyUserSteamCredentials(
  username: string,
  steamId: string,
  steamApiKey: string
): boolean {
  const config = loadConfig();
  const user = config.users[username];

  if (!user || !user.steam_id || !user.steam_api_key) {
    return false;
  }

  return (
    bcrypt.compareSync(steamId, user.steam_id) &&
    bcrypt.compareSync(steamApiKey, user.steam_api_key)
  );
}
