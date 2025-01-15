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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Visibility, VisibilityOff, Delete, Add } from '@mui/icons-material';
import { UserConfig } from '../types/config';
import { LogService } from '../services';

interface UserSettingsProps {
  users: Record<string, UserConfig>;
  currentUser?: string;
  onAddUser: (username: string, config: UserConfig) => Promise<void>;
  onDeleteUser: (username: string) => Promise<void>;
  onSelectUser: (username: string) => Promise<void>;
}

export const UserSettings: React.FC<UserSettingsProps> = ({
  users,
  currentUser,
  onAddUser,
  onDeleteUser,
  onSelectUser
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSteamKey, setShowSteamKey] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    steamId: '',
    steamApiKey: ''
  });

  const handleAddUser = async () => {
    try {
      if (!newUser.username || !newUser.steamId || !newUser.steamApiKey) {
        setShowError('All fields are required');
        return;
      }

      await onAddUser(newUser.username, {
        steamId: newUser.steamId,
        steamApiKey: newUser.steamApiKey
      });

      setShowAddDialog(false);
      setNewUser({ username: '', steamId: '', steamApiKey: '' });
      setShowSuccess(true);
      LogService.info('User added successfully');
    } catch (error) {
      setShowError('Failed to add user');
      LogService.error('Failed to add user', error);
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      await onDeleteUser(username);
      setShowSuccess(true);
      LogService.info('User deleted successfully');
    } catch (error) {
      setShowError('Failed to delete user');
      LogService.error('Failed to delete user', error);
    }
  };

  const handleSelectUser = async (username: string) => {
    try {
      await onSelectUser(username);
      setShowSuccess(true);
      LogService.info('User selected successfully');
    } catch (error) {
      setShowError('Failed to select user');
      LogService.error('Failed to select user', error);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Users
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setShowAddDialog(true)}
        >
          Add User
        </Button>
      </Box>

      <List>
        {Object.entries(users).map(([username, user]) => (
          <ListItem
            key={username}
            selected={username === currentUser}
            onClick={() => handleSelectUser(username)}
            sx={{ cursor: 'pointer' }}
          >
            <ListItemText
              primary={username}
              secondary={`Steam ID: ${user.steamId}`}
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteUser(username);
                }}
              >
                <Delete />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, minWidth: 400 }}>
            <TextField
              label="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              helperText="Choose a username for this user"
            />
            
            <TextField
              label="Steam ID"
              value={newUser.steamId}
              onChange={(e) => setNewUser({ ...newUser, steamId: e.target.value })}
              helperText="Steam ID for this user"
            />

            <TextField
              label="Steam API Key"
              type={showSteamKey ? 'text' : 'password'}
              value={newUser.steamApiKey}
              onChange={(e) => setNewUser({ ...newUser, steamApiKey: e.target.value })}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddUser} variant="contained">Add User</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert severity="success">Operation completed successfully!</Alert>
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