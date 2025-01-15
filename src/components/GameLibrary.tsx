import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  CardMedia,
  CardActionArea
} from '@mui/material';
import { SteamService, ConfigService, LogService } from '../services';
import { SteamGame } from '../types/config';

interface Props {
  searchQuery: string;
}

export const GameLibrary: React.FC<Props> = ({ searchQuery }) => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameArtwork, setGameArtwork] = useState<Record<number, string>>({});

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if a user is selected
        await ConfigService.loadConfig();
        const currentUser = ConfigService.getCurrentUser();
        if (!currentUser) {
          setError('Please select a user in the configuration');
          return;
        }

        const fetchedGames = await SteamService.getOwnedGames();
        setGames(fetchedGames);
      } catch (error) {
        LogService.error('Failed to load games', error);
        setError('Failed to load games');
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, []);

  useEffect(() => {
    const loadArtwork = async () => {
      const unloadedGames = games.filter(game => !gameArtwork[game.appid]);
      LogService.debug('Loading artwork for games', 'GameLibrary', { 
        totalGames: games.length,
        unloadedCount: unloadedGames.length,
        loadedCount: Object.keys(gameArtwork).length
      });

      for (const game of unloadedGames) {
        try {
          // First try to get cached artwork
          let artwork = await SteamService.getGameArtwork(game.appid);
          
          // If no cached artwork, try to fetch new artwork
          if (!artwork) {
            LogService.debug('No cached artwork found, fetching new artwork', 'GameLibrary', { 
              appId: game.appid,
              name: game.name
            });
            artwork = await SteamService.getGameArtwork(game.appid);
          } else {
            LogService.debug('Using cached artwork', 'GameLibrary', { 
              appId: game.appid,
              name: game.name
            });
          }

          if (artwork) {
            setGameArtwork(prev => ({
              ...prev,
              [game.appid]: artwork
            }));
          } else {
            LogService.warn('No artwork available for game', 'GameLibrary', {
              appId: game.appid,
              name: game.name
            });
          }
        } catch (error) {
          LogService.error('Failed to load artwork for game', error, 'GameLibrary');
        }
      }
    };

    if (games.length > 0) {
      loadArtwork();
    }
  }, [games]);

  const filteredGames = games.filter((game: SteamGame) =>
    game.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={2}>
        {filteredGames.map((game: SteamGame) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={game.appid}>
            <Card>
              <CardActionArea>
                {gameArtwork[game.appid] ? (
                  <CardMedia
                    component="img"
                    height="350"
                    image={gameArtwork[game.appid]}
                    alt={game.name}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 350,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.800'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No artwork available
                    </Typography>
                  </Box>
                )}
                <CardContent>
                  <Typography gutterBottom variant="h6" component="div">
                    {game.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Playtime: {Math.round(game.playtime_forever / 60)} hours
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}; 