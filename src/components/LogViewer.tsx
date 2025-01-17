import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  SelectChangeEvent,
  Chip,
  Collapse,
  Fade
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as DebugIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { LogService, LogEntry, LogLevel } from '../services';
import { throttle } from 'lodash';

interface LogFilter {
  level: LogLevel | 'all';
  component: string;
  search: string;
  timeRange: 'all' | '30min' | '1hour' | '8hours';
}

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({
    level: 'all',
    component: 'all',
    search: '',
    timeRange: 'all'
  });
  const [components, setComponents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Throttle log updates to prevent overwhelming the UI
  const throttledSetLogs = useCallback(
    throttle((newLogs: LogEntry[]) => {
      if (!isPaused) {
        setLogs(newLogs);
      }
    }, 500),
    [isPaused]
  );

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/logs');
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      const data = await response.json();
      throttledSetLogs(data);
      
      // Extract unique components
      const uniqueComponents = new Set<string>();
      data.forEach((log: LogEntry) => {
        if (log.component) {
          uniqueComponents.add(log.component);
        }
      });
      setComponents(Array.from(uniqueComponents));

      // Scroll to bottom after data is loaded if not paused
      if (listRef.current && !isPaused) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    } catch (error) {
      LogService.error('Failed to fetch logs', error, 'LogViewer');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLogs();

    // Subscribe to new logs
    const subscription = LogService.subscribe(throttledSetLogs);

    // Set up polling for new logs every 5 seconds if not paused
    const interval = setInterval(() => {
      if (!isPaused) {
        fetchLogs();
      }
    }, 5000);

    return () => {
      subscription();
      clearInterval(interval);
      throttledSetLogs.cancel();
    };
  }, [isPaused, throttledSetLogs]);

  // Set up resize observer for the container
  useEffect(() => {
    if (containerRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (listRef.current && !isPaused) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [isPaused]);

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/logs/download');
      if (!response.ok) {
        throw new Error('Failed to download logs');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wolf-manager-logs.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      LogService.error('Failed to download logs', error, 'LogViewer');
    }
  };

  const handleClearLogs = () => {
    LogService.clearLogs();
  };

  const handleCopyLog = (log: LogEntry) => {
    const logText = `[${log.timestamp}] ${log.level.toUpperCase()} [${log.component || 'unknown'}]: ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`;
    navigator.clipboard.writeText(logText);
  };

  const handleToggleExpand = (index: number) => {
    setExpandedLogs((prev: Record<number, boolean>) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getLevelIcon = (level: LogLevel): React.ReactElement | undefined => {
    switch (level) {
      case LogLevel.ERROR:
        return <ErrorIcon fontSize="small" />;
      case LogLevel.WARN:
        return <WarningIcon fontSize="small" />;
      case LogLevel.INFO:
        return <InfoIcon fontSize="small" />;
      case LogLevel.DEBUG:
        return <DebugIcon fontSize="small" />;
      default:
        return undefined;
    }
  };

  const getLevelColor = (level: LogLevel): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (level) {
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.WARN:
        return 'warning';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.DEBUG:
        return 'default';
      default:
        return 'default';
    }
  };

  const getLogItemStyle = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR:
        return { backgroundColor: 'rgba(211, 47, 47, 0.1)' };
      case LogLevel.WARN:
        return { backgroundColor: 'rgba(237, 108, 2, 0.1)' };
      default:
        return {};
    }
  };

  const isWithinTimeRange = (timestamp: string): boolean => {
    const logTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diff = now - logTime;

    switch (filter.timeRange) {
      case '30min':
        return diff <= 30 * 60 * 1000;
      case '1hour':
        return diff <= 60 * 60 * 1000;
      case '8hours':
        return diff <= 8 * 60 * 60 * 1000;
      default:
        return true;
    }
  };

  const filteredLogs = logs.filter((log: LogEntry) => {
    if (filter.level !== 'all' && log.level !== filter.level) {
      return false;
    }
    if (filter.component !== 'all' && log.component !== filter.component) {
      return false;
    }
    if (filter.search && !JSON.stringify(log).toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    return isWithinTimeRange(log.timestamp);
  });

  return (
    <Paper 
      ref={containerRef}
      sx={{ 
        p: 3, 
        maxWidth: 1200, 
        mx: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          System Logs
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={isPaused ? "Resume log updates" : "Pause log updates"}>
            <IconButton onClick={() => setIsPaused(!isPaused)} color={isPaused ? "warning" : "default"}>
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear logs">
            <IconButton onClick={handleClearLogs} disabled={isLoading}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh logs">
            <IconButton onClick={fetchLogs} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download log bundle">
            <IconButton onClick={handleDownload} disabled={isLoading}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Level</InputLabel>
          <Select
            value={filter.level}
            label="Level"
            onChange={(e: SelectChangeEvent) => setFilter({ ...filter, level: e.target.value as LogLevel | 'all' })}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="debug">Debug</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warn">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Component</InputLabel>
          <Select
            value={filter.component}
            label="Component"
            onChange={(e: SelectChangeEvent) => setFilter({ ...filter, component: e.target.value })}
          >
            <MenuItem value="all">All</MenuItem>
            {components.map((component: string) => (
              <MenuItem key={component} value={component}>{component}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={filter.timeRange}
            label="Time Range"
            onChange={(e: SelectChangeEvent) => setFilter({ ...filter, timeRange: e.target.value as LogFilter['timeRange'] })}
          >
            <MenuItem value="all">All Time</MenuItem>
            <MenuItem value="30min">Last 30 Minutes</MenuItem>
            <MenuItem value="1hour">Last Hour</MenuItem>
            <MenuItem value="8hours">Last 8 Hours</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Search"
          value={filter.search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter({ ...filter, search: e.target.value })}
          sx={{ flexGrow: 1 }}
        />
      </Box>

      <List 
        ref={listRef}
        component="ul"
        sx={{ 
          flexGrow: 1,
          overflow: 'auto',
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          fontFamily: 'monospace'
        }}
      >
        {filteredLogs.map((log: LogEntry, index: number) => (
          <ListItem 
            key={index} 
            divider 
            sx={{ 
              display: 'block',
              ...getLogItemStyle(log.level as LogLevel),
              '&:hover': {
                '& .copy-button': {
                  opacity: 1
                }
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Chip
                icon={getLevelIcon(log.level as LogLevel)}
                label={log.level.toUpperCase()}
                color={getLevelColor(log.level as LogLevel)}
                size="small"
              />
              {log.component && (
                <Chip
                  label={log.component}
                  variant="outlined"
                  size="small"
                />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                {new Date(log.timestamp).toLocaleString()}
              </Typography>
              <Fade in>
                <IconButton 
                  size="small" 
                  onClick={() => handleCopyLog(log)}
                  className="copy-button"
                  sx={{ 
                    opacity: 0,
                    transition: 'opacity 0.2s'
                  }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Fade>
              {log.data && (
                <IconButton 
                  size="small"
                  onClick={() => handleToggleExpand(index)}
                >
                  {expandedLogs[index] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
            </Box>
            <Typography sx={{ wordBreak: 'break-word' }}>{log.message}</Typography>
            {log.data && (
              <Collapse in={expandedLogs[index]}>
                <Box 
                  component="pre" 
                  sx={{ 
                    mt: 1,
                    p: 1,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    overflow: 'auto',
                    fontSize: '0.875rem'
                  }}
                >
                  {JSON.stringify(log.data, null, 2)}
                </Box>
              </Collapse>
            )}
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default LogViewer; 