import React from 'react';
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Typography
} from '@mui/material';
import { UserConfig } from '../types/config';

interface UserSelectorProps {
  users: Record<string, UserConfig>;
  currentUser?: string;
  onSelectUser: (username: string) => Promise<void>;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  users,
  currentUser,
  onSelectUser
}) => {
  const handleChange = async (event: SelectChangeEvent<string>) => {
    const username = event.target.value;
    await onSelectUser(username);
  };

  if (Object.keys(users).length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="inherit">
        User:
      </Typography>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={currentUser || ''}
          onChange={handleChange}
          displayEmpty
          sx={{ 
            bgcolor: 'background.paper',
            '& .MuiSelect-select': { py: 1 }
          }}
        >
          <MenuItem value="" disabled>
            Select User
          </MenuItem>
          {Object.keys(users).map(username => (
            <MenuItem key={username} value={username}>
              {username}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}; 