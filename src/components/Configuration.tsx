import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { ConfigService } from '../services/ConfigService';
import { Config } from '../types/config';

export const Configuration: React.FC = () => {
  const [config, setConfig] = useState<Config>({
    steamId: '',
    libraryPath: '',
    steamApiKey: '',
    steamGridDbApiKey: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSteamKey, setShowSteamKey] = useState(false);
  const [showGridDbKey, setShowGridDbKey] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      await ConfigService.saveConfig(config);
      setShowSuccess(true);
    } catch (error) {
      // ... error handling
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Configuration
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        <TextField
          label="Steam ID"
          value={config.steamId}
          onChange={(e) => setConfig({ ...config, steamId: e.target.value })}
          helperText="Your Steam ID is required to fetch your game library"
        />
        
        <TextField
          label="Steam API Key"
          type={showSteamKey ? 'text' : 'password'}
          value={config.steamApiKey}
          onChange={(e) => setConfig({ ...config, steamApiKey: e.target.value })}
          helperText="API key from Steam Developer Portal"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowSteamKey(!showSteamKey)}
                  edge="end"
                >
                  {showSteamKey ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="SteamGridDB API Key"
          type={showGridDbKey ? 'text' : 'password'}
          value={config.steamGridDbApiKey}
          onChange={(e) => setConfig({ ...config, steamGridDbApiKey: e.target.value })}
          helperText="API key from SteamGridDB"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowGridDbKey(!showGridDbKey)}
                  edge="end"
                >
                  {showGridDbKey ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        
        <TextField
          label="Library Path"
          value={config.libraryPath}
          onChange={(e) => setConfig({ ...config, libraryPath: e.target.value })}
          helperText="Path to your games directory"
        />
        
        <Button 
          variant="contained" 
          onClick={handleSave}
          sx={{ mt: 2 }}
        >
          Save Configuration
        </Button>
      </Box>

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert severity="success">Configuration saved successfully!</Alert>
      </Snackbar>
    </Paper>
  );
}; 