'use client';

import { Box, CircularProgress, Typography } from '@mui/material';
import { motion } from 'framer-motion';

interface LoadingAnimationProps {
  fullScreen?: boolean;
  message?: string;
}

export const LoadingAnimation = ({ 
  fullScreen = false, 
  message = 'Loading...'
}: LoadingAnimationProps) => {
  if (fullScreen) {
    return (
      <Box
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
        }}
      >
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <CircularProgress
            size={60}
            thickness={4}
            sx={{
              color: 'primary.main',
              mb: 2,
            }}
          />
        </motion.div>
        <Typography
          component={motion.p}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          variant="h6"
          sx={{
            mt: 2,
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
      }}
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 360],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <CircularProgress
          size={40}
          thickness={4}
          sx={{
            color: 'primary.main',
          }}
        />
      </motion.div>
      {message && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 2,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};