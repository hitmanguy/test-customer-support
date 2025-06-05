'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, CircularProgress, TextField, Box, Snackbar, Alert, Fade, useMediaQuery, useTheme } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { trpc } from '@web/app/trpc/client';
import { useRouter } from 'next/navigation';

interface GoogleAuthButtonProps {
  role: 'customer' | 'agent' | 'company';
  companyId?: string;
  companyName?: string;
  label?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export default function GoogleAuthButton({ 
  role, 
  companyId, 
  companyName,
  label = 'Sign in with Google',
  fullWidth = true,
  disabled = false
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCompanyNamePrompt, setShowCompanyNamePrompt] = useState(false);
  const [inputCompanyName, setInputCompanyName] = useState(companyName || '');
  const [currentPath, setCurrentPath] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityNonce, setSecurityNonce] = useState<string>('');

  
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
      
      
      const nonce = crypto.randomUUID ? 
        crypto.randomUUID() : 
        Math.random().toString(36).substring(2) + Date.now().toString(36);
      setSecurityNonce(nonce);
    }
    
    
    if (typeof sessionStorage !== 'undefined' && currentPath) {
      sessionStorage.setItem('auth_redirect_path', currentPath);
    }
  }, [currentPath]);

  
  const { data: authData, refetch: initiateGoogleAuth, isError, error: queryError } = trpc.auth.googleAuth.useQuery(
    {
      role,
      companyId,
      companyName: role === 'company' ? (companyName || inputCompanyName) : undefined,
      returnTo: currentPath,
    },
    {
      enabled: false, 
      retry: 2,
      retryDelay: 1000,
      
      trpc: { context: { skipBatch: true } }
    }
  );

  const handleCloseError = () => {
    setError(null);
  };  const handleGoogleAuth = useCallback(async () => {
    
    if (role === 'agent' && !companyId) {
      setError('Please fill in your Company ID before continuing with Google authentication.');
      return;
    }
    
    if (role === 'company' && !companyName && !inputCompanyName) {
      setShowCompanyNamePrompt(true);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Initiating Google Auth...');
      const result = await initiateGoogleAuth();
      console.log('Google Auth URL received:', result.data ? 'URL available' : 'No URL');
      
      if (result.data?.url && isMounted) {
        
        try {
          
          const parsedUrl = new URL(result.data.url);
          
          
          const stateObj = {
            role,
            companyId,
            companyName: role === 'company' ? (companyName || inputCompanyName) : undefined,
            returnTo: currentPath,
            timestamp: Date.now(),
            nonce: securityNonce,
          };
          
          
          const stateParam = parsedUrl.searchParams.get('state');
          
          if (!stateParam) {
            console.error('No state parameter found in Google auth URL');
            throw new Error('Missing security parameters in authentication URL');
          }
          
          console.log('Auth state prepared:', { 
            role, 
            hasCompanyId: !!companyId,
            hasCompanyName: role === 'company' ? !!(companyName || inputCompanyName) : 'N/A',
            currentPath,
            stateParamExists: !!stateParam,
            stateLength: stateParam?.length
          });
        
          if (typeof sessionStorage !== 'undefined') {
            
            sessionStorage.removeItem('auth_state');
            
            if (stateParam) {
              
              localStorage.setItem('auth_state', stateParam);
              
              
              sessionStorage.setItem('auth_state', stateParam);
              
              console.log('Stored state in storage, length:', stateParam.length);
            } else {
              console.error('No state param in Google Auth URL');
              setError('Authentication configuration error. Please try again.');
              setIsLoading(false);
              return;
            }
            
            
            localStorage.setItem('auth_redirect_path', currentPath || '/');
            
            console.log('Redirecting to Google OAuth URL...');
            
            setTimeout(() => {
              
              window.location.href = result.data.url;
            }, 300);
          } else {
            
            window.location.href = result.data.url;
          }
        } catch (urlError) {
          console.error('URL parsing error:', urlError);
          throw new Error('Invalid authentication URL received');
        }
      } else {
        throw new Error('Failed to generate authentication URL');
      }
    } catch (error: any) {
      console.error('Google auth error:', error);
      
      
      if (error.shape?.data?.code === 'UNAUTHORIZED') {
        setError('Authentication service is unavailable. Please try again later.');
      } else if (error.shape?.data?.code === 'BAD_REQUEST') {
        setError('Invalid authentication request. Please check your information and try again.');
      } else if (error.shape?.data?.message?.includes('clientId')) {
        setError('OAuth configuration error. Please contact support.');
      } else {
        setError(error?.message || 'Failed to connect to Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [role, companyId, companyName, inputCompanyName, initiateGoogleAuth, isMounted, currentPath, securityNonce]);

  
  useEffect(() => {
    if (isError && queryError) {
      setError(queryError.message || 'An error occurred with Google authentication');
    }
  }, [isError, queryError]);

  
  if (!isMounted) {
    return <Button 
      variant="outlined" 
      fullWidth={fullWidth}
      disabled
      startIcon={<GoogleIcon />}
      sx={{
        py: 1.5,
        opacity: 0.7,
        color: 'text.secondary',
        borderColor: 'divider',
      }}
    >
      {label}
    </Button>;
  }

  return (
    <>
      {showCompanyNamePrompt ? (
        <Fade in={showCompanyNamePrompt}>
          <Box sx={{ mt: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="Company Name"
              value={inputCompanyName}
              onChange={(e) => setInputCompanyName(e.target.value)}
              sx={{ mb: 2 }}
              autoFocus
              placeholder="Enter your company name"
              InputProps={{ 
                sx: { borderRadius: 1.5 } 
              }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setShowCompanyNamePrompt(false)}
                sx={{ 
                  flex: 1,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  py: 1
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleGoogleAuth}
                disabled={!inputCompanyName.trim() || isLoading}
                sx={{ 
                  flex: 1,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  py: 1,
                  bgcolor: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  }
                }}
              >
                {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Continue'}
              </Button>
            </Box>
          </Box>
        </Fade>
      ) : (        <Button
          variant="outlined"
          fullWidth={fullWidth}
          onClick={handleGoogleAuth}
          disabled={isLoading || disabled}
          startIcon={
            isLoading ? 
              <CircularProgress size={20} /> : 
              <GoogleIcon />
          }
          sx={{
            py: isMobile ? 1 : 1.5,
            color: disabled ? 'text.disabled' : 'text.primary',
            borderColor: disabled ? 'action.disabled' : 'divider',
            borderRadius: 1.5,
            textTransform: 'none',
            '&:hover': {
              borderColor: disabled ? 'action.disabled' : 'primary.main',
              bgcolor: disabled ? 'transparent' : 'rgba(124, 58, 237, 0.04)',
            },
            transition: 'all 0.2s ease-in-out',
            boxShadow: 'none',
            '&:active': {
              transform: disabled ? 'none' : 'scale(0.98)',
            },
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Connecting...' : label}
        </Button>
      )}

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" variant="filled">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}