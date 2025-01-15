import { Config, UserConfig } from './types';
import { handleApiResponse, handleApiError, ApiError } from '../base';
import Logger from '../logs';

class ConfigService {
  private config: Config | null = null;
  private isInitialized = false;

  constructor() {
    this.loadConfig().catch(error => {
      Logger.error('Failed to load initial config', error, 'ConfigService');
    });
  }

  async loadConfig(): Promise<void> {
    try {
      Logger.debug('Loading config...', 'ConfigService');
      const response = await fetch('/api/config');
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      this.isInitialized = true;
      Logger.debug('Config loaded successfully', 'ConfigService', this.config);
    } catch (error) {
      this.isInitialized = false;
      await handleApiError(error, 'ConfigService');
    }
  }

  getConfig(): Config {
    if (!this.isInitialized || !this.config) {
      throw new Error('Config not initialized');
    }
    return this.config;
  }

  async saveConfig(config: Config): Promise<void> {
    try {
      Logger.debug('Saving config...', 'ConfigService', config);
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('Config saved successfully', 'ConfigService');
    } catch (error) {
      await handleApiError(error, 'ConfigService');
    }
  }

  async addUser(username: string, steamId: string, steamApiKey: string): Promise<void> {
    try {
      Logger.debug('Adding user...', 'ConfigService', { username });
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, steamId, steamApiKey })
      });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User added successfully', 'ConfigService', { username });
    } catch (error) {
      await handleApiError(error, 'ConfigService');
    }
  }

  async deleteUser(username: string): Promise<void> {
    try {
      Logger.debug('Deleting user...', 'ConfigService', { username });
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: 'DELETE'
      });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User deleted successfully', 'ConfigService', { username });
    } catch (error) {
      await handleApiError(error, 'ConfigService');
    }
  }

  async selectUser(username: string): Promise<void> {
    try {
      Logger.debug('Selecting user...', 'ConfigService', { username });
      const response = await fetch(`/api/users/${encodeURIComponent(username)}/select`, {
        method: 'POST'
      });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User selected successfully', 'ConfigService', { username });
    } catch (error) {
      await handleApiError(error, 'ConfigService');
    }
  }

  getCurrentUser(): UserConfig | null {
    if (!this.config?.currentUser) {
      return null;
    }
    return this.config.users[this.config.currentUser] || null;
  }
}

export default new ConfigService(); 