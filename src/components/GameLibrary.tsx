import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import { SteamGame } from '../types/config';
import { SteamService } from '../services/SteamService';
import { ConfigService } from '../services/ConfigService';
import Logger from '../services/LogService';

export const GameLibrary: React.FC = () => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGames = async () => {
      Logger.info('Loading game library');
      try {
        const config = ConfigService.getConfig();
        if (!config.steamId || !config.steamApiKey) {
          const errorMsg = 'Steam ID and API Key are required. Please check your configuration.';
          Logger.warn(errorMsg);
          setError(errorMsg);
          setLoading(false);
          return;
        }

        Logger.debug('Fetching owned games');
        const ownedGames = await SteamService.getOwnedGames(config.steamId);
        Logger.info(`Loaded ${ownedGames.length} games`);
        setGames(ownedGames);
        setError(null);
      } catch (err) {
        const errorMsg = 'Failed to load games. Please check your configuration and try again.';
        Logger.error(errorMsg, err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Game Library
      </Typography>
      <Grid container spacing={2}>
        {games.map((game) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={game.appid}>
            <Card>
              <CardContent>
                <Typography variant="h6" noWrap>
                  {game.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Playtime: {Math.round(game.playtime_forever / 60)} hours
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}; 