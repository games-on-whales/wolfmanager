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
import { CacheService } from '../services/CacheService';

interface LibraryStats {
  totalGames: number;
  totalPlaytime: number;
  recentlyPlayed: number;
}

// Add a new component for optimized image display
const GameArtwork: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      paddingTop: '150%', // Maintains 2:3 aspect ratio
      overflow: 'hidden'
    }}
  >
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scale(0.5)', // Scale down the image to 50%
        transformOrigin: 'center center'
      }}
    />
  </Box>
);

export const GameLibrary: React.FC = () => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LibraryStats>({
    totalGames: 0,
    totalPlaytime: 0,
    recentlyPlayed: 0
  });
  const [gameArtwork, setGameArtwork] = useState<Record<number, string>>({});

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

  useEffect(() => {
    const loadArtwork = async () => {
      const config = ConfigService.getConfig();
      if (!config.steamGridDbApiKey) {
        Logger.warn('Skipping artwork loading - SteamGridDB API key not configured');
        return;
      }
      if (games.length === 0) {
        Logger.warn('No games available to load artwork for');
        return;
      }

      Logger.info('Starting artwork loading process', { gameCount: games.length });
      await CacheService.ensureCacheDir();

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      for (const game of games) {
        if (gameArtwork[game.appid]) {
          Logger.debug('Artwork already loaded', { game: game.name, appId: game.appid });
          skippedCount++;
          continue;
        }

        Logger.debug('Loading artwork', { game: game.name, appId: game.appid });
        const artwork = await SteamService.getGameArtwork(game.appid);
        
        if (artwork) {
          setGameArtwork(prev => ({
            ...prev,
            [game.appid]: artwork
          }));
          successCount++;
          Logger.debug('Artwork loaded successfully', { game: game.name, appId: game.appid });
        } else {
          failureCount++;
          Logger.warn('Failed to load artwork', { game: game.name, appId: game.appid });
        }
      }

      Logger.info('Artwork loading completed', {
        total: games.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount
      });
    };

    loadArtwork();
  }, [games]);

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
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden' // Ensure scaled content doesn't overflow
              }}
            >
              {gameArtwork[game.appid] && (
                <GameArtwork 
                  src={gameArtwork[game.appid]} 
                  alt={game.name} 
                />
              )}
              <CardContent sx={{ flexGrow: 1 }}>
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