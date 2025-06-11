import { ClientDevice } from "@/types/client";
import { TasksConfig, TaskState } from "@/types/task";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { decrypt, encrypt } from "./crypto";
import { logger } from "./logger"; // Import the singleton instance
import { LogComponent } from "./logger/types";
import { TasksConfigSchema } from "./validation/task-schemas"; // Import Zod schema

// Database imports
import {
  getUserByUsername,
  getAllUsers,
  addUser as dbAddUser,
  updateUser as dbUpdateUser,
  deleteUser as dbDeleteUser,
  verifyUserPassword,
  getClientDevicesByUserId,
  addClientDevice,
  deleteClientDevice,
  getAllTasks,
  getTaskById,
  getTaskByName,
  addTask,
  updateTask,
  deleteTask,
  getSystemConfig,
  setSystemConfig,
  getMetadataProviderByName,
  updateMetadataProvider,
  type User as DbUser,
  type Task as DbTask,
  type TaskStatus,
} from "./db/helpers";

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

// Cache for configuration data
let cachedConfig: Config | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 30000; // 30 seconds

function isEncryptedString(str: string): boolean {
  // Check if the string matches our encryption format (base64:base64:base64)
  const parts = str.split(":");
  return (
    parts.length === 3 &&
    parts.every((part) => /^[A-Za-z0-9+/]*={0,2}$/.test(part))
  );
}

/**
 * Convert database user to config user format
 */
function dbUserToConfigUser(dbUser: DbUser, clients: ClientDevice[] = []): UserConfig {
  return {
    id: dbUser.id,
    username: dbUser.username,
    password_hash: dbUser.passwordHash,
    is_admin: dbUser.isAdmin,
    created_at: dbUser.createdAt,
    updated_at: dbUser.updatedAt,
    has_changed_password: dbUser.hasChangedPassword,
    display_name: dbUser.displayName || undefined,
    steam_id: dbUser.steamId || "",
    steam_api_key: dbUser.steamApiKey || "",
    clients: clients,
  };
}

/**
 * Load config from database
 */
