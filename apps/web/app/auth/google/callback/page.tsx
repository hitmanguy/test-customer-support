'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, CircularProgress } from '@mui/material';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code || !state) {
      setError('Invalid callback parameters');
      return;
    }
    
    const handleCallback = async () => {
      try {
        // Decode state parameter (base64)
        const stateParams = JSON.parse(atob(state));
        const { role, companyId, returnTo } = stateParams;
        
        // Call backend to validate code
        const mutate = trpc.auth.googleCallback.useMutation();
        const response = await mutate.mutateAsync({
          code,
          role,
          companyId,
        });

        if (response && response.success && response.token && response.user) {
          // Store auth in local storage and state
          localStorage.setItem('token', response.token);
          setAuth(response.token, response.user);

          // Redirect to appropriate dashboard
          const redirect = returnTo || `/${role}`;
          router.push(redirect);
        } else {
          setError('Authentication failed');
        }
      } catch (error) {
        console.error('Google callback error:', error);
        if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
          setError((error as { message: string }).message);
        } else {
          setError('Authentication failed');
        }
      }
    };
    
    handleCallback();
  }, [searchParams, router, setAuth]);
  
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      p: 2,
      textAlign: 'center'
    }}>
      {error ? (
        <>
          <Typography variant="h5" sx={{ mb: 2, color: 'error.main' }}>
            Authentication Error
          </Typography>
          <Typography variant="body1">{error}</Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            <a href="/login" style={{ color: 'inherit' }}>Return to login page</a>
          </Typography>
        </>
      ) : (
        <>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h5" sx={{ mt: 4 }}>
            Completing authentication...
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Please wait while we log you in.
          </Typography>
        </>
      )}
    </Box>
  );
}
