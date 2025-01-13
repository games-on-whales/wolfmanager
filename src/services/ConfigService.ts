import { Config } from '../types/config';
import Logger from './LogService';

const CONFIG_KEY = 'wolf_manager_config';

const defaultConfig: Config = {
  steamId: '',
  libraryPath: '/games',
  steamApiKey: '',
  steamGridDbApiKey: ''
};

export const ConfigService = {
  getConfig: (): Config => {
    Logger.debug('Retrieving configuration');
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      try {
        const config = JSON.parse(stored);
        Logger.info('Configuration loaded successfully');
        Logger.debug('Config values:', {
          ...config,
          steamApiKey: config.steamApiKey ? '[REDACTED]' : '',
          steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
        });
        return config;
      } catch (error) {
        Logger.error('Failed to parse stored configuration', error);
        return defaultConfig;
      }
    }
    Logger.info('Using default configuration');
    return defaultConfig;
  },

  saveConfig: (config: Config): void => {
    try {
      Logger.debug('Saving configuration', {
        ...config,
        steamApiKey: config.steamApiKey ? '[REDACTED]' : '',
        steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
      });
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      Logger.info('Configuration saved successfully');
    } catch (error) {
      Logger.error('Failed to save configuration', error);
      throw error;
    }
  }
}; 