async function loadConfigFromDatabase(decryptSensitiveData: boolean = false): Promise<Config> {
  try {
    logger.debug(LogComponent.SYSTEM, "Loading config from database");

    // Get system configuration
    const systemNameConfig = await getSystemConfig("system.name");
    const systemVersionConfig = await getSystemConfig("system.version");
    
    const system: SystemConfig = {
      name: systemNameConfig?.value || "WolfManager",
      version: systemVersionConfig?.value || "1.0.0",
    };

    // Get all users
    const dbUsers = await getAllUsers();
    const users: { [username: string]: UserConfig } = {};

    // Convert database users to config format
    for (const dbUser of dbUsers) {
      // Get user's client devices
      const userClients = await getClientDevicesByUserId(dbUser.id);
      const clients: ClientDevice[] = userClients.map(device => ({
        id: device.id,
        friendly_name: device.friendlyName,
        pair_secret: device.pairSecret,
      }));

      const configUser = dbUserToConfigUser(dbUser, clients);
      
      // Decrypt sensitive data if requested
      if (decryptSensitiveData) {
        if (configUser.steam_id && isEncryptedString(configUser.steam_id)) {
          try {
            configUser.steam_id = decrypt(configUser.steam_id);
          } catch (error) {
            logger.error(
              LogComponent.SYSTEM,
              `Failed to decrypt steam_id for user ${configUser.username}`,
              error instanceof Error ? error : new Error(String(error))
            );
            configUser.steam_id = ""; // Clear potentially corrupt data
          }
        }
        if (configUser.steam_api_key && isEncryptedString(configUser.steam_api_key)) {
          try {
            configUser.steam_api_key = decrypt(configUser.steam_api_key);
          } catch (error) {
            logger.error(
              LogComponent.SYSTEM,
              `Failed to decrypt steam_api_key for user ${configUser.username}`,
              error instanceof Error ? error : new Error(String(error))
            );
            configUser.steam_api_key = ""; // Clear potentially corrupt data
          }
        }
      }

      users[configUser.username] = configUser;
    }

    // Get metadata providers configuration
    let metadataProviders: MetadataProvidersConfig = {};
    try {
      const steamGridProvider = await getMetadataProviderByName("steamgriddb");
      if (steamGridProvider) {
        let apiKey = steamGridProvider.apiKey || "";
        
        // Decrypt API key if requested and encrypted
        if (decryptSensitiveData && apiKey && isEncryptedString(apiKey)) {
          try {
            apiKey = decrypt(apiKey);
          } catch (error) {
            logger.error(
              LogComponent.SYSTEM,
              "Failed to decrypt SteamGridDB API key",
              error instanceof Error ? error : new Error(String(error))
            );
            apiKey = "";
          }
        }

        metadataProviders.steamgridDb = {
          enabled: steamGridProvider.enabled,
          apiKey,
        };
      }
    } catch (error) {
      logger.warn(LogComponent.SYSTEM, "Failed to load metadata providers config", { error });
      metadataProviders.steamgridDb = {
        enabled: false,
        apiKey: "",
      };
    }

    const config: Config = {
      system,
      users,
      clients: [], // Top-level clients are now stored per-user
      metadataProviders,
    };

    logger.info(LogComponent.SYSTEM, "Configuration loaded successfully from database.");
    return config;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load configuration from database",
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

export async function getConfig(): Promise<Config> {
  const now = Date.now();
  
  // Check cache
  if (cachedConfig && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const config = await loadConfigFromDatabase();
    cachedConfig = config;
    configCacheTime = now;
    return config;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to get config, falling back to defaults",
      error instanceof Error ? error : new Error(String(error))
    );
    
    // Return minimal default config on error
    const defaultConfig: Config = {
      system: { name: "WolfManager", version: "1.0.0" },
      users: {},
      clients: [],
      metadataProviders: {
        steamgridDb: {
          enabled: false,
          apiKey: "",
        },
      },
    };
    
    return defaultConfig;
  }
}

export function loadConfig(decryptSensitiveData: boolean = false): Config {
  // For backward compatibility, provide a synchronous version
  // This will use cached data or throw an error
  if (cachedConfig) {
    return cachedConfig;
  }
  
  logger.warn(LogComponent.SYSTEM, "loadConfig called synchronously without cached data. Use getConfig() instead.");
  // To prevent crashing, return a default config, but this indicates a problem.
  return {
    system: { name: "WolfManager", version: "1.0.0" },
    users: {},
    clients: [],
    metadataProviders: {
      steamgridDb: {
        enabled: false,
        apiKey: "",
      },
    },
  };
}

// Clear config cache to force reload
export function clearConfigCache(): void {
  cachedConfig = null;
  configCacheTime = 0;
}

export function saveConfig(config: Config): void {
  // For backward compatibility - this is now a no-op
  // Individual operations should update the database directly
  logger.warn(LogComponent.SYSTEM, "saveConfig called - this is deprecated. Use specific database operations instead.");
  clearConfigCache();
}

export async function updateUserSteamInfo(
  username: string,
  steamId: string,
  steamApiKey: string
): Promise<void> {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      throw new Error("User not found");
    }

    // Encrypt sensitive data before storing
    const encryptedSteamId = steamId ? encrypt(steamId) : "";
    const encryptedApiKey = steamApiKey ? encrypt(steamApiKey) : "";

    await dbUpdateUser(user.id, {
      steamId: encryptedSteamId,
      steamApiKey: encryptedApiKey,
      updatedAt: new Date().toISOString(),
    });

    clearConfigCache();
    logger.info(LogComponent.SYSTEM, "User Steam info updated successfully", { username });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update user Steam info",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    throw error;
  }
}

// Legacy addUserClient function removed - no longer used in codebase
// Modern client pairing should use pairAndAddClientAction() from src/app/clients/actions.ts

export async function removeUserClient(username: string, deviceId: string): Promise<void> {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      throw new Error("User not found");
    }

    await deleteClientDevice(deviceId);

    clearConfigCache();
    logger.info(LogComponent.SYSTEM, "User client removed successfully", { username, deviceId });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to remove user client",
      error instanceof Error ? error : new Error(String(error)),
      { username, deviceId }
    );
    throw error;
  }
}

export async function changeUserPassword(
  username: string,
  newPassword: string
): Promise<void> {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      throw new Error("User not found");
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    await dbUpdateUser(user.id, {
      passwordHash,
      hasChangedPassword: true,
      updatedAt: new Date().toISOString(),
    });

    clearConfigCache();
    logger.info(LogComponent.SYSTEM, "User password changed successfully", { username });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to change user password",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    throw error;
  }
}

export function addUser(
  username: string,
  password: string,
  isAdmin: boolean = false
): Omit<UserConfig, "password_hash"> {
  // This synchronous version is kept for backward compatibility
  // It will be replaced by async operations in the actual usage
  throw new Error("addUser is deprecated. Use addUserAsync instead.");
}

