import { WolfGame, WolfGameUpdate } from './types';
import { handleApiResponse, handleApiError } from '../base';
import Logger from '../logs';

class WolfService {
  async getGames(): Promise<WolfGame[]> {
    try {
      Logger.debug('Fetching Wolf games', 'WolfService');
      const response = await fetch('/api/wolf/games');
      const games = await handleApiResponse<WolfGame[]>(response, 'WolfService');
      Logger.info('Successfully fetched Wolf games', 'WolfService', { count: games.length });
      return games;
    } catch (error) {
      await handleApiError(error, 'WolfService');
      return [];
    }
  }

  async updateGame(id: string, update: WolfGameUpdate): Promise<WolfGame> {
    try {
      Logger.debug('Updating Wolf game', 'WolfService', { id, update });
      const response = await fetch(`/api/wolf/games/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(update)
      });
      const game = await handleApiResponse<WolfGame>(response, 'WolfService');
      Logger.info('Successfully updated Wolf game', 'WolfService', { id });
      return game;
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async deleteGame(id: string): Promise<void> {
    try {
      Logger.debug('Deleting Wolf game', 'WolfService', { id });
      const response = await fetch(`/api/wolf/games/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      await handleApiResponse<void>(response, 'WolfService');
      Logger.info('Successfully deleted Wolf game', 'WolfService', { id });
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async importGames(): Promise<void> {
    try {
      Logger.debug('Starting Wolf games import', 'WolfService');
      const response = await fetch('/api/wolf/games/import', { method: 'POST' });
      await handleApiResponse<void>(response, 'WolfService');
      Logger.info('Successfully imported Wolf games', 'WolfService');
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async syncPlaytime(): Promise<void> {
    try {
      Logger.debug('Starting Wolf playtime sync', 'WolfService');
      const response = await fetch('/api/wolf/games/sync', { method: 'POST' });
      await handleApiResponse<void>(response, 'WolfService');
      Logger.info('Successfully synced Wolf playtime', 'WolfService');
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }
}

export default new WolfService(); 