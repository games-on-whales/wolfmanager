import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { AdminConfig } from '../types/config';
import Logger from '../services/LogService';
import { SteamService } from '../services/SteamService';

interface AdminSettingsProps {
  config: AdminConfig;
  onSave: (config: AdminConfig) => Promise<void>;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ config, onSave }) => {
  const [settings, setSettings] = useState<AdminConfig>(config);
  const [showGridDbKey, setShowGridDbKey] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setShowError(null);
      await onSave(settings);
      setShowSuccess(true);
      Logger.info('Admin settings saved successfully');
    } catch (error) {
      setShowError('Failed to save admin settings');
      Logger.error('Failed to save admin settings', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshArtwork = async () => {
    try {
      setIsRefreshing(true);
      setShowError(null);
      await SteamService.refreshAllArtwork();
      setShowSuccess(true);
      Logger.info('Artwork refresh completed successfully');
    } catch (error) {
      setShowError('Failed to refresh artwork');
      Logger.error('Failed to refresh artwork', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto', mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Admin Settings
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        <TextField
          label="Library Path"
          value={settings.libraryPath}
          onChange={(e) => setSettings({ ...settings, libraryPath: e.target.value })}
          helperText="Path to your games directory"
        />

        <TextField
          label="Users Path"
          value={settings.usersPath}
          onChange={(e) => setSettings({ ...settings, usersPath: e.target.value })}
          helperText="Path where user data will be stored"
        />

        <TextField
          label="Cache Path"
          value={settings.cachePath}
          onChange={(e) => setSettings({ ...settings, cachePath: e.target.value })}
          helperText="Path where artwork and other cached files will be stored"
        />

        <TextField
          label="SteamGridDB API Key"
          type={showGridDbKey ? 'text' : 'password'}
          value={settings.steamGridDbApiKey}
          onChange={(e) => setSettings({ ...settings, steamGridDbApiKey: e.target.value })}
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

        <FormControlLabel
          control={
            <Switch
              checked={settings.debugEnabled}
              onChange={(e) => {
                setSettings({ ...settings, debugEnabled: e.target.checked });
                Logger.debug('Debug mode toggled', 'AdminSettings', { enabled: e.target.checked });
              }}
            />
          }
          label={
            <Box>
              <Typography>Debug Mode</Typography>
              <Typography variant="caption" color="text.secondary">
                Enable detailed logging for troubleshooting
              </Typography>
            </Box>
          }
        />
        
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={isSaving || isRefreshing}
          >
            {isSaving ? 'Saving...' : 'Save Admin Settings'}
          </Button>

          <Button
            variant="outlined"
            onClick={handleRefreshArtwork}
            disabled={isSaving || isRefreshing}
          >
            {isRefreshing ? 'Refreshing Artwork...' : 'Refresh Game Artwork'}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert severity="success">Admin settings saved successfully!</Alert>
      </Snackbar>

      <Snackbar
        open={!!showError}
        autoHideDuration={6000}
        onClose={() => setShowError(null)}
      >
        <Alert severity="error">{showError}</Alert>
      </Snackbar>
    </Paper>
  );
}; 