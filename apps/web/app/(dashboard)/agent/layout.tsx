'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  Divider,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ReceiptLong as TicketIcon,
  Extension as CopilotIcon,
  Dashboard as DashboardIcon,
  Person as ProfileIcon,
  ExitToApp as LogoutIcon,
  Notifications as NotificationIcon,
} from '@mui/icons-material';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@web/app/store/authStore';
import { LoadingAnimation } from '@web/app/components/shared/LoadingAnimation';
import ProtectedRoute from '@web/app/components/shared/ProtectedRoute';

const DRAWER_WIDTH = 280;

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

export default function AgentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);
  const menuItems: MenuItem[] = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/agent',
    },
    {
      text: 'Active Tickets',
      icon: <TicketIcon />,
      path: '/agent/tickets',
      badge: 5,
    },
    {
      text: 'AI Copilot',
      icon: <CopilotIcon />,
      path: '/agent/copilot',
    },
  ];

  const drawer = (
    <Box>
      <Toolbar sx={{ px: 2 }}>
        <Typography
          variant="h6"
          sx={{
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontWeight: 700,
          }}
        >
          Agent Portal
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            sx={{
              borderRadius: 2,
              mx: 1,
              my: 0.5,
            }}
          >
            <Box
              component="div"
              sx={{
                width: '100%',
                borderRadius: 2,
                bgcolor: pathname === item.path ? 'rgba(124, 58, 237, 0.08)' : 'inherit',
                '&:hover': {
                  bgcolor: pathname === item.path
                    ? 'rgba(124, 58, 237, 0.12)'
                    : 'action.hover',
                },
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                px: 2,
                py: 1,
              }}
              onClick={() => {
                router.push(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: pathname === item.path ? '#7C3AED' : 'inherit',
                  minWidth: 40,
                }}
              >
                {item.badge ? (
                  <Badge badgeContent={item.badge} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                sx={{
                  '& .MuiTypography-root': {
                    fontWeight: pathname === item.path ? 600 : 400,
                    color: pathname === item.path ? '#7C3AED' : 'inherit',
                  },
                }}
              />
            </Box>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  if (loading) {
    return <LoadingAnimation fullScreen message="Loading Dashboard..." />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton>
              <Badge badgeContent={4} color="error">
                <NotificationIcon />
              </Badge>
            </IconButton>
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                p: 1,
                borderRadius: 2,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar
                src={user?.image}
                alt={user?.name}
                sx={{ width: 32, height: 32 }}
              />
              <Typography variant="subtitle2">
                {user?.name}
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { width: 200, mt: 1 }
        }}
      >
        <MenuItem onClick={() => router.push('/agent/profile')}>
          <ListItemIcon>
            <ProfileIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => {
          router.push('/login');
          logout();
        }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>      <Box
        component={motion.main}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          mt: 8,
        }}
      >
        <ProtectedRoute requiredRole="agent">
          {children}
        </ProtectedRoute>
      </Box>
    </Box>
  );
}
