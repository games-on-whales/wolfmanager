import { WolfGame, WolfGameUpdate } from './types';
import { handleApiResponse, handleApiError } from '../base';
import Logger from '../logs';
import ConfigService from '../config';

export interface PairRequest {
  pair_secret: string;
  pin: string;
}

export interface PairResponse {
  requests: PairRequest[];
  success: boolean;
}

export interface PairedClient {
  app_state_folder: string;
  client_id: string;
}

export interface PairedClientsResponse {
  clients: PairedClient[];
  success: boolean;
}

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

  async getPendingPairRequests(): Promise<PairResponse> {
    try {
      Logger.debug('Fetching pending pair requests', 'WolfService');
      const response = await fetch('/api/wolf/pair/pending');
      const data = await handleApiResponse<PairResponse>(response, 'WolfService');
      Logger.info('Successfully fetched pending pair requests', 'WolfService', { count: data.requests.length });
      return data;
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async findPairRequestByPin(pin: string): Promise<PairRequest | null> {
    try {
      Logger.debug('Looking for pair request with PIN', 'WolfService', { pin });
      const response = await fetch('/api/wolf/pair/pending');
      const data = await handleApiResponse<PairResponse>(response, 'WolfService');
      const request = data.requests.find(req => req.pin === pin);
      
      if (request) {
        Logger.info('Found matching pair request', 'WolfService', { pin });
      } else {
        Logger.info('No matching pair request found', 'WolfService', { pin });
      }
      
      return request || null;
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async confirmPairing(pair_secret: string, pin: string): Promise<{ success: boolean }> {
    const response = await fetch('/api/wolf/pair/client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pair_secret, pin })
    });
    return response.json();
  }

  async getClients(): Promise<PairedClientsResponse> {
    try {
      Logger.debug('Fetching paired clients', 'WolfService');
      const response = await fetch('/api/wolf/clients');
      const data = await handleApiResponse<PairedClientsResponse>(response, 'WolfService');
      Logger.info('Successfully fetched paired clients', 'WolfService', { count: data.clients.length });
      return data;
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async unpairClient(clientId: string): Promise<{ success: boolean }> {
    try {
      Logger.debug('Unpairing client', 'WolfService', { 
        clientId,
        clientIdAsBigInt: BigInt(clientId).toString(),
        clientIdAsString: clientId.toString()
      });
      const response = await fetch('/api/wolf/unpair/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ client_id: clientId })
      });
      const data = await handleApiResponse<{ success: boolean }>(response, 'WolfService');
      Logger.info('Successfully unpaired client', 'WolfService', { 
        clientId,
        clientIdAsBigInt: BigInt(clientId).toString(),
        clientIdAsString: clientId.toString()
      });
      return data;
    } catch (error) {
      await handleApiError(error, 'WolfService');
      throw error;
    }
  }

  async validateClients(): Promise<void> {
    try {
      Logger.info('Starting client validation', 'WolfService');
      
      // Get current Wolf clients
      const wolfClientsResponse = await this.getClients();
      if (!wolfClientsResponse.success) {
        throw new Error('Failed to fetch Wolf clients');
      }
      
      const wolfClients = wolfClientsResponse.clients;
      const wolfClientIds = new Set(wolfClients.map(client => BigInt(client.client_id).toString()));
      
      // Check for duplicate client IDs in Wolf
      const duplicateIds = wolfClients
        .map(client => BigInt(client.client_id).toString())
        .filter((id, index, array) => array.indexOf(id) !== index);
      
      if (duplicateIds.length > 0) {
        Logger.warn('Duplicate client IDs found in Wolf', 'WolfService', {
          duplicateIds: Array.from(new Set(duplicateIds))
        });
      }
      
      // Get current config and user
      const config = ConfigService.getConfig();
      const currentUser = config.currentUser;
      
      if (!currentUser) {
        Logger.warn('No current user found during client validation', 'WolfService');
        return;
      }
      
      const userConfig = config.users[currentUser];
      const configClients = userConfig.clients || {};
      
      // Find orphaned clients (in config but not in Wolf)
      const orphanedClients = Object.keys(configClients).filter(
        clientId => !wolfClientIds.has(clientId)
      );
      
      if (orphanedClients.length > 0) {
        Logger.info('Found orphaned clients to remove', 'WolfService', {
          orphanedClientIds: orphanedClients,
          orphanedClientNames: orphanedClients.map(id => configClients[id].friendlyName)
        });
        
        // Remove orphaned clients from config
        const updatedClients = { ...configClients };
        orphanedClients.forEach(clientId => {
          delete updatedClients[clientId];
        });
        
        // Update config with cleaned client list
        await ConfigService.editUser(currentUser, undefined, undefined, updatedClients);
        
        Logger.info('Successfully removed orphaned clients', 'WolfService', {
          removedCount: orphanedClients.length
        });
      } else {
        Logger.info('No orphaned clients found', 'WolfService');
      }
    } catch (error) {
      Logger.error('Error during client validation', error, 'WolfService');
      throw error;
    }
  }
}

export default new WolfService(); 