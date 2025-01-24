import React, { useState, useContext } from 'react';
import {
  Box,
  Drawer as MuiDrawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputBase,
  Collapse,
  Theme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  ExpandLess,
  ExpandMore,
  Games as SteamIcon,
  Person as PersonIcon,
  Task as TaskIcon,
  List as ListIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Settings as SettingsIcon,
  Computer as ComputerIcon,
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { ThemeContext } from '../App';
import { ThemeContextType } from '../types/theme';
import { UserMenu } from './UserMenu';

const drawerWidth = 240;

const Search = styled('div')({
  position: 'relative',
  flexGrow: 0,
  marginLeft: 'auto',
  marginRight: 'auto',
  width: '100%',
  maxWidth: '600px',
});

const SearchIconWrapper = styled('div')(({ theme }: { theme: Theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.54)',
  left: 0,
  top: 0,
  width: '48px',
  zIndex: 1
}));

const StyledInputBase = styled(InputBase)(({ theme }: { theme: Theme }) => ({
  color: 'inherit',
  width: '100%',
  height: '40px',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
  borderRadius: '4px',
  '& .MuiInputBase-input': {
    padding: '8px 8px 8px 48px',
    width: '100%',
    '&::placeholder': {
      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
      opacity: 1,
    },
  },
}));

const StyledDrawer = styled(MuiDrawer)<{ theme?: Theme }>(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    backgroundColor: theme?.palette.mode === 'dark' 
      ? 'rgba(22, 28, 36, 0.95)'
      : 'rgba(255, 255, 255, 0.95)',
    borderRight: '1px solid',
    borderColor: 'divider',
    backdropFilter: 'blur(6px)',
    transform: 'translateZ(0)',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    boxShadow: theme?.palette.mode === 'dark'
      ? '0px 8px 24px rgba(0, 0, 0, 0.4)'
      : '0px 8px 24px rgba(145, 158, 171, 0.2)',
    '& .MuiListItemButton-root': {
      borderRadius: 1,
      transform: 'translateZ(0)',
      willChange: 'transform, background-color',
      transition: 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        backgroundColor: theme?.palette.mode === 'dark'
          ? 'rgba(145, 158, 171, 0.08)'
          : 'rgba(0, 0, 0, 0.04)',
      },
      '&.Mui-selected': {
        backgroundColor: theme?.palette.mode === 'dark'
          ? 'rgba(145, 158, 171, 0.16)'
          : 'rgba(0, 0, 0, 0.08)',
        '&:hover': {
          backgroundColor: theme?.palette.mode === 'dark'
            ? 'rgba(145, 158, 171, 0.24)'
            : 'rgba(0, 0, 0, 0.12)',
        }
      }
    }
  }
}));

const StyledCollapse = styled(Collapse)({
  '& .MuiCollapse-wrapper': {
    transform: 'translateZ(0)',
    willChange: 'height',
    backfaceVisibility: 'hidden'
  }
});

