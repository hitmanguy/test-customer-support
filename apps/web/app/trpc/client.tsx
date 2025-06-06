'use client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import { makeQueryClient } from './query-client';
import type { AppRouter } from '@server/trpc/trpc.router';


function useQueryClientFromContext() {
  const queryClient = useQueryClient();
  return queryClient;
}


export const trpc = createTRPCReact<AppRouter>();


let browserQueryClient: QueryClient | undefined = undefined;


function getQueryClient() {
  if (typeof window === 'undefined') {
    
    return makeQueryClient();
  }
  
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

function getUrl() {
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  const base = (() => {
    
    return vercelUrl
      ? `https://${vercelUrl}`
      : 'http://localhost:3001';
  })();
  
  return `${base}/trpc`;
}


export function TRPCReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  
  const queryClient = useQueryClientFromContext();
  
  
  const [trpcClient] = useState(() => 
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: getUrl(),
          headers() {
            const headers: Record<string, string> = {
              'x-trpc-source': 'react'
            };
            
            
            if (typeof window !== 'undefined') {
              try {
                
                const authStorage = localStorage.getItem('auth-storage');
                if (authStorage) {
                  const parsed = JSON.parse(authStorage);
                  if (parsed?.state?.token) {
                    headers['Authorization'] = `Bearer ${parsed.state.token}`;
                  }
                }
                
                
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
  
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
