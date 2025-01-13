import React, { useState, useEffect } from 'react';
import { SteamGame } from '../types/steam';
import { WolfService } from '../services/WolfService';

const wolfService = new WolfService();

export const GameLibrary: React.FC = () => {
    const [games, setGames] = useState<SteamGame[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        setLoading(true);
        try {
            // This would need to be replaced with actual Steam API integration
            const dummyGames: SteamGame[] = [
                { appid: 570, name: 'Dota 2', installed: false },
                { appid: 730, name: 'CS:GO', installed: false },
            ];

            const installedGames = await wolfService.getInstalledGames();
            const updatedGames = dummyGames.map(game => ({
                ...game,
                installed: installedGames.includes(game.appid)
            }));

            setGames(updatedGames);
        } catch (error) {
            console.error('Error fetching games:', error);
        }
        setLoading(false);
    };

    const handleInstall = async (game: SteamGame) => {
        const updatedGames = games.map(g => {
            if (g.appid === game.appid) {
                return { ...g, installing: true };
            }
            return g;
        });
        setGames(updatedGames);

        const success = await wolfService.installGame(game.appid);
        
        if (success) {
            setGames(games.map(g => {
                if (g.appid === game.appid) {
                    return { ...g, installed: true, installing: false };
                }
                return g;
            }));
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="game-library">
            <h1>Steam Games</h1>
            <div className="games-grid">
                {games.map(game => (
                    <div key={game.appid} className="game-card">
                        <h3>{game.name}</h3>
                        <p>App ID: {game.appid}</p>
                        {!game.installed ? (
                            <button 
                                onClick={() => handleInstall(game)}
                                disabled={game.installing}
                            >
                                {game.installing ? 'Installing...' : 'Install'}
                            </button>
                        ) : (
                            <span className="installed-badge">Installed</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}; 