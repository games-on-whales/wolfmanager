import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 9971;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(join(__dirname, '../dist')));

const CACHE_DIR = '/config/cache/artwork';

// Ensure cache directory exists
app.post('/api/cache/ensure', async (req, res) => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    res.sendStatus(200);
  } catch (error) {
    console.error('Failed to create cache directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cached artwork
app.get('/api/cache/artwork/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const filePath = path.join(CACHE_DIR, `${appId}.jpg`);
    
    try {
      await fs.access(filePath);
      res.sendFile(filePath);
    } catch {
      res.status(404).send('Artwork not found in cache');
    }
  } catch (error) {
    console.error('Failed to retrieve cached artwork:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cache new artwork
app.post('/api/cache/artwork', async (req, res) => {
  try {
    const { appId, imageUrl } = req.body;
    const filePath = path.join(CACHE_DIR, `${appId}.jpg`);

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download image');
    }

    const buffer = await imageResponse.buffer();
    await fs.writeFile(filePath, buffer);

    res.sendStatus(200);
  } catch (error) {
    console.error('Failed to cache artwork:', error);
    res.status(500).json({ error: error.message });
  }
});

// Steam API proxy endpoint
app.get('/api/steam/games', async (req, res) => {
  try {
    const config = req.query;
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${config.steamApiKey}&steamid=${config.steamId}&include_appinfo=true&format=json`
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

    const response = await fetch(
      `https://www.steamgriddb.com/api/v2/games/steam/${appId}`,
      {
        headers: {
          Authorization: `Bearer ${gridDbKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`SteamGridDB API responded with ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('SteamGridDB API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// All remaining requests return the React app, so it can handle routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 