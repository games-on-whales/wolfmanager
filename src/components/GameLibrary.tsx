import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { SportsEsports as GamesIcon } from '@mui/icons-material';
import { SteamGame } from '../types/config';
import { SteamService } from '../services/SteamService';
import { ConfigService } from '../services/ConfigService';
import Logger from '../services/LogService';

interface LibraryStats {
  totalGames: number;
  totalPlaytime: number;
  recentlyPlayed: number;
}

export const GameLibrary: React.FC = () => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LibraryStats>({
    totalGames: 0,
    totalPlaytime: 0,
    recentlyPlayed: 0
  });

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
        
        // Calculate library statistics
        const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const libraryStats: LibraryStats = {
          totalGames: ownedGames.length,
          totalPlaytime: ownedGames.reduce((total, game) => total + game.playtime_forever, 0),
          recentlyPlayed: ownedGames.filter(game => 
            game.rtime_last_played && game.rtime_last_played * 1000 > twoWeeksAgo
          ).length
        };

        setGames(ownedGames);
        setStats(libraryStats);
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

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper elevation={2} sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center',
            bgcolor: 'primary.dark'
          }}>
            <GamesIcon sx={{ fontSize: 40, mr: 2 }} />
            <Box>
              <Typography variant="h4" component="div">
                {stats.totalGames}
              </Typography>
              <Typography variant="subtitle1">
                Total Games
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={2} sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center',
            bgcolor: 'secondary.dark'
          }}>
            <Box>
              <Typography variant="h4" component="div">
                {Math.round(stats.totalPlaytime / 60)}
              </Typography>
              <Typography variant="subtitle1">
                Total Hours Played
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={2} sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center',
            bgcolor: 'success.dark'
          }}>
            <Box>
              <Typography variant="h4" component="div">
                {stats.recentlyPlayed}
              </Typography>
              <Typography variant="subtitle1">
                Recently Played
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Games Grid */}
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