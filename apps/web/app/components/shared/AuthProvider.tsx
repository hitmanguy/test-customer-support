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
  
  
  useEffect(() => {
    if (!token || !user) return;
    
    const checkTokenExpiry = () => {
      const remainingTime = getTokenRemainingTime();
      
      
      if (remainingTime > 0 && remainingTime < 300) {
        setShowSessionExpiring(true);
      } else {
        setShowSessionExpiring(false);
      }
    };
    
    
    checkTokenExpiry();
    
    
    const interval = setInterval(checkTokenExpiry, 60000); 
    
    return () => {
      clearInterval(interval);
    };
  }, [token, user, getTokenRemainingTime]);

  
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      
      const lastCheckTime = sessionStorage.getItem('last_auth_check');
      const currentTime = Date.now();
      const CHECK_INTERVAL = 30000; 
      
      if (lastCheckTime && currentTime - parseInt(lastCheckTime) < CHECK_INTERVAL) {
        setIsInitialized(true);
        setLoading(false);
        return;
      }
      
      
      sessionStorage.setItem('last_auth_check', currentTime.toString());
      
      
      if (!token) {
        setIsInitialized(true);
        setLoading(false);
        return;
      }
      
      
      if (isTokenExpired()) {
        try {
          
          
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

      
      if (token && user && !authVerification.isLoading) {
        
        if (authVerification.data && !authVerification.data.success) {
          console.warn('Token verification failed');
          logout();
        }
        
        
        const remainingTime = getTokenRemainingTime();
        if (remainingTime < 300 && remainingTime > 0) { 
          console.log('Token will expire soon, should refresh');
          
        }
        
        setIsInitialized(true);
        setLoading(false);
      }
    };

    checkAuth();
  }, [token, user, isTokenExpired, logout, authVerification.isLoading, authVerification.data, setLoading, getTokenRemainingTime]);

  
  const authContext: AuthContextType = {
    isLoading: !isInitialized,
    isAuthenticated: !!token && !!user && !isTokenExpired() && 
                    (authVerification.data?.success ?? true), 
    redirectToLogin: () => {
      const returnUrl = encodeURIComponent(pathname || '/');
      router.push(`/login?callbackUrl=${returnUrl}`);
    },
  };

  
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
