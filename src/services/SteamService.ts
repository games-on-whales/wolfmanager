import { SteamGame } from '../types/config';
import { ConfigService } from './ConfigService';

export const SteamService = {
  getOwnedGames: async (steamId: string): Promise<SteamGame[]> => {
    const config = ConfigService.getConfig();
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${config.steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`
    );
    const data = await response.json();
    return data.response.games || [];
  },

  getGameArtwork: async (appId: number) => {
    const config = ConfigService.getConfig();
    const response = await fetch(
      `https://www.steamgriddb.com/api/v2/games/steam/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${config.steamGridDbApiKey}`
        }
      }
    );
    return response.json();
  }
}; 