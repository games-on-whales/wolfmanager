import { Config, UserConfig } from './types';
import { handleApiResponse, handleApiError } from '../base';
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
      Logger.debug('Starting addUser request', 'ConfigService', { username, steamId });
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, steamId, steamApiKey })
      });
      Logger.debug('Received addUser response', 'ConfigService', { status: response.status });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User added successfully', 'ConfigService', { username });
    } catch (error) {
      Logger.error('Failed to add user', error, 'ConfigService');
      await handleApiError(error, 'ConfigService');
    }
  }

  async deleteUser(username: string): Promise<void> {
    try {
      Logger.debug('Starting deleteUser request', 'ConfigService', { username });
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: 'DELETE'
      });
      Logger.debug('Received deleteUser response', 'ConfigService', { status: response.status });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User deleted successfully', 'ConfigService', { username });
    } catch (error) {
      Logger.error('Failed to delete user', error, 'ConfigService');
      await handleApiError(error, 'ConfigService');
    }
  }

  async selectUser(username: string): Promise<void> {
    try {
      Logger.debug('Starting selectUser request', 'ConfigService', { username });
      const response = await fetch(`/api/users/${encodeURIComponent(username)}/select`, {
        method: 'POST'
      });
      Logger.debug('Received selectUser response', 'ConfigService', { status: response.status });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User selected successfully', 'ConfigService', { username });
    } catch (error) {
      Logger.error('Failed to select user', error, 'ConfigService');
      await handleApiError(error, 'ConfigService');
    }
  }

  async editUser(
    username: string, 
    steamId?: string, 
    steamApiKey?: string, 
    clients?: Record<string, { friendlyName: string }>
  ): Promise<void> {
    try {
      Logger.debug('Starting editUser request', 'ConfigService', { 
        username, 
        isUpdatingSteam: steamId !== undefined || steamApiKey !== undefined,
        isUpdatingClients: clients !== undefined
      });

      // Only include fields that are being updated
      const updateData: any = {};
      if (steamId !== undefined) updateData.steamId = steamId;
      if (steamApiKey !== undefined) updateData.steamApiKey = steamApiKey;
      if (clients !== undefined) updateData.clients = clients;

      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      Logger.debug('Received editUser response', 'ConfigService', { status: response.status });
      this.config = await handleApiResponse<Config>(response, 'ConfigService');
      Logger.info('User edited successfully', 'ConfigService', { username });
    } catch (error) {
      Logger.error('Failed to edit user', error, 'ConfigService');
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