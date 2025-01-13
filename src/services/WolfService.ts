export class WolfService {
    private socketPath: string;

    constructor(socketPath = '/var/run/wolf/wolf.sock') {
        this.socketPath = socketPath;
    }

    async installGame(appId: number): Promise<boolean> {
        try {
            const response = await fetch(`http://localhost/api/v1/steam/apps/${appId}/install`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            return response.ok;
        } catch (error) {
            console.error('Error installing game:', error);
            return false;
        }
    }

    async getInstalledGames(): Promise<number[]> {
        try {
            const response = await fetch(`http://localhost/api/v1/steam/apps`);
            const data = await response.json();
            return data.apps || [];
        } catch (error) {
            console.error('Error fetching installed games:', error);
            return [];
        }
    }
} 