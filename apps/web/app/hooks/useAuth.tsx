'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '../trpc/client';

export function useAuth() {
  const trpc = useTRPC();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Only run the query if a token exists, otherwise skip
  const queryOptions = token
    ? trpc.auth.verifySession.queryOptions({ token })
    : undefined;

  type AuthData = { user?: unknown } | undefined;
  let data: AuthData = undefined;
  let error: unknown = null;

  if (queryOptions) {
    const result = useSuspenseQuery(queryOptions);
    data = result.data;
    error = result.error;
  }

  return {
    user: data?.user ?? null,
    isAuthenticated: !!data?.user,
    error: token ? error : null,
  };
}