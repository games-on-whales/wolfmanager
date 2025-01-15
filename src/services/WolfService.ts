import Logger from './LogService';

export class WolfService {
    private socketPath: string;

    constructor(socketPath = '/var/run/wolf/wolf.sock') {
        this.socketPath = socketPath;
        Logger.debug('Initializing WolfService', 'WolfService', { socketPath });
    }

    async installGame(appId: number): Promise<boolean> {
        try {
            Logger.info(`Installing game ${appId}`, 'WolfService');
            const response = await fetch(`http://localhost/api/v1/steam/apps/${appId}/install`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                Logger.info(`Successfully started installation of game ${appId}`, 'WolfService');
            } else {
                Logger.error(`Failed to install game ${appId}`, { 
                    status: response.status, 
                    statusText: response.statusText 
                }, 'WolfService');
            }
            
            return response.ok;
        } catch (error) {
            Logger.error('Error installing game', error, 'WolfService');
            return false;
        }
    }

    async getInstalledGames(): Promise<number[]> {
        try {
            Logger.debug('Fetching installed games', 'WolfService');
            const response = await fetch(`http://localhost/api/v1/steam/apps`);
            const data = await response.json();
            Logger.info(`Found ${data.apps?.length || 0} installed games`, 'WolfService');
            return data.apps || [];
        } catch (error) {
            Logger.error('Error fetching installed games', error, 'WolfService');
            return [];
        }
    }
} 