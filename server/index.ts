import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import { ConfigManager } from './config/ConfigManager.js';
import archiver from 'archiver';
import { Config, UserConfig } from '../src/types/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 9971;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(join(__dirname, '../../dist')));

const CACHE_DIR = '/config/cache/artwork';

// Function to write log to file and console
const writeLogToFile = (logEntry: LogEntry) => {
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    // Also log to console with timestamp
    console.log(`[${new Date().toISOString()}] ${logEntry.level.toUpperCase()}: ${logEntry.message}${logEntry.data ? ' ' + JSON.stringify(logEntry.data) : ''}`);
  } catch (error) {
    console.error('Failed to write log to file:', error instanceof Error ? error.message : String(error));
  }
};

// Helper function for server-side logging
const serverLog = (level: string, message: string, component = 'Server', data?: unknown) => {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    data
  };
  writeLogToFile(logEntry);
};

// Config endpoints
app.get('/api/config', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    // Redact sensitive information
    const sanitizedConfig: Config = {
      ...config,
      users: config.users ? Object.fromEntries(
        Object.entries(config.users).map(([username, userData]) => [
          username,
          {
            ...userData as UserConfig,
            steamApiKey: userData.steamApiKey ? '[REDACTED]' : ''
          }
        ])
      ) : {},
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    };

    serverLog('info', 'Sending config to client (sensitive data redacted)', 'Server', sanitizedConfig);
    res.json(sanitizedConfig);
  } catch (error) {
    serverLog('error', 'Error getting config', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Steam API proxy endpoint
app.get('/api/steam/games', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const currentUser = configManager.getCurrentUser();
    
    if (!currentUser) {
      throw new Error('No user selected');
    }

    const { steamId, steamApiKey } = currentUser;
    serverLog('debug', 'Fetching owned games', 'Server', { steamId });
    
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`
    );
    
    if (!response.ok) {
      throw new Error(`Steam API responded with ${response.status}`);
    }

    const data = await response.json();
    serverLog('info', `Successfully retrieved ${data.response?.games?.length || 0} games`, 'Server');
    res.json(data);
  } catch (error) {
    serverLog('error', 'Steam API error', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

interface SteamGridResponse {
  success: boolean;
  data: {
    id: number;
    grids: Array<{
      id: string;
      score: number;
      style: string;
      url: string;
    }>;
  };
}

// SteamGridDB proxy endpoint
app.get('/api/steamgrid/artwork/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const gridDbKey = req.headers['x-steamgriddb-key'] as string;

    if (!gridDbKey) {
      serverLog('error', 'Missing SteamGridDB API key', 'Server', { appId });
      throw new Error('SteamGridDB API key is required');
    }

    serverLog('debug', 'Fetching artwork', 'Server', { appId });
    const response = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/steam/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${gridDbKey}`
        }
      }
    );

    if (!response.ok) {
      serverLog('error', 'SteamGridDB API error', 'Server', {
        appId,
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`SteamGridDB API responded with ${response.status}`);
    }

    const rawData = await response.json();
    serverLog('debug', 'Raw SteamGridDB response', 'Server', rawData);

    const data = rawData as SteamGridResponse;
    serverLog('info', 'Retrieved artwork options', 'Server', {
      appId,
      count: data.data?.grids?.length || 0,
      styles: data.data?.grids ? [...new Set(data.data.grids.map(g => g.style))] : []
    });
    
    // Transform response to match our expected structure
    const transformedData = {
      success: data.success,
      data: {
        id: parseInt(appId),
        grids: data.data?.grids || []
      }
    };
    
    res.json(transformedData);
  } catch (error) {
    serverLog('error', 'SteamGridDB API error', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component?: string;
  data?: unknown;
}

// Ensure logs directory exists
const logsDir = path.join('/config/logs');
fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'wolf-manager.log');

// Log endpoint for client-side logs
app.post('/api/logs', (req, res) => {
  try {
    const logEntry = req.body as LogEntry;
    writeLogToFile(logEntry);
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing log:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to write log' });
  }
});

app.get('/api/logs/download', (req, res) => {
  try {
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment('wolf-manager-logs.zip');
    archive.pipe(res);

    // Add wolf-manager logs
    if (fs.existsSync(logFile)) {
      archive.file(logFile, { name: 'wolf-manager.log' });
    }

    // Add wolf logs if they exist
    const wolfLogDir = '/var/log/wolf';
    if (fs.existsSync(wolfLogDir)) {
      archive.directory(wolfLogDir, 'wolf-logs');
    }

    archive.finalize();
  } catch (error) {
    console.error('Error creating log archive:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to create log archive' });
  }
});

// All remaining requests return the React app, so it can handle routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 