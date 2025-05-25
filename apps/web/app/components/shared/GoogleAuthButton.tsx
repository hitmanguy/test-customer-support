'use client';

import { useEffect, useState } from 'react';
import { Button, CircularProgress, TextField, Box } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { trpc } from '@web/app/trpc/client';

interface GoogleAuthButtonProps {
  role: 'customer' | 'agent' | 'company';
  companyId?: string;
  companyName?: string;
  label?: string;
  fullWidth?: boolean;
}

export default function GoogleAuthButton({ 
  role, 
  companyId, 
  companyName,
  label = 'Sign in with Google',
  fullWidth = true
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCompanyNamePrompt, setShowCompanyNamePrompt] = useState(false);
  const [inputCompanyName, setInputCompanyName] = useState(companyName || '');
  const [currentPath, setCurrentPath] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // Use useEffect to safely access window object after mount
  useEffect(() => {
    setIsMounted(true);
    console.log('GoogleAuthButton mounted');
    setCurrentPath(window.location.pathname);
  }, []);

  // Use useQuery with enabled: false to control when it runs
  const { data: authData, refetch: initiateGoogleAuth } = trpc.auth.googleAuth.useQuery(
    {
      role,
      companyId,
      companyName: role === 'company' ? (companyName || inputCompanyName) : undefined,
      returnTo: currentPath,
    },
    {
      enabled: false, // Don't run query automatically
      // Only run if the component is mounted
      trpc: { context: { skipBatch: true } }
    }
  );

  const handleGoogleAuth = async () => {
    if (role === 'company' && !companyName) {
      setShowCompanyNamePrompt(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await initiateGoogleAuth();
      
      if (result.data?.url && isMounted) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error('Google auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Safely render the component only after mounting
  if (!isMounted) {
    return null; // Or a loading placeholder
  }

  return (
    <>
      {showCompanyNamePrompt ? (
        <Box sx={{ mt: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="Company Name"
            value={inputCompanyName}
            onChange={(e) => setInputCompanyName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setShowCompanyNamePrompt(false)}
              sx={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleGoogleAuth}
              disabled={!inputCompanyName.trim() || isLoading}
              sx={{ flex: 1 }}
            >
              Continue
            </Button>
          </Box>
        </Box>
      ) : (
        <Button
          variant="outlined"
          fullWidth={fullWidth}
          onClick={handleGoogleAuth}
          disabled={isLoading}
          startIcon={
            isLoading ? 
              <CircularProgress size={20} /> : 
              <GoogleIcon />
          }
          sx={{
            py: 1.5,
            color: 'text.primary',
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'rgba(124, 58, 237, 0.04)',
            },
          }}
        >
          {isLoading ? 'Connecting...' : label}
        </Button>
      )}
    </>
  );
}