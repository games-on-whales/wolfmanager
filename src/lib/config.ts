import { ClientDevice } from "@/types/client";
import TOML from "@iarna/toml";
import bcrypt from "bcryptjs";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import toml from "toml";
import { decrypt, encrypt } from "./crypto";
import { Logger } from "./logger/logger";
import { LogComponent } from "./logger/types";

export interface SystemConfig {
  name: string;
  version: string;
}

export interface UserConfig {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  has_changed_password: boolean;
  display_name?: string;
  steam_id?: string;
  steam_api_key?: string;
  clients: ClientDevice[];
}

export interface Config {
  system: SystemConfig;
  users: { [username: string]: UserConfig };
  clients: ClientDevice[];
}

export function isValidConfig(config: unknown): config is Config {
  const c = config as Config;
  if (
    typeof c !== "object" ||
    c === null ||
    typeof c.system !== "object" ||
    c.system === null ||
    typeof c.system.name !== "string" ||
    typeof c.system.version !== "string" ||
    typeof c.users !== "object" ||
    c.users === null
  ) {
    return false;
  }

  // Optional but recommended: Check each user has a valid clients array
  for (const user of Object.values(c.users)) {
    if (
      typeof user !== "object" ||
      user === null ||
      !Array.isArray(user.clients)
    ) {
      // Log if needed, or just return false
      logger.warn(
        LogComponent.SYSTEM,
        `Invalid or missing 'clients' array for user: ${
          user?.username ?? "UNKNOWN"
        } in config validation`
      );
      return false;
    }
  }

  return true;
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

const logger = Logger.getInstance();

export function loadConfig(decryptSensitiveData: boolean = false): Config {
  try {
    logger.debug(LogComponent.SYSTEM, "Reading config file", { configPath });
    const configFile = fs.readFileSync(configPath, "utf-8");
    logger.debug(LogComponent.SYSTEM, "Parsing config file");
    const parsedConfig = TOML.parse(configFile);
    logger.debug(LogComponent.SYSTEM, "Parsed config object", {
      configStructure: {
        hasSystem: typeof parsedConfig.system === "object",
        hasUsers: typeof parsedConfig.users === "object",
        hasClients: typeof parsedConfig.clients === "object",
      },
    });

    if (!isValidConfig(parsedConfig)) {
      logger.error(
        LogComponent.SYSTEM,
        "Invalid configuration structure detected by isValidConfig",
        null,
        { parsedConfig }
      );
      throw new Error("Invalid configuration structure");
    }

    // Decrypt sensitive data if requested
    if (decryptSensitiveData) {
      Object.values(parsedConfig.users).forEach((user) => {
        if (user.steam_id && isEncryptedString(user.steam_id)) {
          try {
            user.steam_id = decrypt(user.steam_id);
          } catch (error) {
            logger.error(
              LogComponent.SYSTEM,
              `Failed to decrypt steam_id for user ${user.username}`,
              error instanceof Error ? error : new Error(String(error))
            );
            user.steam_id = ""; // Clear potentially corrupt data
          }
        }
        if (user.steam_api_key && isEncryptedString(user.steam_api_key)) {
          try {
            user.steam_api_key = decrypt(user.steam_api_key);
          } catch (error) {
            logger.error(
              LogComponent.SYSTEM,
              `Failed to decrypt steam_api_key for user ${user.username}`,
              error instanceof Error ? error : new Error(String(error))
            );
            user.steam_api_key = ""; // Clear potentially corrupt data
          }
        }
      });
    }

    // **Crucially: Ensure user.clients array exists after parsing**
    Object.values(parsedConfig.users).forEach((user) => {
      if (!user.clients || !Array.isArray(user.clients)) {
        logger.warn(
          LogComponent.SYSTEM,
          `User ${user.username} missing 'clients' array in loaded config, initializing empty array.`
        );
        user.clients = [];
      }
    });

    logger.info(LogComponent.SYSTEM, "Configuration loaded successfully.");
    return parsedConfig;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load or parse configuration file",
      error instanceof Error ? error : new Error(String(error)),
      { configPath }
    );

    // Handle ENOENT (file not found) by creating default
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn(
        LogComponent.SYSTEM,
        "Config file not found, creating default configuration."
      );
      const defaultConfig: Config = {
        system: { name: "WolfUI", version: "1.0.0" },
        users: {
          admin: {
            id: "1",
            username: "admin",
            password_hash: defaultAdminHash, // Use pre-computed hash
            is_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            has_changed_password: false,
            clients: [], // Initialize user clients
            steam_id: "",
            steam_api_key: "",
          },
        },
        clients: [], // Initialize top-level clients
      };
      try {
        saveConfig(defaultConfig); // Attempt to save the default
        logger.info(
          LogComponent.SYSTEM,
          "Default configuration created and saved."
        );
        return defaultConfig; // Return the newly created default
      } catch (saveError) {
        logger.error(
          LogComponent.SYSTEM,
          "Failed to save default configuration file",
          saveError instanceof Error ? saveError : new Error(String(saveError)),
          { configPath }
        );
        // If saving default also fails, re-throw the original error or a new specific one
        throw new Error(`Failed to load or create configuration: ${error}`);
      }
    }

    // Re-throw other errors after logging
    throw error;
  }
}

