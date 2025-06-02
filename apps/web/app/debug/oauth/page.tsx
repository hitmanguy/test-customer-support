'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress, Alert, Card, CardContent, Divider, Chip } from '@mui/material';
import { trpc } from '@web/app/trpc/client';
import { useSearchParams } from 'next/navigation';

interface DebugInfo {
  success: boolean;
  config: {
    env: {
      JWT_SECRET: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      GOOGLE_REDIRECT_URI: string;
      NODE_ENV: string;
    };
    stateExample: {
      raw: string;
      length: number;
    };
    clientId: string;
    redirectUri: string;
    hasClientSecret: boolean;
  };
  test?: {
    authUrl: string;
  };
  error?: string;
  stack?: string;
}

export default function GoogleAuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{state?: string, redirectPath?: string} | null>(null);
  const searchParams = useSearchParams();

  // Check for callback parameters
  useEffect(() => {
    // If this is a callback from OAuth
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    if (state || code || error) {
      // This is a callback from OAuth
      console.log('OAuth callback detected', { state, code, error });
    }
    
    // Get session storage data
    if (typeof sessionStorage !== 'undefined') {
      const storedState = sessionStorage.getItem('auth_state');
      const redirectPath = sessionStorage.getItem('auth_redirect_path');
      
      setSessionData({
        state: storedState || undefined,
        redirectPath: redirectPath || undefined
      });
    }
  }, [searchParams]);
  // Query for testing OAuth config
  const { refetch } = trpc.debug.checkGoogleAuth.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  
  // Query for test login (development only)
  const { refetch: testLogin } = trpc.debug.testLogin.useQuery(
    {
      role: 'customer',
      email: 'test@example.com'
    },
    {
      enabled: false,
      retry: false
    }
  );

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await refetch();
      if (result.error) {
        setError(result.error.message);
        setDebugInfo(null);
      } else if (result.data) {
        setDebugInfo(result.data as DebugInfo);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>      <Typography variant="h4" gutterBottom>
        Google OAuth Debugger
      </Typography>
      
      {/* Show callback parameters if present */}
      {searchParams.get('state') && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6">OAuth Callback Parameters</Typography>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>State:</strong> {searchParams.get('state')?.substring(0, 20)}...
              (length: {searchParams.get('state')?.length})
            </Typography>
            {searchParams.get('code') && (
              <Typography variant="body2">
                <strong>Code:</strong> {searchParams.get('code')?.substring(0, 10)}...
              </Typography>
            )}
            {searchParams.get('error') && (
              <Typography variant="body2" color="error">
                <strong>Error:</strong> {searchParams.get('error')}
              </Typography>
            )}
          </Box>
        </Alert>
      )}
      
      {/* Session storage data */}
      {sessionData && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Session Storage Data
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Stored State:</strong> {sessionData.state ? 
                `${sessionData.state.substring(0, 20)}... (length: ${sessionData.state.length})` : 
                'Not found'}
            </Typography>
            
            <Typography variant="body2">
              <strong>Redirect Path:</strong> {sessionData.redirectPath || 'Not set'}
            </Typography>
            
            {searchParams.get('state') && sessionData.state && (
              <Box sx={{ mt: 2 }}>
                <Chip 
                  label={searchParams.get('state') === sessionData.state ? 
                    "State Match: ✅ Good" : 
                    "State Mismatch: ❌ Error"} 
                  color={searchParams.get('state') === sessionData.state ? "success" : "error"}
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
            )}
          </CardContent>        </Card>
      )}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleTest}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Test Google OAuth Configuration'}
        </Button>
        
        <Button 
          variant="outlined"
          color="warning"
          onClick={() => {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem('auth_state');
              localStorage.removeItem('auth_state');
              // Update the session data state
              setSessionData({
                ...sessionData,
                state: undefined
              });
              alert('Session state cleared!');
            }
          }}
        >
          Clear Session State
        </Button>
        
        <Button 
          variant="contained"
          color="success"
          onClick={async () => {
            try {
              const result = await testLogin();
              if (result.data?.success) {
                alert('Test login successful! Check console for details.');
                console.log('Test login result:', result.data);
                
                // Store token in cookie if present
                const isSecure = window.location.protocol === 'https:';
                if ('token' in result.data && result.data.token) {
                  document.cookie = `authToken=${result.data.token}; path=/; max-age=2592000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
                }
                
                // You could add code here to update the auth store if needed
              } else {
                alert('Test login failed');
              }
            } catch (err) {
              console.error('Test login error:', err);
              alert('Error with test login');
            }
          }}
        >
          Test Login (Development Only)
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {debugInfo && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Configuration Status: {debugInfo.success ? '✅ Valid' : '❌ Invalid'}
          </Typography>
          
          <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 'bold' }}>
            Configuration:
          </Typography>          <Box component="pre" sx={{ 
            p: 2, 
            bgcolor: 'background.default', 
            borderRadius: 1,
            overflow: 'auto'
          }}>
            {JSON.stringify(debugInfo.config, null, 2)}
          </Box>
          
          <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 'bold' }}>
            Environment Variables:
          </Typography>
          <Box component="pre" sx={{ 
            p: 2, 
            bgcolor: 'background.default', 
            borderRadius: 1,
            overflow: 'auto'
          }}>
            {JSON.stringify(debugInfo.config.env, null, 2)}
          </Box>
          
          {debugInfo.test?.authUrl && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 'bold' }}>
                Test Auth URL:
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button 
                  variant="outlined" 
                  href={debugInfo.test.authUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Google Auth URL (For Testing)
                </Button>
              </Box>
            </>
          )}
          
          {debugInfo.error && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 'bold', color: 'error.main' }}>
                Error:
              </Typography>
              <Box component="pre" sx={{ 
                p: 2, 
                bgcolor: 'error.light',
                color: 'error.contrastText', 
                borderRadius: 1,
                overflow: 'auto'
              }}>
                {debugInfo.error}
                
                {debugInfo.stack && (
                  <>
                  {"\n\n"}Stack Trace:{"\n"}{debugInfo.stack}
                  </>
                )}
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}