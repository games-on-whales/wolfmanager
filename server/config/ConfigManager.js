import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = '/config/wolf-manager.json';

export class ConfigManager {
  static instance;
  config;

  constructor() {
    this.config = {
      steamId: '',
      libraryPath: '',
      steamApiKey: '',
      steamGridDbApiKey: ''
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

  getConfig() {
    return this.config;
  }

  getSteamApiKey() {
    return this.config.steamApiKey;
  }

  getSteamGridDbApiKey() {
    return this.config.steamGridDbApiKey;
  }
} 