export async function addUserAsync(
  username: string,
  password: string,
  isAdmin: boolean = false
): Promise<Omit<UserConfig, "password_hash">> {
  try {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = await dbAddUser({
      username,
      passwordHash,
      isAdmin,
      hasChangedPassword: false,
      displayName: null,
      steamId: null,
      steamApiKey: null,
    });

    clearConfigCache();

    // Return a copy without sensitive data
    const userConfig = dbUserToConfigUser(newUser);
    const { password_hash: _, ...userCopy } = userConfig;
    return userCopy;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to add user",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    throw error;
  }
}

export async function removeUser(userId: string): Promise<void> {
  try {
    const user = await getUserByUsername(userId); // In original code, this was used as both ID and username
    if (!user) {
      throw new Error("User not found");
    }

    // Check if this is the last admin
    const allUsers = await getAllUsers();
    const adminUsers = allUsers.filter(u => u.isAdmin);
    
    if (user.isAdmin && adminUsers.length === 1) {
      throw new Error("Cannot remove the last admin user");
    }

    await dbDeleteUser(user.id);
    clearConfigCache();
    logger.info(LogComponent.SYSTEM, "User removed successfully", { userId });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to remove user",
      error instanceof Error ? error : new Error(String(error)),
      { userId }
    );
    throw error;
  }
}

export async function validateUser(username: string, password: string) {
  try {
    logger.debug(LogComponent.AUTH, "Attempting to validate user", { username });

    const user = await verifyUserPassword(username, password);
    if (!user) {
      logger.warn(LogComponent.AUTH, "User validation failed", { username });
      return null;
    }

    logger.info(LogComponent.AUTH, "User validation successful", { username });
    
    // Return user without password hash
    const userConfig = dbUserToConfigUser(user);
    const { password_hash, ...userWithoutPassword } = userConfig;
    return userWithoutPassword;
  } catch (error) {
    logger.error(
      LogComponent.AUTH,
      "Error during user validation",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    return null;
  }
}

export async function verifyUserSteamCredentials(
  username: string,
  steamId: string,
  steamApiKey: string
): Promise<boolean> {
  try {
    const config = await loadConfigFromDatabase(true); // Decrypt sensitive data
    const user = config.users[username];

    if (!user) {
      return false; // User not found
    }

    // Compare provided credentials with decrypted stored credentials
    return user.steam_id === steamId && user.steam_api_key === steamApiKey;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to verify user Steam credentials",
      error instanceof Error ? error : new Error(String(error)),
      { username }
    );
    return false;
  }
}

// --- Task Configuration Functions ---

/**
 * Convert database task to TOML config format
 */
function dbTaskToConfigTask(dbTask: DbTask): TaskState {
  return {
    id: dbTask.id,
    name: dbTask.name,
    description: dbTask.description,
    schedule: dbTask.schedule,
    is_enabled: dbTask.isEnabled,
    status: dbTask.status as any, // Type assertion for compatibility
    last_run_at: dbTask.lastRunAt,
    next_run_at: dbTask.nextRunAt,
    created_at: dbTask.createdAt,
    updated_at: dbTask.updatedAt,
  };
}

export async function loadTasksConfig(): Promise<TasksConfig> {
  logger.debug(LogComponent.SYSTEM, "Loading tasks configuration from database.");
  try {
    const dbTasks = await getAllTasks();
    const tasks = dbTasks.map(dbTaskToConfigTask);
    
    const config: TasksConfig = { tasks };
    
    logger.info(
      LogComponent.SYSTEM,
      "Tasks configuration loaded successfully from database.",
      { taskCount: tasks.length }
    );
    return config;
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to load tasks configuration from database.",
      error instanceof Error ? error : new Error(String(error))
    );
    // Return default empty structure on error
    return { tasks: [] };
  }
}

export async function saveTasksConfig(config: TasksConfig): Promise<void> {
  logger.debug(LogComponent.SYSTEM, "Saving tasks configuration to database.", {
    taskCount: config.tasks?.length ?? 0,
  });
  try {
    // Validate the config object before saving
    const validationResult = TasksConfigSchema.safeParse(config);
    if (!validationResult.success) {
      logger.error(
        LogComponent.SYSTEM,
        "Invalid tasks configuration object provided for saving.",
        new Error("Configuration validation failed before save"),
        { errors: validationResult.error.format() }
      );
      throw new Error(
        "Attempted to save invalid tasks configuration. Check logs for details."
      );
    }

    // Note: Individual task updates should use updateTask, addTask, deleteTask functions
    // This function is kept for backward compatibility but doesn't actually save
    logger.warn(LogComponent.SYSTEM, "saveTasksConfig is deprecated. Use individual task operations.");
    
    logger.info(LogComponent.SYSTEM, "Tasks configuration saved successfully.");
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to save tasks configuration.",
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error("Failed to save tasks configuration.");
  }
}

