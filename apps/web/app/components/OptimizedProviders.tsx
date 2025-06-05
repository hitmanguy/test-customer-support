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


function OptimizedProviders({ children }: ClientProvidersProps) {
  
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 1000, 
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

  
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error('OptimizedProviders caught an error:', error);
    
  };
  
  
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


export default React.memo(OptimizedProviders);

