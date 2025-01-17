import fs from 'fs/promises';
import path from 'path';
import { SteamGame } from '../../src/types/config';
import { serverLog } from '../utils/logger.js';

interface GameData {
  games: Record<number, SteamGame>;  // All known games indexed by appId
  userGames: Record<string, number[]>;  // User -> array of appIds they own
  lastUpdated: Record<string, string>;  // User -> ISO timestamp of last update
}

export class GameManager {
  private static instance: GameManager;
  private data: GameData;
  private readonly gamesPath = '/config/games.json';

  private constructor() {
    this.data = {
      games: {},
      userGames: {},
      lastUpdated: {}
    };
  }

  static async getInstance(): Promise<GameManager> {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
      await GameManager.instance.loadGames();
    }
    return GameManager.instance;
  }

  private async loadGames(): Promise<void> {
    try {
      serverLog('debug', 'Loading games data...', 'GameManager');
      const gamesData = await fs.readFile(this.gamesPath, 'utf-8');
      this.data = JSON.parse(gamesData);
      serverLog('info', 'Games data loaded successfully', 'GameManager');
    } catch (error) {
      // If file doesn't exist, we'll use default empty data
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        serverLog('error', 'Error loading games data', 'GameManager', error);
      }
    }
  }

  private async saveGames(): Promise<void> {
    try {
      serverLog('debug', 'Saving games data...', 'GameManager');
      await fs.mkdir(path.dirname(this.gamesPath), { recursive: true });
      await fs.writeFile(this.gamesPath, JSON.stringify(this.data, null, 2));
      serverLog('info', 'Games data saved successfully', 'GameManager');
    } catch (error) {
      serverLog('error', 'Failed to save games data', 'GameManager', error);
      throw new Error('Failed to save games data');
    }
  }

  async updateUserGames(username: string, games: SteamGame[]): Promise<void> {
    try {
      serverLog('debug', 'Updating user games', 'GameManager', { username, gameCount: games.length });
      
      // Update the global games list
      games.forEach(game => {
        this.data.games[game.appid] = game;
      });

      // Update user's game list
      this.data.userGames[username] = games.map(game => game.appid);
      this.data.lastUpdated[username] = new Date().toISOString();

      await this.saveGames();
      serverLog('info', 'User games updated successfully', 'GameManager', { username });
    } catch (error) {
      serverLog('error', 'Failed to update user games', 'GameManager', error);
      throw error;
    }
  }

  async getUserGames(username: string): Promise<SteamGame[]> {
    const appIds = this.data.userGames[username] || [];
    return appIds.map(appId => this.data.games[appId]);
  }

  async getAllGames(): Promise<SteamGame[]> {
    return Object.values(this.data.games);
  }

  getLastUpdated(username: string): string | null {
    return this.data.lastUpdated[username] || null;
  }

  async deleteUserGames(username: string): Promise<void> {
    try {
      serverLog('debug', 'Deleting user games', 'GameManager', { username });
      delete this.data.userGames[username];
      delete this.data.lastUpdated[username];
      await this.saveGames();
      serverLog('info', 'User games deleted successfully', 'GameManager', { username });
    } catch (error) {
      serverLog('error', 'Failed to delete user games', 'GameManager', error);
      throw error;
    }
  }
} 