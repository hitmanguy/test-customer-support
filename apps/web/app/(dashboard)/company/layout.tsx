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
  alpha,
  Paper
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Storage as KnowledgeBaseIcon,
  Notifications as NotificationIcon,
  Business as CompanyIcon,
  Person as ProfileIcon,
  ExitToApp as LogoutIcon,
  Support as SupportIcon,
  AutoAwesome as AIIcon
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
  description?: string;
}

export default function CompanyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading state
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const menuItems: MenuItem[] = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/company',
      description: 'Overview & Management'
    },
    {
      text: 'Analytics',
      icon: <AnalyticsIcon />,
      path: '/company/analytics',
      description: 'Performance Metrics'
    },
    {
      text: 'AI Trends',
      icon: <TrendingUpIcon />,
      path: '/company/trends',
      badge: 2,
      description: 'Trend Analysis & Insights'
    },
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: alpha('#ffffff', 0.1)
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <CompanyIcon sx={{ mr: 1, fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold">
              Company Portal
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {user?.name || 'Manage your business'}
          </Typography>
        </Box>
      </Paper>

      {/* Navigation */}
      <Box sx={{ flex: 1, p: 2 }}>
        <List sx={{ p: 0 }}>
          {menuItems.map((item, index) => (
            <motion.div
              key={item.text}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ListItem
                disablePadding
                sx={{
                  mb: 1,
                }}
              >
                <Box
                  component="div"
                  sx={{
                    width: '100%',
                    borderRadius: 3,
                    bgcolor: pathname === item.path 
                      ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`
                      : 'transparent',
                    border: pathname === item.path 
                      ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                      : '1px solid transparent',
                    '&:hover': {
                      bgcolor: pathname === item.path
                        ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`
                        : alpha(theme.palette.action.hover, 0.04),
                      transform: 'translateX(4px)',
                      transition: 'all 0.2s ease-in-out'
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    p: 2,
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onClick={() => {
                    router.push(item.path);
                    setMobileOpen(false);
                  }}
                >
                  <Box display="flex" alignItems="center" width="100%">
                    <ListItemIcon 
                      sx={{ 
                        color: pathname === item.path ? theme.palette.primary.main : 'inherit',
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
                    <Box flex={1}>
                      <Typography 
                        variant="body1"
                        fontWeight={pathname === item.path ? 600 : 500}
                        color={pathname === item.path ? 'primary.main' : 'inherit'}
                      >
                        {item.text}
                      </Typography>
                      {item.description && (
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {item.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </ListItem>
            </motion.div>
          ))}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2 }}>
        <Paper 
          elevation={0}
          sx={{ 
            p: 2, 
            bgcolor: alpha(theme.palette.info.main, 0.05),
            border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Box display="flex" alignItems="center" mb={1}>
            <AIIcon sx={{ mr: 1, color: theme.palette.info.main, fontSize: 20 }} />
            <Typography variant="caption" fontWeight="bold">
              AI Assistant
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Your AI is actively learning from your knowledge base
          </Typography>
        </Paper>
      </Box>
    </Box>
  );

  if (loading) {
    return <LoadingAnimation fullScreen message="Loading Company Dashboard..." />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          backdropFilter: 'blur(10px)',
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center">
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" color="text.primary" fontWeight={600}>
              {pathname === '/company' && 'Dashboard Overview'}
              {pathname === '/company/analytics' && 'Analytics & Performance'}
              {pathname === '/company/trends' && 'AI Trends & Insights'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              <Badge badgeContent={3} color="error">
                <NotificationIcon />
              </Badge>
            </IconButton>
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                p: 1,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                '&:hover': { 
                  bgcolor: alpha(theme.palette.action.hover, 0.04),
                  borderColor: alpha(theme.palette.primary.main, 0.2)
                },
                transition: 'all 0.2s ease'
              }}
            >
              <Avatar
                src={user?.image}
                alt={user?.name}
                sx={{ 
                  width: 36, 
                  height: 36,
                  bgcolor: theme.palette.primary.main,
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                {(user?.name || 'C')?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Typography variant="subtitle2" color="text.primary">
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Company Admin
                </Typography>
              </Box>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile Drawer */}
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
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              bgcolor: 'background.paper',
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { 
            width: 220, 
            mt: 1,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <MenuItem 
          onClick={() => {
            router.push('/company/profile');
            setAnchorEl(null);
          }}
          sx={{ borderRadius: 1, mx: 1, my: 0.5 }}
        >
          <ListItemIcon>
            <ProfileIcon fontSize="small" />
          </ListItemIcon>
          Company Profile
        </MenuItem>
        <MenuItem 
          onClick={() => {
            logout();
            router.push('/login');
          }}
          sx={{ borderRadius: 1, mx: 1, my: 0.5, color: 'error.main' }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Main Content */}
      <Box
        component={motion.main}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          mt: 8,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
        }}
      >
        <ProtectedRoute requiredRole="company">
          {children}
        </ProtectedRoute>
      </Box>
    </Box>
  );
}
