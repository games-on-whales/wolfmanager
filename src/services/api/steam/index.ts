import { getOwnedGames } from './games';
import { getGameArtwork, refreshAllArtwork } from './artwork';

class SteamService {
  getOwnedGames = getOwnedGames;
  getGameArtwork = getGameArtwork;
  refreshAllArtwork = refreshAllArtwork;
}

export * from './types';
export * from './games';
export * from './artwork';

export default new SteamService(); 