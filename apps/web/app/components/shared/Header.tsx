'use client';

import { Box, Container, Button, Avatar, Menu, MenuItem, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'next/navigation';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import { motion } from 'framer-motion';

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();

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

  return (
    <Box
      component={motion.header}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backdropFilter: 'blur(20px)',
        background: 'rgba(255, 255, 255, 0.8)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        py: 2,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/')}
          >            <Box
              component="span"
              sx={{
                fontWeight: 800,
                fontSize: '1.25rem',
                background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              🤖 SupportHub
            </Box>
          </motion.div>

          {/* Auth Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {user ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Welcome, {user.name}
                </Typography>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Avatar
                    onClick={handleMenu}
                    sx={{ 
                      cursor: 'pointer',
                      width: 40,
                      height: 40,
                      border: `2px solid ${theme.palette.primary.main}`,
                    }}
                    src={user.picture}
                  >
                    {user.name[0]}
                  </Avatar>
                </motion.div>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    sx: {
                      mt: 1,
                      borderRadius: 2,
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(20px)',
                    },
                  }}
                >
                  <MenuItem 
                    onClick={() => {
                      router.push(`/${user.role}`);
                      handleClose();
                    }}
                    sx={{ borderRadius: 1, mx: 1, my: 0.5 }}
                  >
                    <DashboardIcon sx={{ mr: 1 }} /> Dashboard
                  </MenuItem>
                  <MenuItem 
                    onClick={handleLogout}
                    sx={{ borderRadius: 1, mx: 1, my: 0.5 }}
                  >
                    <LogoutIcon sx={{ mr: 1 }} /> Logout
                  </MenuItem>
                </Menu>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<LoginIcon />}
                    onClick={() => router.push('/login')}
                    sx={{
                      borderRadius: '25px',
                      textTransform: 'none',
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      '&:hover': {
                        borderColor: 'primary.dark',
                        backgroundColor: 'rgba(124, 58, 237, 0.04)',
                      },
                    }}
                  >
                    Login
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="contained"
                    startIcon={<PersonAddIcon />}
                    onClick={() => router.push('/register')}
                    sx={{
                      borderRadius: '25px',
                      textTransform: 'none',
                      background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #6D28D9, #059669)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Sign Up
                  </Button>
                </motion.div>
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
