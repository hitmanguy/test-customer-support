'use client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import { makeQueryClient } from './query-client';
import type { AppRouter } from '@server/trpc/trpc.router';

// Helper function to get QueryClient from context
function useQueryClientFromContext() {
  const queryClient = useQueryClient();
  return queryClient;
}

// Create a stable client and query client
export const trpc = createTRPCReact<AppRouter>();

// Singleton QueryClient for the browser
let browserQueryClient: QueryClient | undefined = undefined;

// Ensure we have a stable query client
function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server-side: always create a new client
    return makeQueryClient();
  }
  // Client-side: use singleton pattern
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

function getUrl() {
  const vercelUrl = process.env.VERCEL_URL;
  const base = (() => {
    if (typeof window !== 'undefined') {
      // In the browser, respect the origin
      const protocol = window.location.protocol;
      const host = window.location.host;
      
      if (host.includes('localhost')) {
        return 'http://localhost:3001';
      }
      
      return `${protocol}//${host}`;
    }
    
    return vercelUrl
      ? `https://${vercelUrl}`
      : 'http://localhost:3001';
  })();
  
  return `${base}/trpc`;
}

/**
 * TRPCReactProvider component that provides TRPC client
 * to the application
 */
export function TRPCReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use QueryClient from parent provider
  const queryClient = useQueryClientFromContext();
  
  // Create a stable tRPC client instance
  const [trpcClient] = useState(() => 
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: getUrl(),
          headers() {
            const headers: Record<string, string> = {
              'x-trpc-source': 'react'
            };
            
            // Get authentication token from various sources
            if (typeof window !== 'undefined') {
              try {
                // Try localStorage
                const authStorage = localStorage.getItem('auth-storage');
                if (authStorage) {
                  const parsed = JSON.parse(authStorage);
                  if (parsed?.state?.token) {
                    headers['Authorization'] = `Bearer ${parsed.state.token}`;
                  }
                }
                
                // Try cookies
                const cookies = document.cookie.split('; ');
                const authCookie = cookies.find(cookie => cookie.startsWith('authToken='));
                if (authCookie) {
                  headers['Authorization'] = `Bearer ${authCookie.split('=')[1]}`;
                }
              } catch (e) {
                console.error('Error accessing auth token:', e);
              }
            }
            
            return headers;
          },
          fetch(url, options) {
            const controller = new AbortController();
            const { signal } = controller;
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            return fetch(url, {
              ...options,
              signal,
            }).finally(() => {
              clearTimeout(timeoutId);
            });
          }
        })
      ]
    })
  );
  // Get the QueryClient from the parent QueryClientProvider
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}