'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@web/app/hooks/useAuth';
import { Box, CircularProgress, Typography } from '@mui/material';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: 'customer' | 'agent' | 'company' | string[];
};

export default function ProtectedRoute({ 
  children, 
  requiredRole 
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      const currentPath = window.location.pathname;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
      return;
    }
    
    if (!user?.verified) {
      router.push('/verify-email');
      return;
    }
    
    if (requiredRole) {
      const hasRole = Array.isArray(requiredRole) 
        ? requiredRole.includes(user.role)
        : user.role === requiredRole;
        
      if (!hasRole) {
        router.push(`/${user.role}`);
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRole, router]);

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated || !user?.verified) {
    return null;
  }

  if (requiredRole) {
    const hasRole = Array.isArray(requiredRole) 
      ? requiredRole.includes(user.role)
      : user.role === requiredRole;
      
    if (!hasRole) {
      return null;
    }
  }
  return <>{children}</>;
}
