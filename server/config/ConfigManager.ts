import fs from 'fs/promises';
import path from 'path';
import { Config, UserConfig } from '../../src/types/config';

const CONFIG_PATH = '/config/wolf-manager.json';
const LOG_PATH = '/config/logs/wolf-manager.log';

function writeLog(level: string, message: string, component = 'ConfigManager', data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    data
  };

  try {
    fs.appendFile(LOG_PATH, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = {
      libraryPath: '',
      usersPath: '/config/users',
      cachePath: '/config/cache/artwork',
      steamGridDbApiKey: '',
      debugEnabled: false,
      users: {},
      currentUser: undefined
    };
    writeLog('debug', 'ConfigManager initialized');
  }

  static async getInstance(): Promise<ConfigManager> {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
      await ConfigManager.instance.loadConfig();
    }
    return ConfigManager.instance;
  }

  private async loadConfig(): Promise<void> {
    try {
      writeLog('debug', 'Loading config...');
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
      this.config = JSON.parse(configData);
      writeLog('info', 'Config loaded successfully');
    } catch (error) {
      // If file doesn't exist, we'll use default config
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        writeLog('error', 'Error loading config', 'ConfigManager', error);
      }
    }
  }

  getConfig(): Config {
    return this.config;
  }

  getCurrentUser(): (UserConfig & { username: string }) | null {
    if (!this.config.currentUser || !this.config.users[this.config.currentUser]) {
      return null;
    }
    return {
      username: this.config.currentUser,
      ...this.config.users[this.config.currentUser]
    };
  }

  async saveConfig(config: Config): Promise<void> {
    try {
      writeLog('debug', 'Saving config...');
      await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
      this.config = config;
      writeLog('info', 'Config saved successfully');
    } catch (error) {
      writeLog('error', 'Failed to save configuration', 'ConfigManager', error);
      throw new Error('Failed to save configuration');
    }
  }

  async addUser(username: string, userConfig: UserConfig): Promise<boolean> {
    try {
      writeLog('debug', 'Adding user', 'ConfigManager', { username });
      // Ensure users object exists
      if (!this.config.users) {
        this.config.users = {};
      }

      // Create user directory
      const userPath = path.join(this.config.usersPath, username);
      await fs.mkdir(userPath, { recursive: true });

      // Add user config
      this.config.users[username] = userConfig;
      await this.saveConfig(this.config);

      writeLog('info', 'User added successfully', 'ConfigManager', { username });
      return true;
    } catch (error) {
      writeLog('error', 'Error adding user', 'ConfigManager', { username, error });
      throw new Error('Failed to add user');
    }
  }

  async deleteUser(username: string): Promise<boolean> {
    try {
      writeLog('debug', 'Deleting user', 'ConfigManager', { username });
      // Ensure users object exists
      if (!this.config.users) {
        this.config.users = {};
        return true;
      }

      // Remove user directory
      const userPath = path.join(this.config.usersPath, username);
      await fs.rm(userPath, { recursive: true, force: true });

      // Remove user config
      delete this.config.users[username];
      if (this.config.currentUser === username) {
        this.config.currentUser = undefined;
      }
      await this.saveConfig(this.config);

      writeLog('info', 'User deleted successfully', 'ConfigManager', { username });
      return true;
    } catch (error) {
      writeLog('error', 'Error deleting user', 'ConfigManager', { username, error });
      throw new Error('Failed to delete user');
    }
  }
} 