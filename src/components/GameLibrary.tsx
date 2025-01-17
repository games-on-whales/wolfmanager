/// <reference types="react" />
/// <reference types="@mui/material" />
/// <reference types="@mui/icons-material" />

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  CardMedia,
  CardActionArea,
  IconButton
} from '@mui/material';
import { Refresh as RefreshIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { SteamService, ConfigService, LogService, TaskService } from '../services';
import { SteamGame } from '../services/api/steam/types';
import { debounce } from 'lodash';

interface Props {
  searchQuery: string;
  libraryFilter: 'all' | 'steam';
}

const BATCH_SIZE = 48;
const SCROLL_THRESHOLD = 100;
const CARD_HEIGHT = 300; // Height of each game card in pixels
const CARD_WIDTH = 200;  // Width of each game card in pixels
const GRID_GAP = 16;    // Gap between cards in pixels
const BUFFER_ROWS = 4;  // Number of rows to render above and below viewport

export const GameLibrary: React.FC<Props> = ({ 
  searchQuery,
  libraryFilter 
}: Props) => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameArtwork, setGameArtwork] = useState<Record<number, string | null>>({});
  const [loadingArtwork, setLoadingArtwork] = useState<Record<number, boolean>>({});
  const [displayedGames, setDisplayedGames] = useState<number>(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: BATCH_SIZE });
  const containerRef = useRef<HTMLDivElement>(null);
  const urlCache = useRef<Set<string>>(new Set());

  // Cleanup function for URL objects
  const cleanupURLs = useCallback(() => {
    urlCache.current.forEach((url: string) => {
      URL.revokeObjectURL(url);
    });
    urlCache.current.clear();
  }, []);

  // Cleanup URLs when component unmounts
  useEffect(() => {
    return () => {
      cleanupURLs();
    };
  }, [cleanupURLs]);

  const filteredGames = useMemo(() => {
    return games
      .filter((game: SteamGame) => {
        const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLibrary = libraryFilter === 'all' || libraryFilter === 'steam';
        return matchesSearch && matchesLibrary;
      })
      .sort((a: SteamGame, b: SteamGame) => a.name.localeCompare(b.name));
  }, [games, searchQuery, libraryFilter]);

  // Calculate total height and grid layout
  const gridLayout = useMemo(() => {
    if (!containerRef.current) return { totalHeight: 0, cardsPerRow: 0 };
    
    const containerWidth = containerRef.current.clientWidth - 48; // Account for padding
    const cardsPerRow = Math.floor((containerWidth - GRID_GAP) / (CARD_WIDTH + GRID_GAP));
    const totalRows = Math.ceil(filteredGames.length / cardsPerRow);
    const totalHeight = totalRows * (CARD_HEIGHT + GRID_GAP);
    
    return { totalHeight, cardsPerRow };
  }, [filteredGames.length, containerRef.current?.clientWidth]);

  const loadCachedArtworkBatch = useCallback(async (gamesToLoad: SteamGame[]) => {
    if (gamesToLoad.length === 0) return;

    LogService.debug('Loading cached artwork batch', 'GameLibrary', { 
      batchSize: gamesToLoad.length,
      games: gamesToLoad.map(g => g.appid)
    });

    // Mark batch as loading
    setLoadingArtwork((prev: Record<number, boolean>) => {
      const updates: Record<number, boolean> = {};
      gamesToLoad.forEach(game => {
        updates[game.appid] = true;
      });
      return { ...prev, ...updates };
    });

    try {
      // Split into chunks of 12 for parallel loading
      const chunks: SteamGame[][] = [];
      for (let i = 0; i < gamesToLoad.length; i += 12) {
        chunks.push(gamesToLoad.slice(i, i + 12));
      }

      // Process chunks sequentially, but load each chunk in parallel
      for (const chunk of chunks) {
        const artworkPromises = chunk.map(async (game: SteamGame) => {
          try {
            // First try to get from cache
            const response = await fetch(`/api/cache/artwork/${game.appid}`);
            if (response.ok) {
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              urlCache.current.add(url); // Track URL for cleanup
              LogService.debug('Loaded artwork from cache', 'GameLibrary', { 
                appId: game.appid,
                url
              });
              return { appId: game.appid, url };
            }
            
            // If not in cache, try to get from SteamGridDB
            const artwork = await SteamService.getGameArtwork(game.appid);
            if (artwork) {
              LogService.debug('Loaded artwork from SteamGridDB', 'GameLibrary', { 
                appId: game.appid,
                url: artwork
              });
            }
            return { appId: game.appid, url: artwork };
          } catch (error) {
            LogService.error('Failed to load artwork for game', error, 'GameLibrary');
            return { appId: game.appid, url: null };
          }
        });

        const results = await Promise.all(artworkPromises);

        // Update artwork for this chunk
        setGameArtwork((prev: Record<number, string | null>) => {
          const updates: Record<number, string | null> = {};
          results.forEach(result => {
            updates[result.appId] = result.url;
          });
          return { ...prev, ...updates };
        });

        // Update loading state for this chunk
        setLoadingArtwork((prev: Record<number, boolean>) => {
          const updates: Record<number, boolean> = {};
          chunk.forEach(game => {
            updates[game.appid] = false;
          });
          return { ...prev, ...updates };
        });

        // Add a small delay between chunks to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      LogService.error('Failed to load artwork batch', error, 'GameLibrary');
      // Mark all as not loading on error
      setLoadingArtwork((prev: Record<number, boolean>) => {
        const updates: Record<number, boolean> = {};
        gamesToLoad.forEach(game => {
          updates[game.appid] = false;
        });
        return { ...prev, ...updates };
      });
    }
  }, []);

  // Handle scrolling and loading more games
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const remainingScroll = scrollHeight - scrollTop - clientHeight;
    
    if (remainingScroll < SCROLL_THRESHOLD) {
      setIsLoadingMore(true);
      const nextBatch = displayedGames + BATCH_SIZE;
      const maxGames = games.length;
      const newValue = Math.min(nextBatch, maxGames);

      // Pre-load artwork for next batch before updating displayedGames
      const nextGames = filteredGames
        .slice(displayedGames, newValue)
        .filter((game: SteamGame) => gameArtwork[game.appid] === undefined);

      if (nextGames.length > 0) {
        loadCachedArtworkBatch(nextGames).then(() => {
          setDisplayedGames(newValue);
          setIsLoadingMore(false);
        });
      } else {
        setDisplayedGames(newValue);
        setIsLoadingMore(false);
      }
    }
  }, [games.length, isLoadingMore, displayedGames, filteredGames, gameArtwork, loadCachedArtworkBatch]);

  // Calculate visible range based on scroll position
  const calculateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const { cardsPerRow } = gridLayout;
    
    if (cardsPerRow === 0) return;
    
    // Calculate visible range with buffer
    const rowHeight = CARD_HEIGHT + GRID_GAP;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS);
    const endRow = Math.min(
      Math.ceil(filteredGames.length / cardsPerRow),
      Math.ceil((scrollTop + containerHeight) / rowHeight) + BUFFER_ROWS
    );
    
    const start = Math.max(0, startRow * cardsPerRow);
    const end = Math.min(filteredGames.length, (endRow + 1) * cardsPerRow);
    
    setVisibleRange({ start, end });
  }, [filteredGames.length, gridLayout]);

  // Debounced scroll handler with lower frequency
  const debouncedScroll = useMemo(
    () => debounce(() => {
      calculateVisibleRange();
      handleScroll();
    }, 32), // Reduced from 60fps to ~30fps for better performance
    [calculateVisibleRange, handleScroll]
  );

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);
        setError(null);

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

  const loadMissingArtwork = useCallback(async () => {
    if (backgroundLoading) return;

    setBackgroundLoading(true);
    const gamesWithoutArtwork = games.filter((game: SteamGame) => gameArtwork[game.appid] === null);
    
    LogService.debug('Starting background artwork load', 'GameLibrary', {
      gamesCount: gamesWithoutArtwork.length
    });

    for (const game of gamesWithoutArtwork) {
      try {
        const artwork = await SteamService.getGameArtwork(game.appid);
        if (artwork) {
          setGameArtwork((prev: Record<number, string | null>) => ({
            ...prev,
            [game.appid]: artwork
          }));
        }
      } catch (error) {
        LogService.error('Failed to load artwork from SteamGridDB', error, 'GameLibrary');
      }
      
      // Add a delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setBackgroundLoading(false);
  }, [games, gameArtwork, backgroundLoading]);

  const displayedGamesList = useMemo(() => {
    const visibleGames = filteredGames.slice(visibleRange.start, visibleRange.end);
    return visibleGames;
  }, [filteredGames, visibleRange]);

  // Load artwork for visible items
  useEffect(() => {
    const unloadedGames = displayedGamesList
      .filter((game: SteamGame) => gameArtwork[game.appid] === undefined);

    if (unloadedGames.length > 0) {
      loadCachedArtworkBatch(unloadedGames);
    }
  }, [displayedGamesList, gameArtwork, loadCachedArtworkBatch]);

  // Recalculate visible range when container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleRange();
    });

    resizeObserver.observe(container);
    container.addEventListener('scroll', debouncedScroll);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', debouncedScroll);
      debouncedScroll.cancel();
    };
  }, [calculateVisibleRange, debouncedScroll]);

  // Remove the old initial artwork loading effect since we now handle it with the visible items effect
  useEffect(() => {
    if (games.length > 0) {
      const unloadedGames = filteredGames
        .slice(0, displayedGames)
        .filter((game: SteamGame) => gameArtwork[game.appid] === undefined);

      if (unloadedGames.length > 0) {
        loadCachedArtworkBatch(unloadedGames);
      }
    }
  }, [games, displayedGames, filteredGames, loadCachedArtworkBatch]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleRefreshArtwork = async (appId: number) => {
    try {
      setLoadingArtwork((prev: Record<number, boolean>) => ({ ...prev, [appId]: true }));
      await TaskService.refreshGameArtwork();
      const artwork = await SteamService.getGameArtwork(appId);
      if (artwork) {
        setGameArtwork((prev: Record<number, string | null>) => ({
          ...prev,
          [appId]: artwork
        }));
      }
    } catch (error) {
      LogService.error('Failed to refresh artwork', error, 'GameLibrary');
    } finally {
      setLoadingArtwork((prev: Record<number, boolean>) => ({ ...prev, [appId]: false }));
    }
  };

  useEffect(() => {
    LogService.debug('Games state updated', 'GameLibrary', {
      totalGames: games.length,
      displayedGames,
      hasMore: displayedGames < games.length
    });
  }, [games.length, displayedGames]);

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
    <Box 
      ref={containerRef} 
      sx={{ 
        flexGrow: 1, 
        p: 3, 
        position: 'fixed',
        top: 64,
        left: 240,
        right: 0,
        bottom: 0,
        overflowY: 'auto',
        bgcolor: 'background.default',
        willChange: 'transform',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        '& .MuiCard-root': {
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
          contain: 'content layout style paint'
        }
      }}
    >
      <Box 
        sx={{ 
          pb: 2,
          height: gridLayout.totalHeight,
          position: 'relative',
          contain: 'size layout',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: Math.floor(visibleRange.start / gridLayout.cardsPerRow) * (CARD_HEIGHT + GRID_GAP),
            left: 0,
            right: 0,
            contain: 'content layout style',
          }}
        >
          <Grid 
            container 
            spacing={2}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 200px))',
              gap: '16px',
              justifyContent: 'center',
              contain: 'layout style',
              '& > .MuiGrid-item': {
                width: '100%',
                maxWidth: '200px',
                margin: 0,
                padding: 0,
                contain: 'layout style'
              }
            }}
          >
            {displayedGamesList.map((game: SteamGame) => (
              <Grid item key={game.appid}>
                <Card 
                  sx={{ 
                    height: CARD_HEIGHT,
                    maxWidth: CARD_WIDTH,
                    margin: '0 auto',
                    position: 'relative',
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      '& .MuiCardContent-root': {
                        opacity: 1,
                        transform: 'translateY(0)'
                      }
                    }
                  }}
                >
                  <CardActionArea>
                    {gameArtwork[game.appid] ? (
                      <CardMedia
                        component="img"
                        sx={{
                          aspectRatio: '2/3',
                          objectFit: 'cover',
                          width: '100%',
                          height: 'auto',
                          maxWidth: '200px',
                          maxHeight: '300px',
                          contain: 'content', // Prevent layout thrashing
                          transform: 'translateZ(0)' // Force GPU acceleration
                        }}
                        image={gameArtwork[game.appid] || undefined}
                        alt={game.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <Box
                        sx={{
                          aspectRatio: '2/3',
                          width: '100%',
                          maxWidth: '200px',
                          maxHeight: '300px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.800',
                          position: 'relative',
                          p: 2,
                          textAlign: 'center',
                          contain: 'content', // Prevent layout thrashing
                          transform: 'translateZ(0)' // Force GPU acceleration
                        }}
                      >
                        {loadingArtwork[game.appid] ? (
                          <CircularProgress size={24} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {game.name}
                          </Typography>
                        )}
                      </Box>
                    )}
                    <CardContent
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6) 50%, transparent)',
                        padding: '16px 8px 8px',
                        opacity: 0,
                        transform: 'translate3d(0, 20px, 0)', // Use translate3d for better performance
                        transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        willChange: 'opacity, transform',
                        contain: 'content' // Prevent layout thrashing
                      }}
                    >
                      {game.playtime_forever > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ScheduleIcon sx={{ fontSize: '1rem', opacity: 0.7 }} />
                          <Typography variant="body2" sx={{ opacity: 0.7 }}>
                            {Math.round(game.playtime_forever / 60)} hours
                          </Typography>
                        </Box>
                      )}
                      {game.rtime_last_played > 0 && (
                        <Typography variant="caption" sx={{ opacity: 0.5 }}>
                          Last played: {new Date(game.rtime_last_played * 1000).toLocaleDateString()}
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
      {isLoadingMore && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      )}
      {!isLoadingMore && displayedGames < games.length && (
        <Box display="flex" justifyContent="center" p={2} color="text.secondary">
          <Typography variant="body2">
            Scroll to load more ({displayedGames} of {games.length} games)
          </Typography>
        </Box>
      )}
    </Box>
  );
}; 