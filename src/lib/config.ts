import { ClientDevice } from "@/types/client";
import { TasksConfig, TaskState } from "@/types/task";
import iarnaTOML from "@iarna/toml";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import TOML from "toml";
import { decrypt, encrypt } from "./crypto";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types";
import { TasksConfigSchema } from "./validation/task-schemas"; // Import Zod schema

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

//+ Add interface for SteamGridDB settings
export interface SteamGridDbConfig {
  enabled: boolean;
  apiKey: string; // Sensitive
}

//+ Add interface for metadata providers container
export interface MetadataProvidersConfig {
  steamgridDb?: SteamGridDbConfig;
}

export interface Config {
  system: SystemConfig;
  users: { [username: string]: UserConfig };
  clients: ClientDevice[];
  metadataProviders?: MetadataProvidersConfig; //+ Add optional metadata providers
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
    c.users === null ||
    //+ Add check for optional metadataProviders structure if it exists
    (c.metadataProviders !== undefined &&
      typeof c.metadataProviders !== "object") ||
    (c.metadataProviders?.steamgridDb !== undefined &&
      (typeof c.metadataProviders.steamgridDb !== "object" ||
        c.metadataProviders.steamgridDb === null ||
        typeof c.metadataProviders.steamgridDb.enabled !== "boolean" ||
        typeof c.metadataProviders.steamgridDb.apiKey !== "string"))
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
const TASKS_CONFIG_PATH = path.resolve(process.cwd(), "config/tasks.toml"); // Define tasks config path

// Ensure config directory exists
if (!fs.existsSync(path.dirname(configPath))) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}
// Ensure tasks config directory exists (might be the same, but good practice)
if (!fs.existsSync(path.dirname(TASKS_CONFIG_PATH))) {
  fs.mkdirSync(path.dirname(TASKS_CONFIG_PATH), { recursive: true });
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
  const configFile = await fsPromises.readFile(configPath, {
    encoding: "utf-8",
  });
  const config = TOML.parse(configFile) as unknown as Config;

  cachedConfig = config;
  return config;
}

// Use the imported singleton logger instance directly

