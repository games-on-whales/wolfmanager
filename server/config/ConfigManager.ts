import fs from 'fs/promises';
import path from 'path';
import { Config } from '../../src/types/config';

const CONFIG_PATH = '/config/wolf-manager.json';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = {
      steamId: '',
      libraryPath: '',
      steamApiKey: '',
      steamGridDbApiKey: ''
    };
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
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // If file doesn't exist, we'll use default config
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error loading config:', error);
      }
    }
  }

  async saveConfig(config: Config): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      console.error('Error saving config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  getConfig(): Omit<Config, 'steamApiKey' | 'steamGridDbApiKey'> {
    // Return non-sensitive config data
    const { steamApiKey, steamGridDbApiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  getSteamApiKey(): string {
    return this.config.steamApiKey;
  }

  getSteamGridDbApiKey(): string {
    return this.config.steamGridDbApiKey;
  }
} 