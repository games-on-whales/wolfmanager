import React, { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { ConfigService } from '../services/ConfigService';
import { Config, AdminConfig, UserConfig } from '../types/config';
import Logger from '../services/LogService';
import { AdminSettings } from './AdminSettings';
import { UserSettings } from './UserSettings';

export const Configuration: React.FC = () => {
  const [config, setConfig] = useState<Config>({
    libraryPath: '',
    usersPath: '',
    steamGridDbApiKey: '',
    users: {}
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        await ConfigService.loadConfig();
        const loadedConfig = ConfigService.getConfig();
        Logger.debug('Config loaded successfully', loadedConfig);
        setConfig(loadedConfig);
      } catch (error) {
        Logger.error('Failed to load config', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSaveAdmin = async (adminConfig: AdminConfig) => {
    try {
      const newConfig = {
        ...config,
        ...adminConfig
      };
      await ConfigService.saveConfig(newConfig);
      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
      Logger.info('Admin configuration saved successfully');
    } catch (error) {
      Logger.error('Failed to save admin config', error);
      throw error;
    }
  };

  const handleAddUser = async (username: string, userConfig: UserConfig) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          ...userConfig
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add user');
      }

      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
    } catch (error) {
      Logger.error('Failed to add user', error);
      throw error;
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      const response = await fetch(`/api/users/${username}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
    } catch (error) {
      Logger.error('Failed to delete user', error);
      throw error;
    }
  };

  const handleSelectUser = async (username: string) => {
    try {
      const response = await fetch(`/api/users/${username}/select`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to select user');
      }

      await ConfigService.loadConfig();
      setConfig(ConfigService.getConfig());
    } catch (error) {
      Logger.error('Failed to select user', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <AdminSettings
        config={config}
        onSave={handleSaveAdmin}
      />
      <UserSettings
        users={config.users}
        currentUser={config.currentUser}
        onAddUser={handleAddUser}
        onDeleteUser={handleDeleteUser}
        onSelectUser={handleSelectUser}
      />
    </Box>
  );
}; 