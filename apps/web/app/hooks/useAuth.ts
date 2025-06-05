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

  
  const publicPaths = ['/login', '/register', '/auth/google/callback', '/verify-email', '/', '/forgot-password', '/reset-password'];
  const isPublicPath = publicPaths.some(path => pathname?.startsWith(path));

  
  const { data: sessionData, isLoading: isSessionLoading, error: sessionError } = trpc.auth.verifySession.useQuery(
    { token: token || '' },
    { 
      enabled: !!token && !isTokenExpired() && !isPublicPath,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, 
    }
  );

  
  const redirectToLogin = useCallback(() => {
    if (!isPublicPath) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || '/')}`);
    } else {
      router.push('/login');
    }
  }, [router, pathname, isPublicPath]);

  
  useEffect(() => {
    
    if (isPublicPath) {
      setIsLoading(false);
      return;
    }

    
    if (!token || !user) {
      setIsLoading(false);
      redirectToLogin();
      return;
    }

    
    if (isTokenExpired()) {
      logout();
      setIsLoading(false);
      redirectToLogin();
      return;
    }

    
    if (isSessionLoading) {
      return; 
    }    
    if (sessionError || !sessionData?.success) {
      console.log('Session verification failed:', sessionError || 'Invalid session');
      logout();
      setIsLoading(false);
      redirectToLogin();
      return;
    }    
    if (sessionData?.success && sessionData.user) {
      const freshUserData = {
        ...sessionData.user,
        picture: sessionData.user.picture || undefined 
      };
      
      if (user && (
        user.verified !== freshUserData.verified ||
        user.name !== freshUserData.name ||
        user.email !== freshUserData.email
      )) {
        setAuth(token!, freshUserData);
      }
    }

    
    setIsLoading(false);
  }, [token, user, isTokenExpired, isPublicPath, redirectToLogin, logout, setAuth, isSessionLoading, sessionData, sessionError]);

  
  const handleLogin = useCallback(async (token: string, userData: any) => {
    if (!token || !userData) {
      throw new Error('Invalid authentication data');
    }

    setAuth(token, userData);

    
    if (typeof document !== 'undefined') {
      const isSecure = window.location.protocol === 'https:';
      document.cookie = `authToken=${token}; path=/; max-age=2592000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    }

    
    const urlParams = new URLSearchParams(window.location.search);
    const callbackUrl = urlParams.get('callbackUrl');
    const redirectUrl = callbackUrl || `/${userData.role}`;
    
    router.push(redirectUrl);
  }, [setAuth, router]);

  
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
