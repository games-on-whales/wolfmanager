import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Fade
} from '@mui/material';
import {
  SportsEsports as GamesIcon,
  GetApp as InstallIcon
} from '@mui/icons-material';
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

interface GameLibraryProps {
  searchQuery: string;
}

// Update GameArtwork component to include hover effects and install button
const GameArtwork: React.FC<{ 
  src: string; 
  alt: string;
  onInstall: () => void;
}> = ({ src, alt, onInstall }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '150px',
        height: '225px',
        margin: '0 auto',
        backgroundColor: 'black',
        '&:hover': {
          '& .hover-overlay': {
            opacity: 1
          }
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box
        component="img"
        src={src}
        alt={alt}
        loading="lazy"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          transition: 'transform 0.3s ease-in-out',
          transform: isHovered ? 'scale(1.05)' : 'scale(1)'
        }}
      />
      <Fade in={isHovered}>
        <Box
          className="hover-overlay"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              color: 'white',
              textAlign: 'center',
              px: 1,
              mb: 1
            }}
          >
            {alt}
          </Typography>
          <IconButton
            color="primary"
            onClick={onInstall}
            sx={{
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            <InstallIcon />
          </IconButton>
        </Box>
      </Fade>
    </Box>
  );
};

export const GameLibrary: React.FC<GameLibraryProps> = ({ searchQuery }) => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [filteredGames, setFilteredGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LibraryStats>({
    totalGames: 0,
    totalPlaytime: 0,
    recentlyPlayed: 0
  });
  const [gameArtwork, setGameArtwork] = useState<Record<number, string>>({});

  // Update games when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredGames(games);
      return;
    }

    const searchTerm = searchQuery.toLowerCase();
    const filtered = games.filter(game => 
      game.name.toLowerCase().includes(searchTerm)
    );
    setFilteredGames(filtered);
    
    Logger.debug('Filtered games', { 
      searchTerm, 
      totalGames: games.length, 
      filteredCount: filtered.length 
    });
  }, [searchQuery, games]);

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
        setFilteredGames(ownedGames);
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

  const handleInstall = (game: SteamGame) => {
    Logger.info('Install requested for game', { 
      appId: game.appid, 
      name: game.name 
    });
    // TODO: Implement actual installation
  };

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
      <Grid container spacing={2} justifyContent="center">
        {filteredGames.map((game) => (
          <Grid item key={game.appid}>
            <Card 
              sx={{ 
                width: '150px',
                height: '225px',
                bgcolor: 'black',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.3s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.02)'
                }
              }}
            >
              {gameArtwork[game.appid] ? (
                <GameArtwork 
                  src={gameArtwork[game.appid]} 
                  alt={game.name}
                  onInstall={() => handleInstall(game)}
                />
              ) : (
                <CardContent>
                  <Typography variant="h6" noWrap>
                    {game.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Playtime: {Math.round(game.playtime_forever / 60)} hours
                  </Typography>
                </CardContent>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}; 