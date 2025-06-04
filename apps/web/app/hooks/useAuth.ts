'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { trpc } from '../trpc/client';
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, isTokenExpired, setAuth, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/register', '/auth/google/callback', '/verify-email', '/', '/forgot-password', '/reset-password'];
  const isPublicPath = publicPaths.some(path => pathname?.startsWith(path));

  // Session verification query - only run when we have a token and it's not expired
  const { data: sessionData, isLoading: isSessionLoading, error: sessionError } = trpc.auth.verifySession.useQuery(
    { token: token || '' },
    { 
      enabled: !!token && !isTokenExpired() && !isPublicPath,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Redirect to login helper
  const redirectToLogin = useCallback(() => {
    if (!isPublicPath) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || '/')}`);
    } else {
      router.push('/login');
    }
  }, [router, pathname, isPublicPath]);

  // Main authentication effect
  useEffect(() => {
    // Skip auth check for public paths
    if (isPublicPath) {
      setIsLoading(false);
      return;
    }

    // No token or user means not authenticated
    if (!token || !user) {
      setIsLoading(false);
      redirectToLogin();
      return;
    }

    // Token expired locally
    if (isTokenExpired()) {
      logout();
      setIsLoading(false);
      redirectToLogin();
      return;
    }

    // Wait for session verification to complete
    if (isSessionLoading) {
      return; // Keep loading
    }    // Session verification failed
    if (sessionError || !sessionData?.success) {
      console.log('Session verification failed:', sessionError || 'Invalid session');
      logout();
      setIsLoading(false);
      redirectToLogin();
      return;
    }    // Session verification succeeded - sync user data
    if (sessionData?.success && sessionData.user) {
      const freshUserData = {
        ...sessionData.user,
        picture: sessionData.user.picture || undefined // Convert null to undefined
      };
      // Only update if the user data has changed
      if (user && (
        user.verified !== freshUserData.verified ||
        user.name !== freshUserData.name ||
        user.email !== freshUserData.email
      )) {
        setAuth(token!, freshUserData);
      }
    }

    // All checks passed - user is authenticated
    setIsLoading(false);
  }, [token, user, isTokenExpired, isPublicPath, redirectToLogin, logout, setAuth, isSessionLoading, sessionData, sessionError]);

  // Handle login process
  const handleLogin = useCallback(async (token: string, userData: any) => {
    if (!token || !userData) {
      throw new Error('Invalid authentication data');
    }

    setAuth(token, userData);

    // Set cookie for middleware
    if (typeof document !== 'undefined') {
      const isSecure = window.location.protocol === 'https:';
      document.cookie = `authToken=${token}; path=/; max-age=2592000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    }

    // Get redirect URL from query params or default based on role
    const urlParams = new URLSearchParams(window.location.search);
    const callbackUrl = urlParams.get('callbackUrl');
    const redirectUrl = callbackUrl || `/${userData.role}`;
    
    router.push(redirectUrl);
  }, [setAuth, router]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      logout();
      if (typeof document !== 'undefined') {
        document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      }
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout, router]);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user && !isTokenExpired(),
    handleLogin,
    handleLogout
  };
}
