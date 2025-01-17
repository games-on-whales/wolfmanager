import React, { Suspense, lazy, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { Layout } from './components/Layout';
import { GameLibrary } from './components/GameLibrary';
import { Configuration } from './components/Configuration';
import { TaskManager } from './components/TaskManager';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1E88E5',
    },
    background: {
      default: 'transparent',
      paper: 'rgba(13, 17, 23, 0.7)',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(130deg, #0d1117 0%, #161b22 30%, #1a1f25 70%, #1E88E5 100%)',
          minHeight: '100vh',
          overflowX: 'hidden',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(13, 17, 23, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(13, 17, 23, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(22, 27, 34, 0.7)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 20px -10px rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '4px 8px',
          transition: 'all 0.2s ease-in-out',
          '&.Mui-selected': {
            backgroundColor: 'rgba(30, 136, 229, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(30, 136, 229, 0.25)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 500,
    },
  },
});

// Lazy load the LogViewer component
const LogViewer = lazy(() => import('./components/LogViewer'));

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState('library');

  const renderContent = () => {
    switch (currentTab) {
      case 'library/all':
        return <GameLibrary searchQuery={searchQuery} libraryFilter="all" />;
      case 'library/steam':
        return <GameLibrary searchQuery={searchQuery} libraryFilter="steam" />;
      case 'config':
        return <Configuration />;
      case 'tasks':
        return <TaskManager />;
      case 'logs':
        return (
          <Suspense fallback={
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          }>
            <LogViewer />
          </Suspense>
        );
      default:
        return <GameLibrary searchQuery={searchQuery} libraryFilter="all" />;
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Layout onSearch={setSearchQuery} onTabChange={setCurrentTab} currentTab={currentTab}>
        {renderContent()}
      </Layout>
    </ThemeProvider>
  );
};

export default App;