// MODIFY THIS FILE
'use client';

import { Box, Button, Avatar, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'next/navigation';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';

export function AuthButtons() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
    router.push('/');
  };

  if (user) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar
          onClick={handleMenu}
          sx={{ cursor: 'pointer' }}
          src={user.image}
        >
          {user.name[0]}
        </Avatar>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
          <MenuItem onClick={() => router.push(`/${user.role}/dashboard`)}>
            <DashboardIcon sx={{ mr: 1 }} /> Dashboard
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <LogoutIcon sx={{ mr: 1 }} /> Logout
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button
        variant="outlined"
        startIcon={<LoginIcon />}
        onClick={() => router.push('/login')}
      >
        Login
      </Button>
      <Button
        variant="contained"
        startIcon={<PersonAddIcon />}
        onClick={() => router.push('/register')}
      >
        Sign Up
      </Button>
    </Box>
  );
}