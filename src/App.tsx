import React, { useState, createContext, useEffect } from 'react';
import { Layout } from './components/Layout';
import { GameLibrary } from './components/GameLibrary';
import Configuration from './components/Configuration';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Logs } from './components/Logs';
import { TaskService, LogService } from './services';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => {},
});

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
    info: {
      main: '#58a6ff',
    },
    warning: {
      main: '#d29922',
    },
    error: {
      main: '#f85149',
    },
    success: {
      main: '#3fb950',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(130deg, #0d1117 0%, #161b22 30%, #1a1f25 70%, #21262d 100%)',
          minHeight: '100vh',
          overflowX: 'hidden',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(13, 17, 23, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'none',
          '& .MuiToolbar-root': {
            minHeight: '56px',
            padding: '0 16px',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(13, 17, 23, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRight: 'none',
          borderRadius: 0,
          '& .MuiListItemButton-root': {
            borderRadius: 4,
            margin: '4px 8px',
            padding: '8px 16px',
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
          '& .MuiListItemIcon-root': {
            minWidth: 40,
          },
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
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(22, 27, 34, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          '&.content-pane': {
            minHeight: '600px',
            padding: '24px',
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          },
          '&.log-container': {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
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
          margin: '2px 8px',
          transition: 'all 0.2s ease-in-out',
          '&.Mui-selected': {
            backgroundColor: 'rgba(30, 136, 229, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(30, 136, 229, 0.25)',
              transform: 'translateX(4px)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            transform: 'translateX(4px)',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          '&.log-item': {
            borderRadius: 8,
            marginBottom: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              transform: 'translateX(4px)',
            },
            '&.info': {
              borderLeft: '4px solid #58a6ff',
            },
            '&.warning': {
              borderLeft: '4px solid #d29922',
            },
            '&.error': {
              borderLeft: '4px solid #f85149',
            },
            '&.debug': {
              borderLeft: '4px solid #8b949e',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          height: 24,
          fontWeight: 500,
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            '&.MuiChip-colorSuccess': {
              backgroundColor: 'rgba(46, 160, 67, 0.2)',
              color: '#3fb950',
            },
            '&.MuiChip-colorError': {
              backgroundColor: 'rgba(248, 81, 73, 0.2)',
              color: '#f85149',
            },
            '&.MuiChip-colorWarning': {
              backgroundColor: 'rgba(187, 128, 9, 0.2)',
              color: '#d29922',
            },
            '&.MuiChip-colorInfo': {
              backgroundColor: 'rgba(88, 166, 255, 0.2)',
              color: '#58a6ff',
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          margin: '16px 0',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          '&.search-input': {
            backgroundColor: 'transparent',
            border: 'none',
            transition: 'all 0.2s ease-in-out',
            '& input': {
              padding: '8px 8px 8px 48px',
              color: 'rgba(255, 255, 255, 0.9)',
              '&::placeholder': {
                color: 'rgba(255, 255, 255, 0.5)',
                opacity: 1,
              },
            },
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '&.content-container': {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '24px',
          },
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
      letterSpacing: '0.5px',
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: '24px',
    },
    h6: {
      fontWeight: 500,
    },
    body1: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    body2: {
      color: 'rgba(255, 255, 255, 0.5)',
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1E88E5',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
    background: {
      default: 'transparent',
      paper: 'rgba(255, 255, 255, 0.9)',
    },
    info: {
      main: '#0288d1',
    },
    warning: {
      main: '#ed6c02',
    },
    error: {
      main: '#d32f2f',
    },
    success: {
      main: '#2e7d32',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(130deg, #f8faff 0%, #e3f2fd 30%, #bbdefb 70%, #90caf9 100%)',
          minHeight: '100vh',
          overflowX: 'hidden',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: 'none',
          color: 'rgba(0, 0, 0, 0.87)',
          '& .MuiToolbar-root': {
            minHeight: '56px',
            padding: '0 16px',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRight: 'none',
          borderRadius: 0,
          '& .MuiListItemButton-root': {
            borderRadius: 4,
            margin: '4px 8px',
            padding: '8px 16px',
            '&.Mui-selected': {
              backgroundColor: 'rgba(30, 136, 229, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(30, 136, 229, 0.2)',
              },
            },
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
          },
          '& .MuiListItemIcon-root': {
            minWidth: 40,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          border: '1px solid rgba(0, 0, 0, 0.1)',
          '&.content-pane': {
            minHeight: '600px',
            padding: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          },
          '&.log-container': {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
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
          margin: '2px 8px',
          transition: 'all 0.2s ease-in-out',
          '& .MuiListItemText-primary': {
            color: 'rgba(0, 0, 0, 0.87)',
          },
          '& .MuiListItemIcon-root': {
            color: 'rgba(0, 0, 0, 0.54)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(30, 136, 229, 0.12)',
            border: '1px solid rgba(30, 136, 229, 0.2)',
            '& .MuiListItemText-primary': {
              color: '#1E88E5',
              fontWeight: 500,
            },
            '& .MuiListItemIcon-root': {
              color: '#1E88E5',
            },
            '&:hover': {
              backgroundColor: 'rgba(30, 136, 229, 0.2)',
              transform: 'translateX(4px)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            transform: 'translateX(4px)',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          '&.log-item': {
            borderRadius: 8,
            marginBottom: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              transform: 'translateX(4px)',
            },
            '&.info': {
              borderLeft: '4px solid #0288d1',
            },
            '&.warning': {
              borderLeft: '4px solid #ed6c02',
            },
            '&.error': {
              borderLeft: '4px solid #d32f2f',
            },
            '&.debug': {
              borderLeft: '4px solid #757575',
            },
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: 'rgba(0, 0, 0, 0.87)',
          fontSize: '0.95rem',
        },
        secondary: {
          color: 'rgba(0, 0, 0, 0.6)',
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: 'rgba(0, 0, 0, 0.54)',
          minWidth: 40,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          height: 24,
          fontWeight: 500,
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            '&.MuiChip-colorSuccess': {
              backgroundColor: 'rgba(46, 125, 50, 0.12)',
              color: '#2e7d32',
            },
            '&.MuiChip-colorError': {
              backgroundColor: 'rgba(211, 47, 47, 0.12)',
              color: '#d32f2f',
            },
            '&.MuiChip-colorWarning': {
              backgroundColor: 'rgba(237, 108, 2, 0.12)',
              color: '#ed6c02',
            },
            '&.MuiChip-colorInfo': {
              backgroundColor: 'rgba(2, 136, 209, 0.12)',
              color: '#0288d1',
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(0, 0, 0, 0.1)',
          margin: '16px 0',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          '&.search-input': {
            backgroundColor: 'transparent',
            border: 'none',
            transition: 'all 0.2s ease-in-out',
            '& input': {
              padding: '8px 8px 8px 48px',
              color: 'rgba(0, 0, 0, 0.87)',
              '&::placeholder': {
                color: 'rgba(0, 0, 0, 0.4)',
                opacity: 1,
              },
            },
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          '&.app-title': {
            background: 'linear-gradient(45deg, #1565C0, #1E88E5)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 600,
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '&.content-container': {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '24px',
          },
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
      letterSpacing: '0.5px',
      color: 'rgba(0, 0, 0, 0.87)',
      marginBottom: '24px',
    },
    h6: {
      fontWeight: 500,
      color: 'rgba(0, 0, 0, 0.87)',
    },
    body1: {
      color: 'rgba(0, 0, 0, 0.87)',
    },
    body2: {
      color: 'rgba(0, 0, 0, 0.6)',
    },
  },
});

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  // Run client validation on startup
  useEffect(() => {
    const validateClients = async () => {
      try {
        await TaskService.validateClients();
      } catch (error) {
        LogService.error('Failed to validate clients on startup', error);
      }
    };
    validateClients();
  }, []);

  const themeContext = {
    isDarkMode,
    toggleTheme: () => {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    },
  };

  return (
    <ThemeContext.Provider value={themeContext}>
      <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        <Router>
          <Layout
            onSearch={setSearchQuery}
            onTabChange={(tab: string) => {
              // Handle tab changes through navigation
              if (tab === 'config/logs') {
                window.location.href = '/logs';
              } else if (tab.startsWith('config#')) {
                // For configuration sections, use hash-based navigation
                window.location.href = `/${tab}`;
              } else {
                window.location.href = `/${tab}`;
              }
            }}
            currentTab={window.location.pathname.slice(1) + window.location.hash}
          >
            <Switch>
              <Route exact path="/" render={() => <Redirect to="/library/all" />} />
              <Route 
                path="/library/all" 
                render={() => <GameLibrary searchQuery={searchQuery} libraryFilter="all" />} 
              />
              <Route 
                path="/library/steam" 
                render={() => <GameLibrary searchQuery={searchQuery} libraryFilter="steam" />} 
              />
              <Route 
                path="/config" 
                render={() => <Configuration />}
              />
              <Route 
                path="/logs" 
                render={() => <Logs />}
              />
            </Switch>
          </Layout>
        </Router>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export default App;