import React, { useState, useEffect, ChangeEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { ConfigService, LogService } from '../services';
import { AdminConfig, Config, UserConfig } from '../types/config';
import { TaskManager } from './TaskManager';

interface NewUserConfig {
  steamId: string;
  steamApiKey: string;
}

type TextFieldElement = HTMLInputElement | HTMLTextAreaElement;

export default function Configuration(): JSX.Element {
  const location = useLocation();
  const [config, setConfig] = useState<Config>({
    libraryPath: '',
    usersPath: '',
    cachePath: '/config/cache/artwork',
    steamGridDbApiKey: '',
    debugEnabled: false,
    users: {},
    currentUser: ''
  });
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState('');
  const [newUserConfig, setNewUserConfig] = useState<NewUserConfig>({
    steamId: '',
    steamApiKey: ''
  });
  const [editUserConfig, setEditUserConfig] = useState<NewUserConfig>({
    steamId: '',
    steamApiKey: ''
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        await ConfigService.loadConfig();
        const loadedConfig = ConfigService.getConfig();
        LogService.debug('Config loaded successfully', 'Configuration', loadedConfig);
        setConfig(loadedConfig);
      } catch (error) {
        LogService.error('Failed to load config', error, 'Configuration');
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    // Scroll to the selected section when the hash changes
    const sectionId = location.hash.slice(1); // Remove the # from the hash
    if (sectionId) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  const handleSaveAdmin = async (adminConfig: AdminConfig) => {
    try {
      const newConfig = {
        ...config,
        ...adminConfig
      };
      await ConfigService.saveConfig(newConfig);
      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
      LogService.info('Admin configuration saved successfully');
    } catch (error) {
      LogService.error('Failed to save admin config', error);
      throw error;
    }
  };

  const handleAddUser = async (username: string, userConfig: NewUserConfig) => {
    try {
      LogService.debug('Adding new user', 'Configuration', { username });
      await ConfigService.addUser(username, userConfig.steamId, userConfig.steamApiKey);
      LogService.debug('User added, updating state', 'Configuration');
      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
      setAddUserDialogOpen(false);
      setNewUsername('');
      setNewUserConfig({ steamId: '', steamApiKey: '' });
      LogService.info('User added successfully', 'Configuration');
    } catch (error) {
      LogService.error('Failed to add user', error);
      let message = 'Failed to add user';
      if (error instanceof Error) {
        if (error.message.includes('Missing required fields')) {
          message = 'Please fill in all required fields';
        } else if (error.message.includes('Invalid Steam credentials')) {
          message = 'Invalid Steam credentials. Please check your Steam ID and API key';
        } else if (error.message.includes('User already exists')) {
          message = 'A user with this username already exists';
        } else if (error.message.includes('Invalid response from Steam API')) {
          message = 'Invalid response from Steam API. Please check your credentials';
        }
      }
      setErrorMessage(message);
      throw error;
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      LogService.debug('Deleting user', 'Configuration', { username });
      await ConfigService.deleteUser(username);
      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
      LogService.info('User deleted successfully', 'Configuration');
    } catch (error) {
      LogService.error('Failed to delete user', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete user');
      throw error;
    }
  };

  const handleSelectUser = async (username: string) => {
    try {
      LogService.debug('Selecting user', 'Configuration', { username });
      await ConfigService.selectUser(username);
      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
      LogService.info('User selected successfully', 'Configuration');
    } catch (error) {
      LogService.error('Failed to select user', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to select user');
      throw error;
    }
  };

  const handleEditUser = async (username: string, userConfig: NewUserConfig) => {
    try {
      await ConfigService.editUser(username, userConfig.steamId, userConfig.steamApiKey);
      setEditUserDialogOpen(false);
      setEditingUsername('');
      setEditUserConfig({ steamId: '', steamApiKey: '' });
      setConfig(ConfigService.getConfig());
    } catch (error) {
      LogService.error('Failed to edit user', error);
      let message = 'Failed to edit user';
      if (error instanceof Error) {
        if (error.message.includes('Invalid Steam credentials')) {
          message = 'Invalid Steam credentials. Please check your Steam ID and API key';
        } else if (error.message.includes('Invalid response from Steam API')) {
          message = 'Invalid response from Steam API. Please check your credentials';
        }
      }
      setErrorMessage(message);
      throw error;
    }
  };

  const openEditDialog = async (username: string) => {
    try {
      LogService.debug('Opening edit dialog for user', 'Configuration', { username });
      const user = config.users[username];
      // Fetch the unredacted Steam API key
      const response = await fetch(`/api/users/${encodeURIComponent(username)}/steam-key`);
      if (!response.ok) {
        throw new Error('Failed to fetch Steam API key');
      }
      const { key: steamApiKey } = await response.json();
      
      LogService.debug('Setting edit dialog state', 'Configuration', { username, steamId: user.steamId });
      setEditingUsername(username);
      setEditUserConfig({
        steamId: user.steamId,
        steamApiKey
      });
      setEditUserDialogOpen(true);
    } catch (error) {
      LogService.error('Failed to open edit dialog', error);
      throw error; // Re-throw to be caught by the click handler
    }
  };

  const handleTextFieldChange = (
    e: ChangeEvent<TextFieldElement>,
    setter: (value: string) => void
  ) => {
    setter(e.target.value);
  };

  const handleUserConfigChange = (
    e: ChangeEvent<TextFieldElement>,
    field: keyof NewUserConfig,
    config: NewUserConfig,
    setter: (config: NewUserConfig) => void
  ) => {
    setter({ ...config, [field]: e.target.value });
  };

  const handleSwitchChange = (_e: ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setConfig((prev: Config) => ({ ...prev, debugEnabled: checked }));
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 4,
      maxWidth: '800px',
      margin: '0 auto',
      pb: 4
    }}>
      <Paper className="content-pane" id="system">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h1">System</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Configure system-wide settings and paths
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Library Path</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Path to your games directory
            </Typography>
            <TextField
              fullWidth
              value={config.libraryPath}
              onChange={(e: ChangeEvent<TextFieldElement>) => setConfig({ ...config, libraryPath: e.target.value })}
              variant="outlined"
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Users Path</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Path where user data will be stored
            </Typography>
            <TextField
              fullWidth
              value={config.usersPath}
              onChange={(e: ChangeEvent<TextFieldElement>) => setConfig({ ...config, usersPath: e.target.value })}
              variant="outlined"
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Cache Path</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Path where artwork and other cached files will be stored
            </Typography>
            <TextField
              fullWidth
              value={config.cachePath}
              onChange={(e: ChangeEvent<TextFieldElement>) => setConfig({ ...config, cachePath: e.target.value })}
              variant="outlined"
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>SteamGridDB API Key</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              API key from SteamGridDB
            </Typography>
            <TextField
              fullWidth
              type="password"
              value={config.steamGridDbApiKey}
              onChange={(e: ChangeEvent<TextFieldElement>) => setConfig({ ...config, steamGridDbApiKey: e.target.value })}
              variant="outlined"
              size="small"
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={config.debugEnabled}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleSwitchChange(e, e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2">Debug Mode</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Enable detailed logging for troubleshooting
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSaveAdmin(config)}
            >
              Save Settings
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper className="content-pane" id="users">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2">Users</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage user accounts and permissions
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Steam User ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Object.entries(config.users) as [string, UserConfig][]).map(([username, userConfig]) => (
                  <TableRow key={username}>
                    <TableCell>{username}</TableCell>
                    <TableCell>{userConfig.steamId}</TableCell>
                    <TableCell>
                      {config.currentUser === username && (
                        <Chip 
                          size="small" 
                          label="Active"
                          color="success"
                          icon={<CheckIcon />}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={() => {
                          handleSelectUser(username)
                            .catch(error => {
                              LogService.error('Failed to handle select user', error);
                              // Error message is already set in handleSelectUser
                            });
                        }}
                        disabled={config.currentUser === username}
                      >
                        <CheckIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          openEditDialog(username)
                            .catch(error => {
                              LogService.error('Failed to handle edit click', error);
                              setErrorMessage('Failed to open edit dialog');
                            });
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          handleDeleteUser(username)
                            .catch(error => {
                              LogService.error('Failed to handle delete user', error);
                              // Error message is already set in handleDeleteUser
                            });
                        }}
                        disabled={config.currentUser === username}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setAddUserDialogOpen(true)}
            >
              Add User
            </Button>
          </Box>
        </Box>

        <Dialog open={addUserDialogOpen} onClose={() => setAddUserDialogOpen(false)}>
          <DialogTitle>Add New User</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <TextField
                label="Username"
                value={newUsername}
                onChange={(e: ChangeEvent<TextFieldElement>) => handleTextFieldChange(e, setNewUsername)}
                fullWidth
              />
              <TextField
                label="Steam ID"
                value={newUserConfig.steamId}
                onChange={(e: ChangeEvent<TextFieldElement>) => handleUserConfigChange(e, 'steamId', newUserConfig, setNewUserConfig)}
                fullWidth
              />
              <TextField
                label="Steam API Key"
                value={newUserConfig.steamApiKey}
                onChange={(e: ChangeEvent<TextFieldElement>) => handleUserConfigChange(e, 'steamApiKey', newUserConfig, setNewUserConfig)}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setAddUserDialogOpen(false);
            }}>Cancel</Button>
            <Button
              onClick={() => {
                LogService.debug('Add user button clicked', 'Configuration', { username: newUsername });
                handleAddUser(newUsername, newUserConfig)
                  .catch(error => {
                    LogService.error('Failed to handle add user', error);
                    // Error message is already set in handleAddUser
                  });
              }}
              variant="contained"
              color="primary"
              disabled={!newUsername || !newUserConfig.steamId || !newUserConfig.steamApiKey}
            >
              Add User
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editUserDialogOpen} onClose={() => setEditUserDialogOpen(false)}>
          <DialogTitle>Edit User: {editingUsername}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <TextField
                label="Steam ID"
                value={editUserConfig.steamId}
                onChange={(e: ChangeEvent<TextFieldElement>) => handleUserConfigChange(e, 'steamId', editUserConfig, setEditUserConfig)}
                fullWidth
              />
              <TextField
                label="Steam API Key"
                value={editUserConfig.steamApiKey}
                onChange={(e: ChangeEvent<TextFieldElement>) => handleUserConfigChange(e, 'steamApiKey', editUserConfig, setEditUserConfig)}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              setEditUserDialogOpen(false);
            }}>Cancel</Button>
            <Button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  handleEditUser(editingUsername, editUserConfig).catch(error => {
                    LogService.error('Failed to edit user', error);
                  });
                } catch (error) {
                  LogService.error('Failed to edit user', error);
                }
              }}
              variant="contained"
              color="primary"
              disabled={!editUserConfig.steamId || !editUserConfig.steamApiKey}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>

      <Paper className="content-pane" id="tasks">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2">Tasks</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Monitor and manage background tasks and operations
          </Typography>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 3
        }}>
          <TaskManager />
        </Box>
      </Paper>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorMessage(null)} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
} 