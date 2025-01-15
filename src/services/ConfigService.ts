import { Config } from '../types/config';
import Logger from './LogService';

export const ConfigService = {
  config: null as Config | null,

  async loadConfig(): Promise<void> {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      this.config = await response.json();
    } catch (error) {
      Logger.error('Failed to load config', error);
      this.config = {
        steamId: '',
        libraryPath: '',
        steamApiKey: '',
        steamGridDbApiKey: ''
      };
    }
  },

  getConfig(): Config {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return this.config;
  },

  async saveConfig(config: Config): Promise<void> {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      this.config = config;
      Logger.info('Config saved successfully');
    } catch (error) {
      Logger.error('Failed to save config', error);
      throw error;
    }
  }
}; 