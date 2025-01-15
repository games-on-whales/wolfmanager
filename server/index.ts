import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import { ConfigManager } from './config/ConfigManager.js';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 9971;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(join(__dirname, '../../dist')));

const CACHE_DIR = '/config/cache/artwork';

// Config endpoints
app.get('/api/config', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    // Redact sensitive information
    const sanitizedConfig = {
      ...config,
      users: config.users ? Object.fromEntries(
        Object.entries(config.users).map(([username, userData]) => [
          username,
          {
            ...userData,
            steamApiKey: userData.steamApiKey ? '[REDACTED]' : ''
          }
        ])
      ) : {},
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    };

    console.log('Sending config to client (sensitive data redacted)', sanitizedConfig);
    res.json(sanitizedConfig);
  } catch (error) {
    console.error('Error getting config:', error);
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
    
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`
    );
    
    if (!response.ok) {
      throw new Error(`Steam API responded with ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Steam API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SteamGridDB proxy endpoint
app.get('/api/steamgrid/artwork/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const gridDbKey = req.headers['x-steamgriddb-key'];

    console.log(`Fetching artwork for app ${appId}`);
    const response = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/steam/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${gridDbKey}`
        }
      }
    );

    if (!response.ok) {
      console.error(`SteamGridDB API error for ${appId}:`, {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`SteamGridDB API responded with ${response.status}`);
    }

    const data = await response.json();
    console.log(`Retrieved ${data.data?.length || 0} artwork options for app ${appId}`);
    
    // Transform response to match our expected structure
    const transformedData = {
      success: data.success,
      data: {
        id: parseInt(appId),
        grids: data.data || []
      }
    };
    
    res.json(transformedData);
  } catch (error) {
    console.error('SteamGridDB API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ensure logs directory exists
const logsDir = path.join('/config/logs');
fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'wolf-manager.log');

// Function to write log to file
const writeLogToFile = (logEntry: any) => {
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write log to file:', error);
  }
};

// Log endpoint for client-side logs
app.post('/api/logs', (req, res) => {
  try {
    const logEntry = req.body;
    writeLogToFile(logEntry);
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing log:', error);
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
    console.error('Error creating log archive:', error);
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