import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import { ConfigManager } from './config/ConfigManager.js';
import archiver from 'archiver';
import { Config, UserConfig, SteamGame } from '../src/types/config';
import { GameManager } from './games/GameManager.js';
import * as http from 'http';
import * as net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add after other interfaces, before the app initialization
interface PairResponse {
  requests: Array<{
    pair_secret: string;
    pin: string;
  }>;
  success: boolean;
}

interface WolfClient {
  client_id: string;
  name: string;
}

interface ClientResponse {
  success: boolean;
  clients: WolfClient[];
}

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
    // Ensure the log entry is valid JSON
    const jsonString = JSON.stringify(logEntry);
    fs.appendFileSync(logFile, jsonString + '\n');
    
    // Also log to console with timestamp
    console.log(`[${logEntry.timestamp}] ${logEntry.level.toUpperCase()}: ${logEntry.message}${logEntry.data ? ' ' + JSON.stringify(logEntry.data) : ''}`);
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

app.post('/api/config', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const currentConfig = configManager.getConfig();
    const newConfig = req.body as Config;

    // Merge the configs, preserving sensitive data
    const mergedConfig: Config = {
      ...currentConfig,
      ...newConfig,
      steamGridDbApiKey: newConfig.steamGridDbApiKey === '[REDACTED]' 
        ? currentConfig.steamGridDbApiKey 
        : newConfig.steamGridDbApiKey,
      users: Object.fromEntries(
        Object.entries(newConfig.users || {}).map(([username, userData]) => [
          username,
          {
            ...userData,
            steamApiKey: (userData as UserConfig).steamApiKey === '[REDACTED]'
              ? (currentConfig.users[username]?.steamApiKey || '')
              : (userData as UserConfig).steamApiKey
          }
        ])
      )
    };

    // Save the merged config
    await configManager.saveConfig(mergedConfig);
    
    // Get the updated config and sanitize it for the response only
    const config = configManager.getConfig();
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

    serverLog('info', 'Config saved successfully', 'Server');
    res.json(sanitizedConfig);
  } catch (error) {
    serverLog('error', 'Failed to save config', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

interface SteamApiResponse {
  response: {
    game_count: number;
    games: SteamGame[];
  };
}

// Steam API proxy endpoint
app.get('/api/steam/games', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const gameManager = await GameManager.getInstance();
    const currentUser = configManager.getCurrentUser();
    
    serverLog('debug', 'Attempting to fetch games', 'Server', { 
      hasCurrentUser: !!currentUser,
      currentUsername: currentUser?.username,
      hasSteamId: currentUser?.steamId ? 'yes' : 'no',
      hasSteamApiKey: currentUser?.steamApiKey ? 'yes' : 'no'
    });
    
    if (!currentUser) {
      serverLog('error', 'No user selected', 'Server');
      return res.status(400).json({ error: 'No user selected' });
    }

    if (!currentUser.steamApiKey || !currentUser.steamId) {
      serverLog('error', 'Missing Steam credentials', 'Server', { 
        hasSteamId: !!currentUser.steamId,
        hasSteamApiKey: !!currentUser.steamApiKey,
        username: currentUser.username
      });
      return res.status(400).json({ error: 'Missing Steam credentials' });
    }

    // Check if we have cached data and it's not too old (24 hours)
    const lastUpdated = gameManager.getLastUpdated(currentUser.username);
    const now = new Date();
    const useCache = lastUpdated && 
      (now.getTime() - new Date(lastUpdated).getTime() < 24 * 60 * 60 * 1000);

    if (useCache) {
      serverLog('debug', 'Using cached games list', 'Server', {
        username: currentUser.username,
        lastUpdated
      });
      const games = await gameManager.getUserGames(currentUser.username);
      return res.json({ response: { games, game_count: games.length } });
    }

    const { steamId, steamApiKey } = currentUser;
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`;
    serverLog('debug', 'Fetching owned games from Steam API', 'Server', { 
      steamId, 
      url: url.replace(steamApiKey, '[REDACTED]'),
      username: currentUser.username
    });
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        serverLog('error', 'Steam API error response', 'Server', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          url: url.replace(steamApiKey, '[REDACTED]'),
          username: currentUser.username
        });
        return res.status(response.status).json({ 
          error: `Steam API request failed: ${response.statusText}`,
          details: errorText
        });
      }

      const data = await response.json() as SteamApiResponse;
      
      if (!data.response || !Array.isArray(data.response.games)) {
        const errorMsg = 'Invalid response format from Steam API';
        serverLog('error', errorMsg, 'Server', { data });
        return res.status(500).json({ error: errorMsg, details: data });
      }

      // Update the game manager with the new data
      await gameManager.updateUserGames(currentUser.username, data.response.games);
      
      serverLog('info', `Successfully retrieved ${data.response.games.length} games`, 'Server', {
        username: currentUser.username
      });
      res.json(data);
      
    } catch (fetchError) {
      serverLog('error', 'Failed to fetch from Steam API', 'Server', { 
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        url: url.replace(steamApiKey, '[REDACTED]'),
        username: currentUser.username
      });
      return res.status(500).json({ 
        error: 'Failed to fetch from Steam API', 
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      });
    }
  } catch (error) {
    serverLog('error', 'Unexpected error in Steam games endpoint', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Unexpected error occurred', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

interface SteamGridResponse {
  success: boolean;
  data: Array<{
    id: number;
    score: number;
    style: string;
    width: number;
    height: number;
    nsfw: boolean;
    humor: boolean;
    url: string;
    thumb: string;
    lock: boolean;
    epilepsy: boolean;
    upvotes: number;
    downvotes: number;
    author: {
      name: string;
      steam64: string;
      avatar: string;
    };
  }>;
}

// SteamGridDB proxy endpoint
app.get('/api/steamgrid/artwork/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    if (!config.steamGridDbApiKey) {
      serverLog('error', 'SteamGridDB API key not configured', 'Server', { appId });
      throw new Error('SteamGridDB API key is not configured');
    }

    serverLog('debug', 'Fetching artwork', 'Server', { appId });
    const response = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/steam/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${config.steamGridDbApiKey}`
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
    
    // Transform response to match our expected structure
    const transformedData = {
      success: data.success,
      data: {
        id: parseInt(appId),
        grids: data.data.map(grid => ({
          id: grid.id.toString(),
          score: grid.score,
          style: grid.style,
          url: grid.url
        }))
      }
    };
    
    serverLog('info', 'Retrieved artwork options', 'Server', {
      appId,
      count: transformedData.data.grids.length,
      styles: [...new Set(transformedData.data.grids.map(g => g.style))]
    });
    
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

// Get logs endpoint
app.get('/api/logs', async (req, res) => {
  try {
    // Read the last 1000 lines from the log file
    const logs: LogEntry[] = [];
    
    // If log file doesn't exist, return empty array
    if (!fs.existsSync(logFile)) {
      return res.json([]);
    }

    const configManager = await ConfigManager.getInstance();
    const debugEnabled = configManager.getConfig().debugEnabled;

    const fileContent = fs.readFileSync(logFile, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const lastLines = lines.slice(-1000);

    for (const line of lastLines) {
      try {
        const log = JSON.parse(line) as LogEntry;
        // Only include debug logs if debug mode is enabled
        if (log.level === 'debug' && !debugEnabled) {
          continue;
        }
        logs.push(log);
      } catch (error) {
        serverLog('error', 'Failed to parse log line', 'Server', { line, error: error instanceof Error ? error.message : String(error) });
      }
    }

    res.json(logs);
  } catch (error) {
    serverLog('error', 'Error getting logs', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Log endpoint for client-side logs
app.post('/api/logs', (req, res) => {
  try {
    const logEntry = req.body as LogEntry;
    writeLogToFile(logEntry);
    res.json({ success: true });
  } catch (error) {
    serverLog('error', 'Error writing log', 'Server', error instanceof Error ? error.message : String(error));
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

// Ensure cache directory exists
app.post('/api/cache/ensure', (req, res) => {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    serverLog('info', 'Cache directory ensured', 'Server', { path: CACHE_DIR });
    res.json({ success: true });
  } catch (error) {
    serverLog('error', 'Failed to ensure cache directory', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to ensure cache directory' });
  }
});

// Get cached artwork
app.get('/api/cache/artwork/:appId', (req, res) => {
  try {
    const { appId } = req.params;
    const artworkPath = path.join(CACHE_DIR, `${appId}.jpg`);
    
    if (!fs.existsSync(artworkPath)) {
      serverLog('debug', 'Artwork not found in cache', 'Server', { appId, path: artworkPath });
      return res.status(404).json({ error: 'Artwork not found in cache' });
    }

    serverLog('debug', 'Serving cached artwork', 'Server', { appId, path: artworkPath });
    res.sendFile(artworkPath);
  } catch (error) {
    serverLog('error', 'Failed to get cached artwork', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to get cached artwork' });
  }
});

// Cache new artwork
app.post('/api/cache/artwork', async (req, res) => {
  try {
    const { appId, imageUrl } = req.body;
    if (!appId || !imageUrl) {
      return res.status(400).json({ error: 'appId and imageUrl are required' });
    }

    const artworkPath = path.join(CACHE_DIR, `${appId}.jpg`);
    serverLog('debug', 'Caching artwork', 'Server', { appId, imageUrl, path: artworkPath });

    // Ensure cache directory exists
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    // Download and save the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(artworkPath, Buffer.from(buffer));
    
    serverLog('info', 'Artwork cached successfully', 'Server', { appId, path: artworkPath });
    res.json({ success: true });
  } catch (error) {
    serverLog('error', 'Failed to cache artwork', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to cache artwork' });
  }
});

// User management endpoints
app.post('/api/users', async (req, res) => {
  try {
    const { username, steamId, steamApiKey } = req.body;
    
    if (!username || !steamId || !steamApiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();

    if (config.users[username]) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Test Steam credentials before adding user
    try {
      const testUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`;
      const response = await fetch(testUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        serverLog('error', 'Invalid Steam credentials for new user', 'Server', {
          status: response.status,
          error: errorText,
          url: testUrl.replace(steamApiKey, '[REDACTED]')
        });
        return res.status(400).json({ 
          error: 'Invalid Steam credentials',
          details: `Steam API test failed: ${response.statusText}`
        });
      }

      const data = await response.json() as SteamApiResponse;
      if (!data.response || !Array.isArray(data.response.games)) {
        serverLog('error', 'Invalid response from Steam API', 'Server', { data });
        return res.status(400).json({ error: 'Invalid response from Steam API' });
      }
      
      serverLog('info', 'Steam credentials validated successfully', 'Server');
    } catch (error) {
      serverLog('error', 'Failed to validate Steam credentials for new user', 'Server', error instanceof Error ? error.message : String(error));
      return res.status(400).json({ error: 'Failed to validate Steam credentials' });
    }

    // Add the new user with original values
    config.users[username] = {
      steamId,
      steamApiKey
    };

    // Automatically select the new user
    config.currentUser = username;
    serverLog('debug', 'Automatically selecting new user', 'Server', { username });

    // Save the original config
    await configManager.saveConfig(config);
    serverLog('info', 'User added and selected successfully', 'Server', { username });

    // Return sanitized config
    const sanitizedConfig = {
      ...config,
      users: Object.fromEntries(
        Object.entries(config.users).map(([name, userData]) => [
          name,
          {
            ...userData,
            steamApiKey: '[REDACTED]'
          }
        ])
      ),
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    };

    res.json(sanitizedConfig);
  } catch (error) {
    serverLog('error', 'Failed to add user', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to add user' });
  }
});

app.delete('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const configManager = await ConfigManager.getInstance();
    const gameManager = await GameManager.getInstance();
    const config = configManager.getConfig();

    if (!config.users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If we're deleting the current user, unset it
    if (config.currentUser === username) {
      config.currentUser = undefined;
    }

    // Delete the user's games
    await gameManager.deleteUserGames(username);

    // Delete the user from config
    delete config.users[username];
    await configManager.saveConfig(config);

    // Return sanitized config
    const sanitizedConfig = {
      ...config,
      users: Object.fromEntries(
        Object.entries(config.users).map(([name, userData]) => [
          name,
          {
            ...userData,
            steamApiKey: '[REDACTED]'
          }
        ])
      ),
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    };

    serverLog('info', 'User deleted successfully', 'Server', { username });
    res.json(sanitizedConfig);
  } catch (error) {
    serverLog('error', 'Failed to delete user', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.put('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { steamId, steamApiKey, clients } = req.body;
    
    serverLog('debug', 'Received user update request', 'Server', {
      username,
      hasClients: !!clients,
      clientsData: clients,
      hasSteamId: !!steamId,
      hasSteamApiKey: !!steamApiKey
    });

    // Only require Steam credentials if they are being updated
    const isUpdatingSteam = steamId !== undefined || steamApiKey !== undefined;
    if (isUpdatingSteam && (!steamId || !steamApiKey)) {
      serverLog('error', 'Missing required fields for Steam update', 'Server', {
        hasSteamId: !!steamId,
        hasSteamApiKey: !!steamApiKey
      });
      return res.status(400).json({ error: 'Missing required fields for Steam update' });
    }

    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();

    if (!config.users[username]) {
      serverLog('error', 'User not found', 'Server', { username });
      return res.status(404).json({ error: 'User not found' });
    }

    // Get existing user data
    const existingUserData = config.users[username];
    serverLog('debug', 'Current user data', 'Server', {
      username,
      hasExistingClients: !!existingUserData.clients,
      existingClients: existingUserData.clients
    });

    // Only validate Steam credentials if they are being updated
    if (isUpdatingSteam) {
      try {
        const testUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`;
        const response = await fetch(testUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          serverLog('error', 'Invalid Steam credentials for user update', 'Server', {
            status: response.status,
            error: errorText,
            url: testUrl.replace(steamApiKey, '[REDACTED]')
          });
          return res.status(400).json({ 
            error: 'Invalid Steam credentials',
            details: `Steam API test failed: ${response.statusText}`
          });
        }

        const data = await response.json() as SteamApiResponse;
        if (!data.response || !Array.isArray(data.response.games)) {
          serverLog('error', 'Invalid response from Steam API', 'Server', { data });
          return res.status(400).json({ error: 'Invalid response from Steam API' });
        }
        
        serverLog('info', 'Steam credentials validated successfully', 'Server');
      } catch (error) {
        serverLog('error', 'Failed to validate Steam credentials for user update', 'Server', error instanceof Error ? error.message : String(error));
        return res.status(400).json({ error: 'Failed to validate Steam credentials' });
      }
    }

    // Update the user with merged data
    const updatedUserData = {
      ...existingUserData,  // Keep existing data
      ...(isUpdatingSteam ? { steamId, steamApiKey } : {}),  // Only update Steam if provided
      clients: clients || existingUserData.clients  // Use new clients if provided, otherwise keep existing
    };

    serverLog('debug', 'Updating user with new data', 'Server', { 
      username,
      hasClients: !!clients,
      updatedClients: clients,
      existingClients: existingUserData.clients,
      isUpdatingSteam
    });

    config.users[username] = updatedUserData;

    // Save the config
    await configManager.saveConfig(config);
    serverLog('info', 'User updated successfully', 'Server', { 
      username, 
      hasClients: !!config.users[username].clients,
      finalClients: config.users[username].clients,
      isUpdatingSteam
    });

    // Return sanitized config
    const sanitizedConfig = {
      ...config,
      users: Object.fromEntries(
        Object.entries(config.users).map(([name, userData]) => [
          name,
          {
            ...userData,
            steamApiKey: '[REDACTED]'
          }
        ])
      ),
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    };

    res.json(sanitizedConfig);
  } catch (error) {
    serverLog('error', 'Failed to update user', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Select user endpoint
app.post('/api/users/:username/select', async (req, res) => {
  try {
    const { username } = req.params;
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();

    if (!config.users[username]) {
      serverLog('error', 'User not found for selection', 'Server', { username });
      return res.status(404).json({ error: 'User not found' });
    }

    // Update current user
    config.currentUser = username;
    await configManager.saveConfig(config);
    
    serverLog('info', 'User selected successfully', 'Server', { username });

    // Return sanitized config
    const sanitizedConfig = {
      ...config,
      users: Object.fromEntries(
        Object.entries(config.users).map(([name, userData]) => [
          name,
          {
            ...userData,
            steamApiKey: '[REDACTED]'
          }
        ])
      ),
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    };

    res.json(sanitizedConfig);
  } catch (error) {
    serverLog('error', 'Failed to select user', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to select user' });
  }
});

// Clear logs endpoint
app.post('/api/logs/clear', async (req, res) => {
  try {
    // Clear the log file
    fs.writeFileSync(logFile, '');
    serverLog('info', 'Logs cleared successfully', 'Server');
    res.json({ success: true });
  } catch (error) {
    serverLog('error', 'Failed to clear logs', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Get unredacted SteamGridDB API key
app.get('/api/config/steamgriddb-key', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    if (!config.steamGridDbApiKey) {
      res.json({ key: '' });
    } else {
      res.json({ key: config.steamGridDbApiKey });
    }
  } catch (error) {
    serverLog('error', 'Error getting SteamGridDB API key', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

// Get unredacted Steam API key for a user
app.get('/api/users/:username/steam-key', async (req, res) => {
  try {
    const { username } = req.params;
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    
    if (!config.users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ key: config.users[username].steamApiKey });
  } catch (error) {
    serverLog('error', 'Error getting Steam API key', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

// Clear artwork cache
app.post('/api/cache/artwork/clear', (req, res) => {
  try {
    const artworkPath = path.join(CACHE_DIR, '*.jpg');
    serverLog('info', 'Clearing artwork cache', 'Server', { path: artworkPath });

    // Delete all jpg files in the cache directory
    const files = fs.readdirSync(CACHE_DIR);
    let cleared = 0;
    for (const file of files) {
      if (file.endsWith('.jpg')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
        cleared++;
      }
    }

    serverLog('info', 'Artwork cache cleared', 'Server', { filesCleared: cleared });
    res.json({ success: true, filesCleared: cleared });
  } catch (error) {
    serverLog('error', 'Failed to clear artwork cache', 'Server', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to clear artwork cache' });
  }
});

// Wolf API proxy endpoints
app.get('/api/wolf/pair/pending', async (req, res) => {
  try {
    serverLog('debug', 'Fetching pending pair requests', 'Server');
    const agent = new http.Agent({
      keepAlive: false // Disable keep-alive to ensure fresh connections
    });
    const socketPath = '/var/run/wolf/wolf.sock';
    
    // Override createConnection with proper typing and error handling
    (agent as any).createConnection = (options: http.RequestOptions, cb: (err: Error | null, socket: net.Socket) => void) => {
      const connection = net.createConnection(socketPath);
      connection.once('error', (err) => {
        serverLog('error', 'Socket connection error', 'Server', { error: err });
        connection.destroy();
        cb(err, connection);
      });
      connection.once('connect', () => {
        cb(null, connection);
      });
      return connection;
    };

    const response = await fetch('http://localhost/api/v1/pair/pending', { agent });
    const data = await response.json() as PairResponse;
    serverLog('info', 'Successfully fetched pending pair requests', 'Server', { count: data.requests?.length || 0 });
    res.json(data);
  } catch (error) {
    serverLog('error', 'Failed to fetch pending pair requests', 'Server', { error });
    res.status(500).json({ error: 'Failed to fetch pending pairs' });
  }
});

app.post('/api/wolf/pair/client', async (req, res) => {
  try {
    const { pair_secret, pin } = req.body;
    if (!pair_secret || !pin) {
      serverLog('error', 'Missing required pairing parameters', 'Server', { pair_secret: !!pair_secret, pin: !!pin });
      return res.status(400).json({ error: 'Missing pair_secret or pin' });
    }

    serverLog('debug', 'Attempting to pair client', 'Server', { pin });
    
    // Create a new agent for each request with retry logic
    const maxRetries = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const agent = new http.Agent({
          keepAlive: false // Disable keep-alive to ensure fresh connections
        });
        const socketPath = '/var/run/wolf/wolf.sock';
        
        // Override createConnection with proper typing and error handling
        (agent as any).createConnection = (options: http.RequestOptions, cb: (err: Error | null, socket: net.Socket) => void) => {
          const connection = net.createConnection(socketPath);
          connection.once('error', (err) => {
            serverLog('error', `Socket connection error (attempt ${attempt + 1})`, 'Server', { error: err });
            connection.destroy();
            cb(err, connection);
          });
          connection.once('connect', () => {
            cb(null, connection);
          });
          return connection;
        };

        const response = await fetch('http://localhost/api/v1/pair/client', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pair_secret, pin }),
          agent
        });

        const data = await response.json() as { success: boolean };
        if (data.success) {
          serverLog('info', 'Successfully paired client', 'Server', { pin });
          return res.json(data);
        } else {
          lastError = new Error('Pairing unsuccessful');
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error occurred');
        if (attempt < maxRetries - 1) {
          serverLog('warn', `Pairing attempt ${attempt + 1} failed, retrying...`, 'Server', { error });
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between retries
          continue;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  } catch (error) {
    serverLog('error', 'Error confirming pair', 'Server', { error });
    res.status(500).json({ error: 'Failed to confirm pairing' });
  }
});

// Wolf API proxy endpoints
app.get('/api/wolf/clients', async (req, res) => {
  try {
    serverLog('debug', 'Fetching client list', 'Server');
    const agent = new http.Agent({
      keepAlive: false // Disable keep-alive to ensure fresh connections
    });
    const socketPath = '/var/run/wolf/wolf.sock';
    
    // Override createConnection with proper typing and error handling
    (agent as any).createConnection = (options: http.RequestOptions, cb: (err: Error | null, socket: net.Socket) => void) => {
      const connection = net.createConnection(socketPath);
      connection.once('error', (err) => {
        serverLog('error', 'Socket connection error', 'Server', { error: err });
        connection.destroy();
        cb(err, connection);
      });
      connection.once('connect', () => {
        cb(null, connection);
      });
      return connection;
    };

    const response = await fetch('http://localhost/api/v1/clients', { agent });
    const data = await response.json() as ClientResponse;
    serverLog('info', 'Successfully fetched client list', 'Server', { count: data.clients?.length || 0 });
    res.json(data);
  } catch (error) {
    serverLog('error', 'Failed to fetch client list', 'Server', { error });
    res.status(500).json({ error: 'Failed to fetch client list' });
  }
});

// All remaining requests return the React app, so it can handle routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 