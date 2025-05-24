'use client';

import { Box, Container, Typography, Button, useTheme, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useAuth } from '../../hooks/useAuth';
import Link from 'next/link';

export const CTASection = () => {
  const theme = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true
  });

  const getDashboardLink = () => {
    if (!user?.role) return '/';
    return `/${user.role}/dashboard`;
  };

  return (
    <Box
      sx={{
        py: 15,
        position: 'relative',
        overflow: 'hidden',
        background: theme.palette.background.paper
      }}
    >
      {/* Animated background elements */}
      <Box
        component={motion.div}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        sx={{
          position: 'absolute',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
          filter: 'blur(80px)',
          top: '-20%',
          right: '-20%',
          zIndex: 0,
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Paper
          component={motion.div}
          ref={ref}
          initial={{ y: 50, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : {}}
          elevation={0}
          sx={{
            p: { xs: 4, md: 8 },
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            <Box sx={{ textAlign: { xs: 'center', md: 'left' }, flex: 1 }}>
              <Typography
                variant="h2"
                component={motion.h2}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 }}
                sx={{
                  mb: 2,
                  fontWeight: 800,
                  background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {isAuthenticated 
                  ? 'Ready to Continue?' 
                  : 'Ready to Transform Your Support?'}
              </Typography>
              
              <Typography
                variant="h5"
                component={motion.p}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 }}
                sx={{
                  color: 'text.secondary',
                  mb: { xs: 4, md: 0 },
                }}
              >
                {isAuthenticated 
                  ? 'Return to your dashboard and continue managing your support system.'
                  : 'Join thousands of businesses providing exceptional customer support with AI.'}
              </Typography>
            </Box>

            <Box
              component={motion.div}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.4 }}
            >
              <Link 
                href={isAuthenticated ? getDashboardLink() : '/register'}
                style={{ textDecoration: 'none' }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<RocketLaunchIcon />}
                  sx={{
                    py: 2,
                    px: 6,
                    borderRadius: '100px',
                    background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                    fontSize: '1.2rem',
                    textTransform: 'none',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                </Button>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};