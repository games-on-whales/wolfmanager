/// <reference types="react" />
/// <reference types="@mui/material" />
/// <reference types="@mui/icons-material" />

import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Alert,
  Snackbar,
  InputAdornment,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { ConfigService, WolfService } from '../services';
import { UserConfig } from '../types/config';
import { PairingDialog } from './pairing/PairingDialog';

interface UserMenuProps {
  open: boolean;
  onClose: () => void;
}

interface SteamSettings {
  steamId: string;
  steamApiKey: string;
}

export function UserMenu({ open, onClose }: UserMenuProps) {
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Record<string, UserConfig>>({});
  const [currentUser, setCurrentUser] = useState<string | undefined>();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [steamSettings, setSteamSettings] = useState<SteamSettings>({
    steamId: '',
    steamApiKey: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isPairingDialogOpen, setIsPairingDialogOpen] = useState(false);
  const [pairedClients, setPairedClients] = useState<Array<{ id: string; name: string }>>([]);

  // Load initial data
  useEffect(() => {
    loadUserData();
  }, []);

  // Update when drawer opens
  useEffect(() => {
    if (open) {
      loadUserData();
    }
  }, [open]);

  const loadUserData = () => {
    try {
      const config = ConfigService.getConfig();
      if (!config) {
        return;
      }
      
      setUsers(config.users || {});
      setCurrentUser(config.currentUser);
      setSelectedUser(config.currentUser || '');

      // Load Steam settings and paired clients for current user
      if (config.currentUser && config.users[config.currentUser]) {
        const user = config.users[config.currentUser];
        setSteamSettings({
          steamId: user.steamId || '',
          steamApiKey: user.steamApiKey || '',
        });

        // Load paired clients
        const clients = user.clients || {};
        setPairedClients(
          Object.entries(clients).map(([id, client]) => ({
            id,
            name: client.friendlyName
          }))
        );
      }
      
      setError(null);
    } catch (err) {
      if (open) {
        console.error('Failed to load user data:', err);
        setError('Failed to load user data');
      }
    }
  };

  const handleUserChange = async (event: SelectChangeEvent<string>) => {
    const username = event.target.value;
    try {
      await ConfigService.selectUser(username);
      // Reload the page to refresh all data for the new user
      window.location.reload();
    } catch (err) {
      console.error('Failed to change user:', err);
      setError('Failed to change user');
    }
  };

  const handleSteamSettingsChange = (field: keyof SteamSettings) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSteamSettings((prev: SteamSettings) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSaveSettings = async () => {
    if (!currentUser) return;

    try {
      await ConfigService.editUser(
        currentUser,
        steamSettings.steamId,
        steamSettings.steamApiKey
      );
      setIsEditing(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    }
  };

  const handleStartPairing = () => {
    setIsPairingDialogOpen(true);
  };

  const handleToggleApiKey = async () => {
    try {
      if (!showApiKey && currentUser) {
        // Fetch the unredacted key when showing
        const response = await fetch(`/api/users/${encodeURIComponent(currentUser)}/steam-key`);
        if (!response.ok) {
          throw new Error('Failed to fetch API key');
        }
        const data = await response.json();
        setSteamSettings((prev: SteamSettings) => ({
          ...prev,
          steamApiKey: data.key
        }));
      } else {
        // When hiding, replace with redacted version if not in edit mode
        if (!isEditing) {
          setSteamSettings((prev: SteamSettings) => ({
            ...prev,
            steamApiKey: '[REDACTED]'
          }));
        }
      }
      setShowApiKey(!showApiKey);
    } catch (err) {
      console.error('Failed to fetch API key:', err);
      setError('Failed to reveal API key');
    }
  };

  const handleUnpairClient = async (clientId: string) => {
    try {
      // Unpair from Wolf server
      const result = await WolfService.unpairClient(clientId);
      if (!result.success) {
        throw new Error('Failed to unpair client from Wolf server');
      }

      // Remove from local config
      if (currentUser) {
        const updatedClients = { ...users[currentUser].clients };
        delete updatedClients[clientId];
        await ConfigService.editUser(currentUser, undefined, undefined, updatedClients);
      }

      // Refresh the client list
      loadUserData();
    } catch (err) {
      console.error('Failed to unpair client:', err);
      setError('Failed to unpair client');
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: 320,
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">User Settings</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Select User</InputLabel>
          <Select
            value={selectedUser}
            onChange={handleUserChange}
            label="Select User"
          >
            {Object.entries(users).map(([username]) => (
              <MenuItem key={username} value={username}>
                {username} {username === currentUser ? '(Active)' : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="h6" sx={{ mb: 1 }}>Clients</Typography>
        <Button
          variant="contained"
          fullWidth
          onClick={handleStartPairing}
          sx={{ mb: 2 }}
        >
          PAIR
        </Button>

        <List>
          {pairedClients.length === 0 ? (
            <ListItem>
              <ListItemText primary="No paired clients" secondary="Click PAIR to add a client" />
            </ListItem>
          ) : (
            pairedClients.map((client) => (
              <ListItem key={client.id}>
                <ListItemText primary={client.name} secondary={`ID: ${client.id}`} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="unpair"
                    onClick={() => handleUnpairClient(client.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Steam Settings</Typography>
          {!isEditing && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
        </Box>

        <TextField
          fullWidth
          label="Steam ID"
          variant="outlined"
          sx={{ mb: 2 }}
          value={steamSettings.steamId}
          onChange={handleSteamSettingsChange('steamId')}
          disabled={!isEditing}
        />
        <TextField
          fullWidth
          label="Steam API Key"
          variant="outlined"
          type={showApiKey ? 'text' : 'password'}
          value={steamSettings.steamApiKey}
          onChange={handleSteamSettingsChange('steamApiKey')}
          disabled={!isEditing}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleToggleApiKey}
                  edge="end"
                  disabled={!currentUser} // Disable if no user selected
                >
                  {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {isEditing && (
          <Button
            fullWidth
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveSettings}
            sx={{ mt: 2 }}
          >
            Save Changes
          </Button>
        )}
      </Drawer>

      <PairingDialog
        open={isPairingDialogOpen}
        onClose={() => {
          setIsPairingDialogOpen(false);
          loadUserData(); // Refresh the client list when dialog closes
        }}
      />

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
} 