export function loadConfig(decryptSensitiveData: boolean = false): Config {
  try {
    logger.debug(LogComponent.SYSTEM, "Reading config file", { configPath });
    const configFile = fs.readFileSync(configPath, "utf-8");
    logger.debug(LogComponent.SYSTEM, "Parsing config file");
    const parsedConfig = TOML.parse(configFile) as unknown as Config;
    logger.debug(LogComponent.SYSTEM, "Parsed config object", {
      configStructure: {
        hasSystem: typeof parsedConfig.system === "object",
        hasUsers: typeof parsedConfig.users === "object",
        hasClients: typeof parsedConfig.clients === "object",
        hasMetadataProviders:
          typeof parsedConfig.metadataProviders === "object", //+ Log presence of new section
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

      //+ Decrypt SteamGridDB API key if requested and present
      if (
        decryptSensitiveData &&
        parsedConfig.metadataProviders?.steamgridDb?.apiKey &&
        isEncryptedString(parsedConfig.metadataProviders.steamgridDb.apiKey)
      ) {
        try {
          parsedConfig.metadataProviders.steamgridDb.apiKey = decrypt(
            parsedConfig.metadataProviders.steamgridDb.apiKey
          );
        } catch (error) {
          logger.error(
            LogComponent.SYSTEM,
            `Failed to decrypt steamgridDb.apiKey`,
            error instanceof Error ? error : new Error(String(error))
          );
          // Clear potentially corrupt data
          if (parsedConfig.metadataProviders?.steamgridDb) {
            parsedConfig.metadataProviders.steamgridDb.apiKey = "";
          }
        }
      }
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
        system: { name: "WolfManager", version: "1.0.0" },
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
        //+ Add default metadataProviders section
        metadataProviders: {
          steamgridDb: {
            enabled: false,
            apiKey: "",
          },
        },
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
      //+ Include metadataProviders in the encrypted config
      metadataProviders: config.metadataProviders
        ? {
            ...config.metadataProviders,
            //+ Encrypt steamgridDb apiKey if present and not already encrypted
            steamgridDb: config.metadataProviders.steamgridDb
              ? {
                  ...config.metadataProviders.steamgridDb,
                  apiKey:
                    config.metadataProviders.steamgridDb.apiKey &&
                    config.metadataProviders.steamgridDb.apiKey.length > 0 &&
                    !isEncryptedString(
                      config.metadataProviders.steamgridDb.apiKey
                    )
                      ? encrypt(config.metadataProviders.steamgridDb.apiKey)
                      : config.metadataProviders.steamgridDb.apiKey,
                }
              : undefined,
          }
        : undefined,
    };

    logger.debug(
      LogComponent.SYSTEM,
      "Stringifying configuration for saving.",
      { configPath }
    );
    const configString = iarnaTOML.stringify(encryptedConfig as any);
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

    const isMatch = bcrypt.compareSync(password, user.password_hash);

    if (isMatch) {
      logger.info(LogComponent.AUTH, "User validation successful", {
        username,
      });
      // Return a copy of the user object without the password hash
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } else {
      logger.warn(
        LogComponent.AUTH,
        "User validation failed (password mismatch)",
        {
          username,
        }
      );
      return null;
    }
  } catch (error) {
    logger.error(
      LogComponent.AUTH,
      "Error during user validation",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    return null; // Return null on any error during validation
  }
}

export function verifyUserSteamCredentials(
  username: string,
  steamId: string,
  steamApiKey: string
): boolean {
  const config = loadConfig(true); // Decrypt sensitive data
  const user = config.users[username];

  if (!user) {
    return false; // User not found
  }

  // Compare provided credentials with decrypted stored credentials
  return user.steam_id === steamId && user.steam_api_key === steamApiKey;
}

// --- Task Configuration Functions ---

// [ ] TODO: Consider adding a simple file lock mechanism here if concurrent writes are expected
// E.g., using a library like 'proper-lockfile'

export async function loadTasksConfig(): Promise<TasksConfig> {
  logger.debug(LogComponent.SYSTEM, "Attempting to load tasks configuration.", {
    path: TASKS_CONFIG_PATH,
  });
  try {
    const fileContent = await fsPromises.readFile(TASKS_CONFIG_PATH, {
      encoding: "utf-8",
    });
    const rawParsed = TOML.parse(fileContent);
    // Validate the parsed TOML content
    const validationResult = TasksConfigSchema.safeParse(rawParsed);

    if (!validationResult.success) {
      logger.error(
        LogComponent.SYSTEM,
        "Invalid tasks configuration structure after parsing TOML.",
        new Error("TOML validation failed"),
        { path: TASKS_CONFIG_PATH, errors: validationResult.error.format() }
      );
      // Return default empty structure on validation failure to prevent crashes downstream
      return { tasks: [] };
    }

    // Use the validated data
    const validatedConfig = validationResult.data;
    logger.info(
      LogComponent.SYSTEM,
      "Tasks configuration loaded and validated successfully.",
      { path: TASKS_CONFIG_PATH, taskCount: validatedConfig.tasks?.length ?? 0 }
    );
    return validatedConfig;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      logger.warn(
        LogComponent.SYSTEM,
        "Tasks config file not found, returning default empty structure.",
        { path: TASKS_CONFIG_PATH }
      );
      return { tasks: [] };
    }
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load tasks configuration.",
      error instanceof Error ? error : new Error(String(error)),
      { path: TASKS_CONFIG_PATH }
    );
    throw new Error("Failed to load tasks configuration.");
  }
}

export async function saveTasksConfig(config: TasksConfig): Promise<void> {
  logger.debug(LogComponent.SYSTEM, "Attempting to save tasks configuration.", {
    path: TASKS_CONFIG_PATH,
    taskCount: config.tasks?.length ?? 0,
  });
  try {
    // Validate the config object before saving
    // --- Roo Debug Start ---
    logger.debug(
      LogComponent.SYSTEM,
      `Attempting to write tasks config to: ${TASKS_CONFIG_PATH}`
    );
    // --- Roo Debug End ---
    const validationResult = TasksConfigSchema.safeParse(config);
    if (!validationResult.success) {
      logger.error(
        LogComponent.SYSTEM,
        "Invalid tasks configuration object provided for saving.",
        new Error("Configuration validation failed before save"),
        { path: TASKS_CONFIG_PATH, errors: validationResult.error.format() }
      );
      // Prevent saving invalid data
      throw new Error(
        "Attempted to save invalid tasks configuration. Check logs for details."
      );
    }
    // Use the validated data for stringification
    const tomlString = iarnaTOML.stringify(validationResult.data as any);
    await fsPromises.mkdir(path.dirname(TASKS_CONFIG_PATH), {
      recursive: true,
    }); // Ensure directory exists
    await fsPromises.writeFile(TASKS_CONFIG_PATH, tomlString, {
      encoding: "utf-8",
    });
    logger.info(
      LogComponent.SYSTEM,
      "Tasks configuration saved successfully.",
      { path: TASKS_CONFIG_PATH }
    );
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to save tasks configuration.",
      error instanceof Error ? error : new Error(String(error)),
      { path: TASKS_CONFIG_PATH }
    );
    throw new Error("Failed to save tasks configuration.");
  }
}

// Utility function to update a specific task (handles read-modify-write)
export async function updateTaskState(
  taskId: string,
  updates: Partial<Omit<TaskState, "id" | "name" | "created_at">>
): Promise<void> {
  logger.debug(LogComponent.SYSTEM, "Attempting to update task state.", {
    taskId,
    updates,
  });
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    const taskIndex = config.tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      logger.warn(
        LogComponent.SYSTEM,
        `Task with id ${taskId} not found for update.`
      );
      return;
    }

    const updatedTask = {
      ...config.tasks[taskIndex],
      ...updates,
      updated_at: new Date().toISOString(), // Update timestamp
    };
    config.tasks[taskIndex] = updatedTask;

    // Save the entire config back (which now includes validation)
    await saveTasksConfig(config);
    logger.info(LogComponent.SYSTEM, "Task state updated successfully.", {
      taskId,
    });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update task state.",
      error instanceof Error ? error : new Error(String(error)),
      { taskId, updates }
    );
    throw error;
  } finally {
    // Release lock if implemented
  }
}

