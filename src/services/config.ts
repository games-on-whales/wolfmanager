import { User } from "@/types/auth";
import TOML from "@iarna/toml";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

interface SystemConfig {
  name: string;
  version: string;
}

interface UserConfig {
  id: string;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface Config {
  system: SystemConfig;
  users: { [key: string]: UserConfig };
}

function isValidConfig(config: unknown): config is Config {
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

class ConfigService {
  private config: Config | null = null;
  private configPath: string;

  constructor() {
    // In Next.js, we need to use the absolute path from the project root
    this.configPath = path.join(process.cwd(), "config", "default.toml");
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configFile = fs.readFileSync(this.configPath, "utf-8");
      const parsedConfig = TOML.parse(configFile);

      if (!isValidConfig(parsedConfig)) {
        throw new Error("Invalid configuration structure");
      }

      this.config = parsedConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // If the file doesn't exist, create it with default settings
        this.config = {
          system: {
            name: "WolfUI",
            version: "1.0.0",
          },
          users: {
            admin: {
              id: "1",
              username: "admin",
              // Default password is "admin"
              password_hash:
                "$2b$10$ng5ABJwbJB8PV8Oi/YAHe.zXfBF0ZQOUwP8VJZpD0MSYFHjqqx1Iq",
              is_admin: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
        };
        this.saveConfig();
      } else {
        console.error("Error loading config:", error);
        throw new Error("Failed to load configuration");
      }
    }
  }

  private saveConfig(): void {
    if (!this.config) throw new Error("Config not loaded");

    try {
      const configString = TOML.stringify(
        this.config as unknown as TOML.JsonMap
      );
      fs.writeFileSync(this.configPath, configString, "utf-8");
    } catch (error) {
      console.error("Error saving config:", error);
      throw new Error("Failed to save configuration");
    }
  }

  getUsers(): User[] {
    if (!this.config) this.loadConfig();

    return Object.values(this.config!.users).map((user) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    }));
  }

  addUser(username: string, password: string, isAdmin: boolean): User {
    if (!this.config) this.loadConfig();

    // Check if username already exists
    if (this.config!.users[username]) {
      throw new Error("Username already exists");
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const now = new Date().toISOString();
    const newUser: UserConfig = {
      id: String(Object.keys(this.config!.users).length + 1),
      username,
      password_hash: passwordHash,
      is_admin: isAdmin,
      created_at: now,
      updated_at: now,
    };

    this.config!.users[username] = newUser;
    this.saveConfig();

    return {
      id: newUser.id,
      username: newUser.username,
      isAdmin: newUser.is_admin,
      createdAt: new Date(newUser.created_at),
      updatedAt: new Date(newUser.updated_at),
    };
  }

  removeUser(userId: string): void {
    if (!this.config) this.loadConfig();

    const userToRemove = Object.entries(this.config!.users).find(
      ([_, user]) => user.id === userId
    );

    if (!userToRemove) {
      throw new Error("User not found");
    }

    const [username, user] = userToRemove;

    // Prevent removal of admin user
    if (username === "admin") {
      throw new Error("Cannot remove admin user");
    }

    delete this.config!.users[username];
    this.saveConfig();
  }

  validateUser(username: string, password: string): User {
    if (!this.config) this.loadConfig();

    const user = this.config!.users[username];
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };
  }
}

// Export a singleton instance
export const configService = new ConfigService();
