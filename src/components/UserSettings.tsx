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
import { Visibility, VisibilityOff, Delete, Add, Edit } from '@mui/icons-material';
import { UserConfig } from '../types/config';
import { LogService } from '../services';

interface UserSettingsProps {
  users: Record<string, UserConfig>;
  currentUser?: string;
  onAddUser: (username: string, config: UserConfig) => Promise<void>;
  onDeleteUser: (username: string) => Promise<void>;
  onSelectUser: (username: string) => Promise<void>;
  onUpdateUser: (username: string, config: UserConfig) => Promise<void>;
}

interface UserFormState {
  username: string;
  steamId: string;
  steamApiKey: string;
}

export const UserSettings: React.FC<UserSettingsProps> = ({
  users,
  currentUser,
  onAddUser,
  onDeleteUser,
  onSelectUser,
  onUpdateUser
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSteamKey, setShowSteamKey] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    username: '',
    steamId: '',
    steamApiKey: ''
  });

  const resetForm = () => {
    setUserForm({
      username: '',
      steamId: '',
      steamApiKey: ''
    });
    setShowSteamKey(false);
  };

  const handleAddUser = async () => {
    try {
      if (!userForm.username || !userForm.steamId || !userForm.steamApiKey) {
        setShowError('All fields are required');
        return;
      }

      await onAddUser(userForm.username, {
        steamId: userForm.steamId,
        steamApiKey: userForm.steamApiKey
      });

      setShowAddDialog(false);
      resetForm();
      setShowSuccess(true);
      LogService.info('User added successfully');
    } catch (error) {
      setShowError('Failed to add user');
      LogService.error('Failed to add user', error);
    }
  };

  const handleEditUser = async () => {
    try {
      if (!editingUser || !userForm.steamId || !userForm.steamApiKey) {
        setShowError('All fields are required');
        return;
      }

      await onUpdateUser(editingUser, {
        steamId: userForm.steamId,
        steamApiKey: userForm.steamApiKey
      });

      setShowEditDialog(false);
      resetForm();
      setEditingUser(null);
      setShowSuccess(true);
      LogService.info('User updated successfully');
    } catch (error) {
      setShowError('Failed to update user');
      LogService.error('Failed to update user', error);
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

  const openEditDialog = (username: string) => {
    const user = users[username];
    setEditingUser(username);
    setUserForm({
      username,
      steamId: user.steamId,
      steamApiKey: user.steamApiKey
    });
    setShowEditDialog(true);
  };

  const handleToggleSteamKey = async () => {
    if (!showSteamKey && editingUser) {
      try {
        const response = await fetch(`/api/users/${encodeURIComponent(editingUser)}/steam-key`);
        if (!response.ok) {
          throw new Error('Failed to fetch API key');
        }
        const data = await response.json();
        setUserForm(prev => ({ ...prev, steamApiKey: data.key }));
      } catch (error) {
        LogService.error('Failed to fetch unredacted API key', error);
        setShowError('Failed to reveal API key');
        return;
      }
    }
    setShowSteamKey(!showSteamKey);
  };

  const UserFormFields = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, minWidth: 400 }}>
      {!editingUser && (
        <TextField
          label="Username"
          value={userForm.username}
          onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
          helperText="Choose a username for this user"
        />
      )}
      
      <TextField
        label="Steam ID"
        value={userForm.steamId}
        onChange={(e) => setUserForm({ ...userForm, steamId: e.target.value })}
        helperText="Steam ID for this user"
      />

      <TextField
        label="Steam API Key"
        type={showSteamKey ? 'text' : 'password'}
        value={userForm.steamApiKey}
        onChange={(e) => setUserForm({ ...userForm, steamApiKey: e.target.value })}
        helperText="API key from Steam Developer Portal"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleToggleSteamKey}
                edge="end"
              >
                {showSteamKey ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Users
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}
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
                  openEditDialog(username);
                }}
                sx={{ mr: 1 }}
              >
                <Edit />
              </IconButton>
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
          <UserFormFields />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddUser} variant="contained">Add User</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)}>
        <DialogTitle>Edit User: {editingUser}</DialogTitle>
        <DialogContent>
          <UserFormFields />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button onClick={handleEditUser} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert severity="success">Operation completed successfully!</Alert>
      </Snackbar>

      <Snackbar
        open={!!showError}
        autoHideDuration={3000}
        onClose={() => setShowError(null)}
      >
        <Alert severity="error">{showError}</Alert>
      </Snackbar>
    </Paper>
  );
}; 