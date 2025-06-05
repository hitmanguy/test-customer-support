'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  
  const googleCallbackMutation = trpc.auth.googleCallback.useMutation();
  
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Processing login...");
  
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const processAuth = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const authError = searchParams.get('error');

        if (authError) {
          setError(`Google authentication failed: ${authError}`);
          setTimeout(() => router.push('/login'), 2000);
          return;
        }

        if (!code || !state) {
          setError('Missing authentication parameters');
          setTimeout(() => router.push('/login'), 2000);
          return;
        }

        setStatus('Authenticating with Google...');

        
        let role = 'customer';
        let returnTo = '/customer';
        try {
          const parsed = JSON.parse(atob(state));
          role = parsed.role || 'customer';
          returnTo = parsed.returnTo || `/${role}`;
        } catch (e) {
          console.warn('Could not parse state, using defaults');
        }

        
        const result = await googleCallbackMutation.mutateAsync({ code, state });

        if (result?.success && result.token && result.user) {
          setStatus('Login successful! Redirecting...');
          
          
          document.cookie = `authToken=${result.token}; path=/; max-age=2592000; SameSite=Lax${
            window.location.protocol === 'https:' ? '; Secure' : ''
          }`;
          
          
          setAuth(result.token, {
            ...result.user,
            role: result.user.role || role,
            authType: (result.user.authType as 'local' | 'google') ?? 'google',
            picture: result.user.picture ?? undefined
          });
          
          
          setTimeout(() => router.push(returnTo), 500);
        } else {
          throw new Error('Authentication failed');
        }
      } catch (err: any) {
        console.error('OAuth error:', err);
        setError(err.message || 'Authentication failed');
        setTimeout(() => router.push('/login'), 2000);
      }
    };

    processAuth();
  }, [searchParams, router, googleCallbackMutation, setAuth]);

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        gap: 2,
        p: 3
      }}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Redirecting to login...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      gap: 2
    }}>
      <CircularProgress size={50} />
      <Typography variant="h6" color="text.primary">
        Completing Authentication
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {status}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Please wait while we finish the sign-in process.
      </Typography>
    </Box>
  );
}
