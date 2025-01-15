import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Tabs, Tab } from '@mui/material';
import { ConfigService, LogService } from '../services';
import { Config, AdminConfig, UserConfig } from '../types/config';
import { AdminSettings } from './AdminSettings';
import { UserSettings } from './UserSettings';
import { TaskManager } from './TaskManager';
import { LogViewer } from './LogViewer';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const Configuration: React.FC = () => {
  const [config, setConfig] = useState<Config>({
    libraryPath: '',
    usersPath: '',
    cachePath: '/config/cache/artwork',
    steamGridDbApiKey: '',
    debugEnabled: false,
    users: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        await ConfigService.loadConfig();
        const loadedConfig = ConfigService.getConfig();
        LogService.debug('Config loaded successfully', 'Configuration', loadedConfig);
        setConfig(loadedConfig);
      } catch (error) {
        LogService.error('Failed to load config', error, 'Configuration');
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
      LogService.info('Admin configuration saved successfully');
    } catch (error) {
      LogService.error('Failed to save admin config', error);
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
      LogService.error('Failed to add user', error);
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
      LogService.error('Failed to delete user', error);
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
      LogService.error('Failed to select user', error);
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
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_event, newValue: number) => setCurrentTab(newValue)}>
          <Tab label="Admin" />
          <Tab label="Users" />
          <Tab label="Tasks" />
          <Tab label="Logs" />
        </Tabs>
      </Box>

      <TabPanel value={currentTab} index={0}>
        <AdminSettings
          config={config}
          onSave={handleSaveAdmin}
        />
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <UserSettings
          users={config.users}
          currentUser={config.currentUser}
          onAddUser={handleAddUser}
          onDeleteUser={handleDeleteUser}
          onSelectUser={handleSelectUser}
        />
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <TaskManager />
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        <LogViewer />
      </TabPanel>
    </Box>
  );
}; 