'use client';

import React, { ErrorInfo } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { RefreshOutlined } from '@mui/icons-material';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Default fallback component
const ErrorFallback = ({ error }: { error: Error | null }) => {
  const router = useRouter();
  
  const handleRetry = () => {
    window.location.reload();
  };
  
  const handleGoBack = () => {
    router.back();
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        p: 3,
        bgcolor: 'background.default'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper 
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 500,
            textAlign: 'center',
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography 
            variant="h5" 
            component="h2" 
            gutterBottom
            sx={{ 
              color: 'error.main',
              fontWeight: 600,
              mb: 2
            }}
          >
            Something went wrong
          </Typography>
          
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            We apologize for the inconvenience. The application encountered an unexpected error.
          </Typography>
          
          {error && process.env.NODE_ENV === 'development' && (
            <Box 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: 'rgba(0,0,0,0.1)', 
                borderRadius: 1,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 200
              }}
            >
              <Typography 
                variant="body2" 
                component="pre" 
                sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              >
                {error.message}
                {'\n'}
                {error.stack}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleGoBack}
              sx={{ borderRadius: 1.5 }}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshOutlined />}
              onClick={handleRetry}
              sx={{ 
                borderRadius: 1.5,
                background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              }}
            >
              Retry
            </Button>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
};

export default ErrorBoundary;
