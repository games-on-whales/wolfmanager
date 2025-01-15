import React, { useState, useEffect, useRef } from 'react';
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
  Button
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Refresh as RefreshIcon,
  Delete as DeleteIcon 
} from '@mui/icons-material';
import { LogEntry, LogLevel } from '../services/LogService';
import Logger from '../services/LogService';

interface LogFilter {
  level: LogLevel | 'all';
  component: string;
  search: string;
  timeRange: 'all' | '30min' | '1hour' | '8hours';
}

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({
    level: 'all',
    component: 'all',
    search: '',
    timeRange: 'all'
  });
  const [components, setComponents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/logs');
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      const data = await response.json();
      setLogs(data);
      
      // Extract unique components
      const uniqueComponents = new Set<string>();
      data.forEach((log: LogEntry) => {
        if (log.component) {
          uniqueComponents.add(log.component);
        }
      });
      setComponents(Array.from(uniqueComponents));

      // Scroll to bottom after data is loaded
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    } catch (error) {
      Logger.error('Failed to fetch logs', error, 'LogViewer');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLogs();

    // Subscribe to new logs
    const subscription = Logger.subscribe((newLogs) => {
      setLogs(newLogs);
      // Update components list
      const uniqueComponents = new Set<string>();
      newLogs.forEach(log => {
        if (log.component) {
          uniqueComponents.add(log.component);
        }
      });
      setComponents(Array.from(uniqueComponents));

      // Scroll to bottom when new logs arrive
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });

    // Set up polling for new logs every 5 seconds
    const interval = setInterval(fetchLogs, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

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
      Logger.error('Failed to download logs', error, 'LogViewer');
    }
  };

  const handleClearLogs = () => {
    Logger.clearLogs();
  };

  const isWithinTimeRange = (timestamp: string) => {
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

  const filteredLogs = logs.filter(log => {
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

  const getLevelColor = (level: LogLevel): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (level) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'default';
      default:
        return 'default';
    }
  };

  const getLogItemStyle = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return { backgroundColor: 'rgba(211, 47, 47, 0.1)' };
      case 'warn':
        return { backgroundColor: 'rgba(237, 108, 2, 0.1)' };
      default:
        return {};
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          System Logs
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
            onChange={(e) => setFilter({ ...filter, component: e.target.value })}
          >
            <MenuItem value="all">All</MenuItem>
            {components.map(component => (
              <MenuItem key={component} value={component}>{component}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={filter.timeRange}
            label="Time Range"
            onChange={(e) => setFilter({ ...filter, timeRange: e.target.value as LogFilter['timeRange'] })}
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
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          sx={{ flexGrow: 1 }}
        />
      </Box>

      <List 
        ref={listRef}
        sx={{ 
          maxHeight: 600, 
          overflow: 'auto',
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider'
        }}
      >
        {filteredLogs.map((log, index) => (
          <ListItem 
            key={index} 
            divider 
            sx={{ 
              display: 'block',
              ...getLogItemStyle(log.level as LogLevel)
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Chip
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
              <Typography variant="caption" color="text.secondary">
                {new Date(log.timestamp).toLocaleString()}
              </Typography>
            </Box>
            <Typography>{log.message}</Typography>
            {log.data && (
              <Box 
                component="pre" 
                sx={{ 
                  mt: 1,
                  p: 1,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  overflow: 'auto'
                }}
              >
                {JSON.stringify(log.data, null, 2)}
              </Box>
            )}
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}; 