export function saveConfig(config: Config): void {
  try {
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
          // Ensure user.clients exists before potential encryption steps
          if (!encryptedUser.clients || !Array.isArray(encryptedUser.clients)) {
            logger.warn(
              LogComponent.SYSTEM,
              `User ${username} missing 'clients' array before save, initializing empty array.`
            );
            encryptedUser.clients = [];
          }

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

    logger.debug(
      LogComponent.SYSTEM,
      "Stringifying configuration for saving.",
      { configPath }
    );
    const configString = TOML.stringify(
      encryptedConfig as unknown as TOML.JsonMap
    );
    logger.debug(LogComponent.SYSTEM, "Writing configuration file.", {
      configPath,
    });
    fs.writeFileSync(configPath, configString, "utf-8");
    logger.info(LogComponent.SYSTEM, "Configuration saved successfully.", {
      configPath,
    });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to save configuration file",
      error instanceof Error ? error : new Error(String(error)),
      { configPath }
    );
    throw error; // Re-throw error after logging
  }
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
  friendlyName: string,
  pairSecret: string
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
    pair_secret: pairSecret,
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

export function validateUser(username: string, password: string) {
  try {
    logger.debug(LogComponent.AUTH, "Attempting to validate user", {
      username,
      configPath: path.resolve(configPath),
    });

    // Load config without decrypting sensitive data since we only need password hash
    const config = loadConfig(false);
    const user = config.users[username];

    if (!user) {
      logger.warn(LogComponent.AUTH, "User not found in config", {
        username,
        availableUsers: Object.keys(config.users),
      });
      return null; // Exit early if user not found
    }

    // --- Enhanced Logging Before Comparison ---
    logger.debug(LogComponent.AUTH, "Preparing for bcrypt comparison", {
      username,
      isPasswordString: typeof password === "string",
      passwordLength: typeof password === "string" ? password.length : "N/A",
      isHashString: typeof user.password_hash === "string",
      hashLength:
        typeof user.password_hash === "string"
          ? user.password_hash.length
          : "N/A",
      hashStart:
        typeof user.password_hash === "string"
          ? user.password_hash.substring(0, 7)
          : "N/A",
    });

    // Check types explicitly before calling compareSync
    if (
      typeof password !== "string" ||
      typeof user.password_hash !== "string"
    ) {
      logger.error(
        LogComponent.AUTH,
        "Invalid types for bcrypt comparison",
        null,
        {
          username,
          passwordType: typeof password,
          hashType: typeof user.password_hash,
        }
      );
      return null;
    }

    // Change to DEBUG for visibility
    logger.debug(LogComponent.AUTH, "Values *just* before bcrypt comparison", {
      receivedPassword: `"${password}"`,
      storedHash: `"${user.password_hash}"`,
    });

    // Verify the password using bcrypt
    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    // --- End of Enhanced Logging ---

    logger.debug(LogComponent.AUTH, "Password validation result", {
      username,
      isValid: passwordValid,
    });

    if (!passwordValid) {
      logger.warn(LogComponent.AUTH, "Invalid password comparison result", {
        username,
        hashType: user.password_hash.substring(0, 4),
      });
      return null;
    }

    logger.info(LogComponent.AUTH, "User validated successfully", {
      username,
      userId: user.id,
      isAdmin: user.is_admin,
      hasChangedPassword: user.has_changed_password,
    });

    return {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
      has_changed_password: user.has_changed_password,
    };
  } catch (error) {
    // Log the actual error object and its stack trace
    logger.error(
      LogComponent.AUTH,
      "Error caught during user validation process", // More specific message
      error instanceof Error ? error : new Error(String(error)), // Pass the error object itself
      {
        username,
        // Add stack trace if available
        stack: error instanceof Error ? error.stack : "N/A",
      }
    );
    return null;
  }
}

// Add a new function to verify Steam credentials
export function verifyUserSteamCredentials(
  username: string,
  steamId: string,
  steamApiKey: string
): boolean {
  // Load config WITH decryption
  const config = loadConfig(true);
  const user = config.users[username];

  // Check if user and stored credentials exist
  if (!user || !user.steam_id || !user.steam_api_key) {
    return false;
  }

  // Use standard string comparison against decrypted values
  return steamId === user.steam_id && steamApiKey === user.steam_api_key;
}
