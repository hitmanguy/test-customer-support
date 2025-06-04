'use client';

import React, { useState, useMemo } from 'react';
import { TRPCReactProvider } from "../trpc/client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme as theme } from '../theme';
import { AuthProvider } from './shared/AuthProvider';
import ErrorBoundary from './ErrorBoundary';
import { ErrorInfo } from 'react';

interface ClientProvidersProps {
  children: React.ReactNode;
}

/**
 * OptimizedProviders component wraps the app with necessary providers
 * Enhanced with React.memo, better error handling, and improved performance
 */
function OptimizedProviders({ children }: ClientProvidersProps) {
  // Create a new QueryClient instance for each session
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 1000, // 10 seconds (increased from 5)
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          console.error('Mutation error:', error);
        }
      }
    },
  }));

  // Error handler for the ErrorBoundary
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error('OptimizedProviders caught an error:', error);
    // Here you could send error to your analytics service
  };
  
  // Memoize the theme provider and its children to prevent unnecessary re-renders
  const themeProviderChildren = useMemo(() => (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  ), [children]);
  return (
    <ErrorBoundary onError={handleError}>
      <QueryClientProvider client={queryClient}>
        <TRPCReactProvider>
          {themeProviderChildren}
          {process.env.NODE_ENV !== 'production' && <ReactQueryDevtools />}
        </TRPCReactProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export default React.memo(OptimizedProviders);

