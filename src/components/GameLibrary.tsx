/// <reference types="react" />
/// <reference types="@mui/material" />
/// <reference types="@mui/icons-material" />

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  CircularProgress,
  Grid,
  Typography,
  Alert
} from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { debounce } from 'lodash';
import { SteamGame } from '../types/steam';
import { ConfigService, LogService, SteamService } from '../services';

// Constants
const CARD_HEIGHT = 300;
const GRID_GAP = 16;
const BATCH_SIZE = 20;
const MIN_GAMES_PER_ROW = 5;
const MAX_CARD_WIDTH = 200; // Current size from screenshot
const CONTAINER_PADDING = 24;
const ASPECT_RATIO = '2/3'; // 600x900 aspect ratio

interface Props {
  searchQuery: string;
  libraryFilter: 'all' | 'steam';
}

const SCROLL_THRESHOLD = 100;
const BUFFER_ROWS = 4;

// Add memory management utilities
const MEMORY_THRESHOLD = 50; // Maximum number of images to keep in memory
const CLEANUP_INTERVAL = 60000; // Cleanup every minute

interface GridLayout {
  totalHeight: number;
  cardsPerRow: number;
  cardWidth: number;
  rowHeight: number;
  containerWidth: number;
}

export const GameLibrary: React.FC<Props> = ({ 
  searchQuery,
  libraryFilter 
}: Props) => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameArtwork, setGameArtwork] = useState<Record<number, string>>({});
  const [loadingArtwork, setLoadingArtwork] = useState<Record<number, boolean>>({});
  const [displayedGames, setDisplayedGames] = useState<number>(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: BATCH_SIZE });
  const containerRef = useRef<HTMLDivElement>(null);
  const urlCache = useRef<Set<string>>(new Set());
  const [imageCache] = useState(() => new Map<number, string>());
  const [preloadedImages] = useState(() => new Set<number>());

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

  // Add memory management utilities
  const cleanupMemory = useCallback(() => {
    if (imageCache.size > MEMORY_THRESHOLD) {
      const keysToRemove = Array.from(imageCache.keys())
        .slice(0, imageCache.size - MEMORY_THRESHOLD);
      
      keysToRemove.forEach(key => {
        imageCache.delete(key);
        preloadedImages.delete(key);
      });
      
      LogService.debug('Cleaned up image cache', 'GameLibrary', {
        removed: keysToRemove.length,
        remaining: imageCache.size
      });
    }
  }, [imageCache, preloadedImages]);

  // Add cleanup interval
  useEffect(() => {
    const interval = setInterval(cleanupMemory, CLEANUP_INTERVAL);
    return () => {
      clearInterval(interval);
      cleanupMemory();
    };
  }, [cleanupMemory]);

  // Modify the grid layout calculation to ensure all properties are defined
  const gridLayout = useMemo<GridLayout>(() => {
    if (!containerRef.current) return {
      totalHeight: 0,
      cardsPerRow: 0,
      cardWidth: 0,
      rowHeight: CARD_HEIGHT + GRID_GAP,
      containerWidth: 0
    };
    
    const containerWidth = containerRef.current.clientWidth - (CONTAINER_PADDING * 2);
    const minCardWidth = Math.min(
      MAX_CARD_WIDTH,
      Math.floor((containerWidth - (GRID_GAP * (MIN_GAMES_PER_ROW - 1))) / MIN_GAMES_PER_ROW)
    );
    
    const cardsPerRow = Math.max(
      MIN_GAMES_PER_ROW,
      Math.floor((containerWidth + GRID_GAP) / (minCardWidth + GRID_GAP))
    );
    
    const cardWidth = Math.floor((containerWidth - (GRID_GAP * (cardsPerRow - 1))) / cardsPerRow);
    const totalRows = Math.ceil(filteredGames.length / cardsPerRow);
    const totalHeight = totalRows * (CARD_HEIGHT + GRID_GAP);
    
    return {
      totalHeight,
      cardsPerRow,
      cardWidth,
      rowHeight: CARD_HEIGHT + GRID_GAP,
      containerWidth
    };
  }, [filteredGames.length, containerRef.current?.clientWidth]);

  // Add preload function
  const preloadImage = useCallback((url: string, appId: number) => {
    if (preloadedImages.has(appId)) return;
    
    const img = new Image();
    img.onload = () => {
      imageCache.set(appId, url);
      preloadedImages.add(appId);
    };
    img.src = url;
  }, [imageCache, preloadedImages]);

  // Modify loadCachedArtworkBatch to use preloading
  const loadCachedArtworkBatch = useCallback(async (gamesToLoad: SteamGame[]) => {
    if (gamesToLoad.length === 0) return;

    LogService.debug('Loading cached artwork batch', 'GameLibrary', { 
      batchSize: gamesToLoad.length,
      games: gamesToLoad.map(g => g.appid)
    });

    setLoadingArtwork((prev: Record<number, boolean>) => {
      const updates: Record<number, boolean> = {};
      gamesToLoad.forEach(game => {
        updates[game.appid] = true;
      });
      return { ...prev, ...updates };
    });

    try {
      const chunks: SteamGame[][] = [];
      for (let i = 0; i < gamesToLoad.length; i += 12) {
        chunks.push(gamesToLoad.slice(i, i + 12));
      }

      for (const chunk of chunks) {
        const artworkPromises = chunk.map(async (game: SteamGame) => {
          try {
            const cachedImage = imageCache.get(game.appid);
            if (cachedImage) {
              return { appId: game.appid, url: cachedImage };
            }

            const response = await fetch(`/api/cache/artwork/${game.appid}`, {
              cache: 'force-cache'
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              urlCache.current.add(url);
              preloadImage(url, game.appid);
              return { appId: game.appid, url };
            }
            
            const artwork = await SteamService.getGameArtwork(game.appid);
            if (artwork) {
              preloadImage(artwork, game.appid);
              return { appId: game.appid, url: artwork };
            }
            return { appId: game.appid, url: '' };
          } catch (error) {
            LogService.error('Failed to load artwork for game', error, 'GameLibrary');
            return { appId: game.appid, url: '' };
          }
        });

        const results = await Promise.all(artworkPromises);

        setGameArtwork((prev: Record<number, string>) => {
          const updates: Record<number, string> = {};
          results.forEach(result => {
            updates[result.appId] = result.url;
          });
          return { ...prev, ...updates };
        });

        setLoadingArtwork((prev: Record<number, boolean>) => {
          const updates: Record<number, boolean> = {};
          chunk.forEach(game => {
            updates[game.appid] = false;
          });
          return { ...prev, ...updates };
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      LogService.error('Failed to load artwork batch', error, 'GameLibrary');
      setLoadingArtwork((prev: Record<number, boolean>) => {
        const updates: Record<number, boolean> = {};
        gamesToLoad.forEach(game => {
          updates[game.appid] = false;
        });
        return { ...prev, ...updates };
      });
    }
  }, [imageCache, preloadImage]);

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

  // Optimize the visible range calculation
  const calculateVisibleRange = useCallback(() => {
    if (!containerRef.current || gridLayout.cardsPerRow === 0) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // Calculate visible range with buffer
    const startRow = Math.max(0, Math.floor(scrollTop / gridLayout.rowHeight) - BUFFER_ROWS);
    const endRow = Math.min(
      Math.ceil(filteredGames.length / gridLayout.cardsPerRow),
      Math.ceil((scrollTop + containerHeight) / gridLayout.rowHeight) + BUFFER_ROWS
    );
    
    const start = Math.max(0, startRow * gridLayout.cardsPerRow);
    const end = Math.min(filteredGames.length, (endRow + 1) * gridLayout.cardsPerRow);
    
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
        position: 'fixed',
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: 'auto',
        bgcolor: 'background.default',
        willChange: 'transform',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        px: 3,
        '& .MuiCard-root': {
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
          contain: 'content layout style paint',
          maxWidth: MAX_CARD_WIDTH,
          aspectRatio: ASPECT_RATIO,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box 
        sx={{ 
          pb: 2,
          height: gridLayout.totalHeight,
          position: 'relative',
          contain: 'size layout',
          maxWidth: '1600px',
          width: '100%',
          mx: 'auto'
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
              gridTemplateColumns: `repeat(${gridLayout.cardsPerRow}, minmax(0, 1fr))`,
              gap: `${GRID_GAP}px`,
              justifyContent: 'center',
              contain: 'layout style',
              '& > .MuiGrid-item': {
                width: '100%',
                margin: 0,
                padding: 0,
                contain: 'layout style'
              }
            }}
          >
            {displayedGamesList.map((game: SteamGame, index: number) => (
              <Grid item key={game.appid}>
                <Card 
                  sx={{ 
                    height: '100%',
                    width: '100%',
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
                  <CardActionArea sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {gameArtwork[game.appid] ? (
                      <CardMedia
                        component="img"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          aspectRatio: ASPECT_RATIO,
                          contain: 'content',
                          transform: 'translateZ(0)',
                          willChange: 'transform',
                          backfaceVisibility: 'hidden'
                        }}
                        image={imageCache.get(game.appid) || gameArtwork[game.appid] || ''}
                        alt={game.name}
                        loading="lazy"
                        decoding="async"
                        fetchPriority={index < 12 ? "high" : "low"}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.800',
                          position: 'relative',
                          p: 2,
                          textAlign: 'center',
                          aspectRatio: ASPECT_RATIO,
                          contain: 'content',
                          transform: 'translateZ(0)'
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
                        transform: 'translate3d(0, 20px, 0)',
                        transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        willChange: 'opacity, transform',
                        contain: 'content'
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