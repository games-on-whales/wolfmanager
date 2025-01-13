import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 9971;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(join(__dirname, '../dist')));

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