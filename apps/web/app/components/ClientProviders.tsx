'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { TRPCReactProvider } from "../trpc/client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Dynamically import components with no SSR to avoid hydration issues
const ErrorBoundary = dynamic(
  () => import('./shared/ErrorBoundary'),
  { ssr: false }
);

const ThemeProvider = dynamic(
  () => import('../hooks/useThemePreference').then(mod => ({ default: mod.ThemePreferenceProvider })),
  { ssr: false }
);

export default function ClientProviders({
  children
}: {
  children: React.ReactNode;
}) {
  // Create a client-side QueryClient to ensure it's available everywhere
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCReactProvider>
        <ThemeProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </TRPCReactProvider>
    </QueryClientProvider>
  );
}