export interface LayoutProps {
  children: React.ReactNode;
  onSearch?: (query: string) => void;
  onTabChange: (tab: string) => void;
  currentTab: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onSearch, onTabChange, currentTab }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [librariesOpen, setLibrariesOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext) as ThemeContextType;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLibrariesClick = () => {
    setLibrariesOpen(!librariesOpen);
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        p: 2.5,
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            background: 'linear-gradient(45deg, #1E88E5, #90CAF9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.5px'
          }}
        >
          Wolf Manager
        </Typography>
      </Box>
      <Divider sx={{ opacity: 0.1, mx: 2, mb: 1 }} />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={handleLibrariesClick}
            sx={{ mb: librariesOpen ? 1 : 0 }}
          >
            <ListItemIcon>
              <LibraryIcon sx={{ color: currentTab.startsWith('library') ? '#1E88E5' : undefined }} />
            </ListItemIcon>
            <ListItemText 
              primary="Libraries" 
              primaryTypographyProps={{
                sx: { 
                  fontWeight: currentTab.startsWith('library') ? 500 : 400,
                  color: currentTab.startsWith('library') ? '#fff' : 'rgba(255,255,255,0.7)'
                }
              }}
            />
            {librariesOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <StyledCollapse in={librariesOpen} timeout={200} unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('library/all')}
                selected={currentTab === 'library/all'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <SteamIcon sx={{ 
                    color: currentTab === 'library/all' ? '#1E88E5' : undefined,
                    opacity: 0.7,
                    fontSize: '1.2rem'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="All Games" 
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: currentTab === 'library/all' ? 500 : 400,
                      color: currentTab === 'library/all' ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('library/steam')}
                selected={currentTab === 'library/steam'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <SteamIcon sx={{ 
                    color: currentTab === 'library/steam' ? '#1E88E5' : undefined,
                    opacity: 0.7,
                    fontSize: '1.2rem'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Steam" 
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: currentTab === 'library/steam' ? 500 : 400,
                      color: currentTab === 'library/steam' ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </StyledCollapse>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => {
              setConfigOpen(!configOpen);
            }}
            sx={{ mb: configOpen ? 1 : 0 }}
          >
            <ListItemIcon>
              <SettingsIcon sx={{ color: currentTab.startsWith('config') ? '#1E88E5' : undefined }} />
            </ListItemIcon>
            <ListItemText 
              primary="Configuration"
              primaryTypographyProps={{
                sx: { 
                  fontWeight: currentTab.startsWith('config') ? 500 : 400,
                  color: currentTab.startsWith('config') ? '#fff' : 'rgba(255,255,255,0.7)'
                }
              }}
            />
            {configOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <StyledCollapse in={configOpen} timeout={200} unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('config#system')}
                selected={currentTab === 'config#system'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <ComputerIcon sx={{ 
                    color: currentTab === 'config#system' ? '#1E88E5' : undefined,
                    opacity: 0.7,
                    fontSize: '1.2rem'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="System" 
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: currentTab === 'config#system' ? 500 : 400,
                      color: currentTab === 'config#system' ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('config#users')}
                selected={currentTab === 'config#users'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <PersonIcon sx={{ 
                    color: currentTab === 'config#users' ? '#1E88E5' : undefined,
                    opacity: 0.7,
                    fontSize: '1.2rem'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Users" 
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: currentTab === 'config#users' ? 500 : 400,
                      color: currentTab === 'config#users' ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('config#tasks')}
                selected={currentTab === 'config#tasks'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <TaskIcon sx={{ 
                    color: currentTab === 'config#tasks' ? '#1E88E5' : undefined,
                    opacity: 0.7,
                    fontSize: '1.2rem'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Tasks" 
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: currentTab === 'config#tasks' ? 500 : 400,
                      color: currentTab === 'config#tasks' ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('config/logs')}
                selected={currentTab === 'logs'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <ListIcon sx={{ 
                    color: currentTab === 'logs' ? '#1E88E5' : undefined,
                    opacity: 0.7,
                    fontSize: '1.2rem'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Logs" 
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: currentTab === 'logs' ? 500 : 400,
                      color: currentTab === 'logs' ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.95rem'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </StyledCollapse>
      </List>
    </Box>
  );

  return (
    <Box 
      className="min-h-screen flex bg-[#0d1117] relative overflow-hidden"
      sx={{ display: 'flex' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a2332] via-[#0d1117] to-[#0d1117] opacity-80" />
      
      <AppBar
        position="fixed"
  sx={(theme) => ({
    width: '100%',
    background: theme.palette.mode === 'dark' 
      ? 'rgba(13, 17, 23, 0.8)' 
      : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'none',
    borderBottom: '1px solid',
    borderColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)',
    zIndex: theme.zIndex.drawer + 1
  })}
      >
        <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {onSearch && (
              <Search>
                <SearchIconWrapper>
                  <SearchIcon />
                </SearchIconWrapper>
                <StyledInputBase
                  placeholder="Search games..."
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
                />
              </Search>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => setUserMenuOpen(true)} color="inherit">
              <PersonIcon />
            </IconButton>
            <IconButton onClick={toggleTheme} color="inherit">
              {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <StyledDrawer
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        sx={{
          '& .MuiDrawer-paper': {
            width: drawerWidth,
          },
        }}
      >
        {drawer}
      </StyledDrawer>

      <Box
        component="main"
        className="relative z-1"
        sx={{
          flexGrow: 1,
          p: 3,
          minHeight: '100vh',
          background: 'transparent',
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <UserMenu
        open={userMenuOpen}
        onClose={() => setUserMenuOpen(false)}
      />
    </Box>
  );
}; 