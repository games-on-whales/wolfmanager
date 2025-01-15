import express from 'express';
import cors from 'cors';
import { ConfigManager } from './config/ConfigManager';

// ... existing imports ...

app.get('/api/config', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const config = configManager.getConfig();
    console.log('Sending config to client (sensitive data redacted)', {
      ...config,
      steamApiKey: config.steamApiKey ? '[REDACTED]' : '',
      steamGridDbApiKey: config.steamGridDbApiKey ? '[REDACTED]' : ''
    });
    res.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    console.log('Received config update request');
    const configManager = await ConfigManager.getInstance();
    const newConfig = req.body;
    
    // Validate config
    if (!newConfig || typeof newConfig !== 'object') {
      console.error('Invalid config received:', newConfig);
      res.status(400).json({ error: 'Invalid configuration format' });
      return;
    }

    console.log('Saving new config (sensitive data redacted)', {
      ...newConfig,
      steamApiKey: newConfig.steamApiKey ? '[REDACTED]' : '',
      steamGridDbApiKey: newConfig.steamGridDbApiKey ? '[REDACTED]' : ''
    });

    await configManager.saveConfig(newConfig);
    console.log('Config saved successfully');
    
    // Return the new config (without sensitive data)
    res.json(configManager.getConfig());
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Update Steam API endpoint to use server-side config
app.get('/api/steam/games', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const steamApiKey = configManager.getSteamApiKey();
    const { steamId } = req.query;

    if (!steamApiKey || !steamId) {
      res.status(400).json({ error: 'Steam API key and Steam ID are required' });
      return;
    }

    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=true&format=json`
    );
    // ... rest of the endpoint
  } catch (error) {
    console.error('Steam API error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Update SteamGridDB endpoint to use server-side config
app.get('/api/steamgrid/artwork/:appId', async (req, res) => {
  try {
    const configManager = await ConfigManager.getInstance();
    const gridDbKey = configManager.getSteamGridDbApiKey();
    const { appId } = req.params;

    const response = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/steam/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${gridDbKey}`
        }
      }
    );
    // ... rest of the endpoint
  } catch (error) {
    console.error('SteamGridDB API error:', error);
    res.status(500).json({ error: error.message });
  }
}); 