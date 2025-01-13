import { Config } from '../types/config';

const CONFIG_KEY = 'wolf_manager_config';

const defaultConfig: Config = {
  steamId: '',
  libraryPath: '/games',
  steamApiKey: '',
  steamGridDbApiKey: ''
};

export const ConfigService = {
  getConfig: (): Config => {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return defaultConfig;
  },

  saveConfig: (config: Config): void => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }
}; 