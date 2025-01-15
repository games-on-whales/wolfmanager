import React, { useState, useEffect } from 'react';
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
  Button,
  Chip,
  SelectChangeEvent,
  IconButton,
  Tooltip
} from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { LogEntry, LogLevel } from '../services/LogService';
import Logger from '../services/LogService';

interface LogFilter {
  level: LogLevel | 'all';
  component: string;
  search: string;
}

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({
    level: 'all',
    component: 'all',
    search: ''
  });
  const [components, setComponents] = useState<string[]>([]);

  const fetchLogs = async () => {
    try {
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
    } catch (error) {
      Logger.error('Failed to fetch logs', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Set up polling for new logs every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
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
      Logger.error('Failed to download logs', error);
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
    return true;
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

  return (
    <Paper sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          System Logs
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh logs">
            <IconButton onClick={fetchLogs}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download log bundle">
            <IconButton onClick={handleDownload}>
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

        <TextField
          size="small"
          label="Search"
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          sx={{ flexGrow: 1 }}
        />
      </Box>

      <List sx={{ 
        maxHeight: 600, 
        overflow: 'auto',
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider'
      }}>
        {filteredLogs.map((log, index) => (
          <ListItem key={index} divider sx={{ display: 'block' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Chip
                label={log.level.toUpperCase()}
                color={getLevelColor(log.level)}
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