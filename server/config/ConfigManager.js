import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = '/config/wolf-manager.json';

export class ConfigManager {
  static instance;
  config;

  constructor() {
    this.config = {
      libraryPath: '',
      usersPath: '/config/users',
      steamGridDbApiKey: '',
      users: {},
      currentUser: undefined
    };
  }

  static async getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
      await ConfigManager.instance.loadConfig();
    }
    return ConfigManager.instance;
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // If file doesn't exist, we'll use default config
      if (error.code !== 'ENOENT') {
        console.error('Error loading config:', error);
      }
    }
  }

  async saveConfig(config) {
    try {
      await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      console.error('Error saving config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  async addUser(username, userConfig) {
    try {
      // Create user directory
      const userPath = path.join(this.config.usersPath, username);
      await fs.mkdir(userPath, { recursive: true });

      // Add user config
      this.config.users[username] = userConfig;
      await this.saveConfig(this.config);

      return true;
    } catch (error) {
      console.error('Error adding user:', error);
      throw new Error('Failed to add user');
    }
  }

  async deleteUser(username) {
    try {
      // Remove user directory
      const userPath = path.join(this.config.usersPath, username);
      await fs.rm(userPath, { recursive: true, force: true });

      // Remove user config
      delete this.config.users[username];
      if (this.config.currentUser === username) {
        this.config.currentUser = undefined;
      }
      await this.saveConfig(this.config);

      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  async setCurrentUser(username) {
    if (!this.config.users[username]) {
      throw new Error('User does not exist');
    }
    this.config.currentUser = username;
    await this.saveConfig(this.config);
  }

  getConfig() {
    return this.config;
  }

  getCurrentUser() {
    if (!this.config.currentUser || !this.config.users[this.config.currentUser]) {
      return null;
    }
    return {
      username: this.config.currentUser,
      ...this.config.users[this.config.currentUser]
    };
  }

  getSteamApiKey() {
    const currentUser = this.getCurrentUser();
    return currentUser?.steamApiKey || '';
  }

  getSteamGridDbApiKey() {
    return this.config.steamGridDbApiKey;
  }
} 