// Utility function to add a new task definition or update an existing one by name
export async function addOrUpdateTaskDefinition(
  taskInfo: Omit<
    TaskState,
    | "id"
    | "created_at"
    | "updated_at"
    | "status"
    | "last_run_at"
    | "next_run_at"
  >
): Promise<TaskState> {
  logger.debug(
    LogComponent.SYSTEM,
    "Attempting to add or update task definition.",
    { taskName: taskInfo.name }
  );
  // Acquire lock if implemented
  try {
    const config = await loadTasksConfig();
    let task = config.tasks.find((t) => t.name === taskInfo.name);
    const now = new Date().toISOString();
    let updated = false;
    let action: "added" | "updated" | "nochange" = "nochange";

    if (task) {
      logger.debug(LogComponent.SYSTEM, "Found existing task definition.", {
        taskName: taskInfo.name,
        taskId: task.id,
      });
      // Check if relevant definition fields changed
      if (
        task.description !== taskInfo.description ||
        task.schedule !== taskInfo.schedule ||
        task.is_enabled !== taskInfo.is_enabled
      ) {
        logger.info(LogComponent.SYSTEM, "Updating task definition fields.", {
          taskId: task.id,
          taskName: taskInfo.name,
          changes: {
            description: task.description !== taskInfo.description,
            schedule: task.schedule !== taskInfo.schedule,
            is_enabled: task.is_enabled !== taskInfo.is_enabled,
          },
        });
        task.description = taskInfo.description;
        task.schedule = taskInfo.schedule;
        task.is_enabled = taskInfo.is_enabled;
        task.updated_at = now;
        updated = true;
        action = "updated";
      } else {
        logger.debug(
          LogComponent.SYSTEM,
          "No changes detected in existing task definition.",
          { taskName: taskInfo.name }
        );
      }
    } else {
      const newTaskId = crypto.randomUUID();
      logger.info(LogComponent.SYSTEM, "Adding new task definition.", {
        taskName: taskInfo.name,
        newTaskId,
      });
      task = {
        ...taskInfo,
        id: newTaskId,
        status: "IDLE",
        last_run_at: null,
        next_run_at: null,
        created_at: now,
        updated_at: now,
      };
      config.tasks.push(task);
      updated = true;
      action = "added";
    }

    if (updated) {
      // --- Roo Debug Start ---
      if (action === "added") {
        logger.debug(
          LogComponent.SYSTEM,
          `Calling saveTasksConfig after adding task: ${taskInfo.name}`
        );
      }
      // --- Roo Debug End ---
      // Save the entire config back (which now includes validation)
      await saveTasksConfig(config);
      logger.info(
        LogComponent.SYSTEM,
        `Task definition ${action} and config saved.`,
        { taskName: taskInfo.name, taskId: task.id }
      );
    }
    if (!task)
      throw new Error(
        `Failed to retrieve task object after ${action} operation for ${taskInfo.name}`
      );
    return task;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to add or update task definition.",
      error instanceof Error ? error : new Error(String(error)),
      { taskName: taskInfo.name }
    );
    throw error;
  } finally {
    // Release lock
  }
}

//+ Function to securely get the SteamGridDB API key
export function getSteamGridDbApiKey(): string | null {
  try {
    // Load config WITHOUT decrypting user data, but DO decrypt SGDB key
    const config = loadConfig(false); // Load raw config first

    if (!config.metadataProviders?.steamgridDb?.apiKey) {
      logger.debug(
        LogComponent.SYSTEM,
        "SteamGridDB API key not found or empty in config."
      );
      return null;
    }

    const encryptedKey = config.metadataProviders.steamgridDb.apiKey;

    if (!isEncryptedString(encryptedKey)) {
      // It might be empty or somehow saved unencrypted (shouldn't happen with saveConfig)
      logger.warn(
        LogComponent.SYSTEM,
        "SteamGridDB API key found but is not in expected encrypted format.",
        null,
        { keyPreview: encryptedKey.substring(0, 5) } // Log a small preview for debugging
      );
      // Depending on policy, you might return it or null. Returning null is safer.
      return null; // Or return encryptedKey if you want to allow unencrypted keys temporarily
    }

    try {
      const decryptedKey = decrypt(encryptedKey);
      logger.debug(
        LogComponent.SYSTEM,
        "Successfully decrypted SteamGridDB API key."
      );
      return decryptedKey;
    } catch (error) {
      logger.error(
        LogComponent.SYSTEM,
        "Failed to decrypt SteamGridDB API key",
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load configuration for getting SteamGridDB API key",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
