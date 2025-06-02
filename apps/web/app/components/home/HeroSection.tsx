'use client';

import { Box, Container, Typography, Button, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Bot3D } from './Bot3D';

export const HeroSection = () => {
  const theme = useTheme();

  return (    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: `linear-gradient(180deg, 
          ${theme.palette.background.default} 0%, 
          ${theme.palette.background.paper} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 10, md: 12 }, // Add padding top to account for fixed header
      }}
    >
      {/* Animated background elements */}
      <Box
        component={motion.div}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.2, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        sx={{
          position: 'absolute',
          width: '40vw',
          height: '40vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
          filter: 'blur(60px)',
          top: '-20%',
          right: '-10%',
        }}
      />

      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  fontWeight: 800,
                  mb: 2,
                  background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                AI-Powered Support
                <br />
                Made Simple
              </Typography>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Typography
                variant="h5"
                sx={{
                  color: 'text.secondary',
                  mb: 4,
                  maxWidth: 600,
                }}
              >
                Transform your customer service with intelligent automation.
                Reduce response time, increase satisfaction, and scale your support
                effortlessly.
              </Typography>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<AutoAwesomeIcon />}
                sx={{
                  py: 2,
                  px: 4,
                  borderRadius: '100px',
                  background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  '&:hover': {
                    transform: 'scale(1.05)',
                  },
                }}
              >
                Get Started Now
              </Button>
            </motion.div>
          </Box>          {/* Hero Image/Animation */}
          <Box
            component={motion.div}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 1 }}
            sx={{
              flex: 1,
              display: { xs: 'none', md: 'block' },
            }}
          >
            <Bot3D />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};