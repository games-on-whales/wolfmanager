import { Config, UserConfig } from '../types/config';
import Logger from './LogService';

export const ConfigService = {
  config: null as Config | null,
  isInitialized: false,

  async loadConfig(): Promise<void> {
    try {
      Logger.debug('Loading config...');
      const response = await fetch('/api/config');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch config');
      }
      this.config = await response.json();
      this.isInitialized = true;
      Logger.debug('Config loaded successfully', this.config);
    } catch (error) {
      Logger.error('Failed to load config', error);
      this.config = {
        libraryPath: '',
        usersPath: '/config/users',
        steamGridDbApiKey: '',
        users: {},
        currentUser: undefined
      };
      this.isInitialized = true;
      throw error;
    }
  },

  getConfig(): Config {
    if (!this.isInitialized) {
      Logger.error('Attempting to get config before initialization');
      throw new Error('Config not loaded');
    }
    return this.config as Config;
  },

  getCurrentUser(): (UserConfig & { username: string }) | null {
    if (!this.isInitialized || !this.config?.currentUser || !this.config.users[this.config.currentUser]) {
      return null;
    }
    return {
      username: this.config.currentUser,
      ...this.config.users[this.config.currentUser]
    };
  },

  async saveConfig(config: Config): Promise<void> {
    try {
      Logger.debug('Saving config...');
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save config');
      }

      const savedConfig = await response.json();
      this.config = savedConfig;
      Logger.info('Config saved successfully');
    } catch (error) {
      Logger.error('Failed to save config', error);
      throw error;
    }
  }
}; 