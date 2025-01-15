import { Config } from '../types/config';
import Logger from './LogService';

export const ConfigService = {
  async getConfig(): Promise<Partial<Config>> {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      return await response.json();
    } catch (error) {
      Logger.error('Failed to load config', error);
      return {
        steamId: '',
        libraryPath: ''
      };
    }
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

      Logger.info('Config saved successfully');
    } catch (error) {
      Logger.error('Failed to save config', error);
      throw error;
    }
  }
}; 