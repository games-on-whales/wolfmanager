import React, { useState } from 'react';
import {
  Box,
  Drawer,
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings as SettingsIcon,
  SportsEsports as GamesIcon,
  Search as SearchIcon,
  ExpandLess,
  ExpandMore,
  Games as SteamIcon,
} from '@mui/icons-material';
import { Configuration } from './Configuration';
import { styled } from '@mui/material/styles';

const drawerWidth = 240;

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

export interface LayoutProps {
  children: React.ReactNode;
  onSearch: (query: string) => void;
  onTabChange: (tab: string) => void;
  currentTab: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, onSearch, onTabChange, currentTab }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [librariesOpen, setLibrariesOpen] = useState(true);

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
              <GamesIcon sx={{ color: currentTab.startsWith('library') ? '#1E88E5' : undefined }} />
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
        <Collapse in={librariesOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => onTabChange('library/all')}
                selected={currentTab === 'library/all'}
                sx={{ pl: 4 }}
              >
                <ListItemIcon>
                  <GamesIcon sx={{ 
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
        </Collapse>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => onTabChange('config')}
            selected={currentTab === 'config'}
          >
            <ListItemIcon>
              <SettingsIcon sx={{ color: currentTab === 'config' ? '#1E88E5' : undefined }} />
            </ListItemIcon>
            <ListItemText 
              primary="Configuration"
              primaryTypographyProps={{
                sx: { 
                  fontWeight: currentTab === 'config' ? 500 : 400,
                  color: currentTab === 'config' ? '#fff' : 'rgba(255,255,255,0.7)'
                }
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search games…"
              inputProps={{ 'aria-label': 'search' }}
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </Search>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton color="inherit" onClick={() => onTabChange('config')}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
        }}
      >
        {currentTab === 'config' ? <Configuration /> : children}
      </Box>
    </Box>
  );
}; 