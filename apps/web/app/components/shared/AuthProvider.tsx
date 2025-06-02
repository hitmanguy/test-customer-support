'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { Box, CircularProgress } from '@mui/material';

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  redirectToLogin: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  redirectToLogin: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, isTokenExpired, logout, setLoading, getTokenRemainingTime } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSessionExpiring, setShowSessionExpiring] = useState(false);
  
  const authVerification = trpc.auth.verifySession.useQuery(
    { token: token || '' },
    { 
      enabled: !!token && !isTokenExpired(),
      retry: false,
      refetchOnWindowFocus: false
    }
  );
  
  // Check for session expiry periodically and show warning
  useEffect(() => {
    if (!token || !user) return;
    
    const checkTokenExpiry = () => {
      const remainingTime = getTokenRemainingTime();
      
      // If token has less than 5 minutes remaining, show warning
      if (remainingTime > 0 && remainingTime < 300) {
        setShowSessionExpiring(true);
      } else {
        setShowSessionExpiring(false);
      }
    };
    
    // Check initially
    checkTokenExpiry();
    
    // Set up interval to check token expiry
    const interval = setInterval(checkTokenExpiry, 60000); // Check every minute
    
    return () => {
      clearInterval(interval);
    };
  }, [token, user, getTokenRemainingTime]);

  // Handle session verification and token refresh
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      // Check if we've checked auth recently to avoid unnecessary verification
      const lastCheckTime = sessionStorage.getItem('last_auth_check');
      const currentTime = Date.now();
      const CHECK_INTERVAL = 30000; // 30 seconds
      
      if (lastCheckTime && currentTime - parseInt(lastCheckTime) < CHECK_INTERVAL) {
        setIsInitialized(true);
        setLoading(false);
        return;
      }
      
      // Update last check time
      sessionStorage.setItem('last_auth_check', currentTime.toString());
      
      // If no token, consider as not authenticated
      if (!token) {
        setIsInitialized(true);
        setLoading(false);
        return;
      }
      
      // If token is expired, check if we can refresh it
      if (isTokenExpired()) {
        try {
          // For now, just logout since we don't have a refresh token mechanism
          // In the future, implement refresh token logic here
          console.log('Token expired, logging out');
          logout();
        } catch (error) {
          console.error('Token refresh failed:', error);
          logout();
        }
        setIsInitialized(true);
        setLoading(false);
        return;
      }

      // We already have a valid token and user
      if (token && user && !authVerification.isLoading) {
        // If verification failed, log out
        if (authVerification.data && !authVerification.data.success) {
          console.warn('Token verification failed');
          logout();
        }
        
        // Set up token refresh timer if token is about to expire
        const remainingTime = getTokenRemainingTime();
        if (remainingTime < 300 && remainingTime > 0) { // Less than 5 minutes remaining
          console.log('Token will expire soon, should refresh');
          // Here we would implement token refresh logic
        }
        
        setIsInitialized(true);
        setLoading(false);
      }
    };

    checkAuth();
  }, [token, user, isTokenExpired, logout, authVerification.isLoading, authVerification.data, setLoading, getTokenRemainingTime]);

  // Provide authentication context
  const authContext: AuthContextType = {
    isLoading: !isInitialized,
    isAuthenticated: !!token && !!user && !isTokenExpired() && 
                    (authVerification.data?.success ?? true), // Default to true if data not yet loaded
    redirectToLogin: () => {
      const returnUrl = encodeURIComponent(pathname || '/');
      router.push(`/login?callbackUrl=${returnUrl}`);
    },
  };

  // Show a loading spinner during initial auth check
  if (!isInitialized) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
}