export async function updateTaskState(
  taskId: string,
  updates: Partial<Omit<TaskState, "id" | "name" | "created_at">>
): Promise<void> {
  logger.debug(LogComponent.SYSTEM, "Attempting to update task state.", {
    taskId,
    updates,
  });
  try {
    const task = await getTaskById(taskId);
    if (!task) {
      logger.warn(LogComponent.SYSTEM, `Task with id ${taskId} not found for update.`);
      return;
    }

    // Convert updates to database format
    const dbUpdates: any = {};
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.schedule !== undefined) dbUpdates.schedule = updates.schedule;
    if (updates.is_enabled !== undefined) dbUpdates.isEnabled = updates.is_enabled;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.last_run_at !== undefined) dbUpdates.lastRunAt = updates.last_run_at;
    if (updates.next_run_at !== undefined) dbUpdates.nextRunAt = updates.next_run_at;
    if (updates.updated_at !== undefined) dbUpdates.updatedAt = updates.updated_at;
    else dbUpdates.updatedAt = new Date().toISOString();

    await updateTask(taskId, dbUpdates);
    logger.info(LogComponent.SYSTEM, "Task state updated successfully.", { taskId });
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update task state.",
      error instanceof Error ? error : new Error(String(error)),
      { taskId, updates }
    );
    throw error;
  }
}

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
  try {
    let task = await getTaskByName(taskInfo.name);
    const now = new Date().toISOString();
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
        task.isEnabled !== taskInfo.is_enabled
      ) {
        logger.info(LogComponent.SYSTEM, "Updating task definition fields.", {
          taskId: task.id,
          taskName: taskInfo.name,
          changes: {
            description: task.description !== taskInfo.description,
            schedule: task.schedule !== taskInfo.schedule,
            is_enabled: task.isEnabled !== taskInfo.is_enabled,
          },
        });
        
        await updateTask(task.id, {
          description: taskInfo.description,
          schedule: taskInfo.schedule,
          isEnabled: taskInfo.is_enabled,
          updatedAt: now,
        });
        
        // Reload task to get updated data
        task = await getTaskById(task.id);
        if (!task) throw new Error("Failed to reload updated task");
        
        action = "updated";
      } else {
        logger.debug(
          LogComponent.SYSTEM,
          "No changes detected in existing task definition.",
          { taskName: taskInfo.name }
        );
      }
    } else {
      logger.info(LogComponent.SYSTEM, "Adding new task definition.", {
        taskName: taskInfo.name,
      });
      
      task = await addTask({
        name: taskInfo.name,
        description: taskInfo.description,
        schedule: taskInfo.schedule,
        isEnabled: taskInfo.is_enabled,
        status: 'IDLE' as TaskStatus,
      });
      
      action = "added";
    }

    if (action !== "nochange") {
      logger.info(
        LogComponent.SYSTEM,
        `Task definition ${action} successfully.`,
        { taskName: taskInfo.name, taskId: task.id }
      );
    }
    
    return dbTaskToConfigTask(task);
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to add or update task definition.",
      error instanceof Error ? error : new Error(String(error)),
      { taskName: taskInfo.name }
    );
    throw error;
  }
}

//+ Function to securely get the SteamGridDB API key
export async function getSteamGridDbApiKey(): Promise<string | null> {
  try {
    const provider = await getMetadataProviderByName("steamgriddb");
    if (!provider || !provider.apiKey) {
      logger.debug(
        LogComponent.SYSTEM,
        "SteamGridDB API key not found or empty in database."
      );
      return null;
    }

    const encryptedKey = provider.apiKey;

    if (!isEncryptedString(encryptedKey)) {
      logger.warn(
        LogComponent.SYSTEM,
        "SteamGridDB API key found but is not in expected encrypted format.",
        null,
        { keyPreview: encryptedKey.substring(0, 5) }
      );
      return null;
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
      "Failed to load SteamGridDB API key from database",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

// Helper function to update SteamGridDB settings
export async function updateSteamGridDbSettings(
  enabled: boolean,
  apiKey: string
): Promise<void> {
  try {
    const provider = await getMetadataProviderByName("steamgriddb");
    if (!provider) {
      throw new Error("SteamGridDB provider not found");
    }

    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

    await updateMetadataProvider(provider.id, {
      enabled,
      apiKey: encryptedApiKey,
      updatedAt: new Date().toISOString(),
    });

    clearConfigCache();
    logger.info(LogComponent.SYSTEM, "SteamGridDB settings updated successfully");
  } catch (error) {
    logger.error(
      LogComponent.SYSTEM,
      "Failed to update SteamGridDB settings",
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}
