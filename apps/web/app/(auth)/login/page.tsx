'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Link as MuiLink,
  InputAdornment,
  IconButton,
  Divider,
  Paper,
  Collapse,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Info as InfoIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import GoogleAuthButton from '@web/app/components/shared/GoogleAuthButton';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import Link from 'next/link';

type UserRole = 'customer' | 'agent' | 'company';

interface LoginFormData {
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const returnTo = searchParams.get('callbackUrl');

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    role: 'customer',
    companyId: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  
  useEffect(() => {
    setIsClient(true);
  }, []);

  
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.success && data.token && data.user) {
        
        if (typeof document !== 'undefined') {
          document.cookie = `authToken=${data.token}; path=/; max-age=2592000; SameSite=Lax`;
        }
        
        setAuth(
          data.token,
          {
            ...data.user,
            picture: data.user.picture ?? undefined,
          }
        );
        
        if (!data.user.verified) {
          router.push('/verify-email');
          return;
        }

        
        router.push(returnTo ? decodeURI(returnTo) : `/${data.user.role}`);
      }
    },
    onError: (error) => {
      if (error.message.includes('Please login with Google')) {
        setError('Please use Google Sign In for this account');
      } else {
        setError(error.message || 'Login failed');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }
    
    if (formData.role === 'agent' && !formData.companyId) {
      setError('Company ID is required for agents');
      return;
    }

    try {
      loginMutation.mutate(formData);
    } catch (err) {
      
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    }
  };


  
  if (!isClient) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%' }}
    >
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        sx={{ 
          mb: 4, 
          textAlign: 'center', 
          fontWeight: 700,
          background: 'linear-gradient(45deg, #7C3AED 30%, #10B981 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.5px',
        }}
      >
        Welcome Back
      </Typography>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 1.5,
                '& .MuiAlert-icon': { alignItems: 'center' }
              }}
              variant="outlined"
            >
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Box component="form" onSubmit={handleSubmit}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="user-role-label">I am a</InputLabel>
          <Select
            labelId="user-role-label"
            value={formData.role}
            label="I am a"
            onChange={(e) => setFormData({ 
              ...formData, 
              role: e.target.value as UserRole,
              companyId: e.target.value === 'agent' ? formData.companyId : '',
            })}
            sx={{ 
              borderRadius: 1.5,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.15)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
              },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  borderRadius: 2,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                  mt: 0.5,
                  '& .MuiMenuItem-root': {
                    py: 1.5,
                  }
                }
              }
            }}
          >
            <MenuItem value="customer">Customer</MenuItem>
            <MenuItem value="agent">Support Agent</MenuItem>
            <MenuItem value="company">Company Owner</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Email"
          type="email"
          margin="normal"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          autoComplete="email"
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
            }
          }}
        />

        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          margin="normal"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          autoComplete="current-password"
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  aria-label={showPassword ? 'hide password' : 'show password'}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Collapse in={formData.role === 'agent'}>
          <TextField
            fullWidth
            label="Company ID"
            margin="normal"
            value={formData.companyId}
            onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
            required={formData.role === 'agent'}
            helperText="Enter the ID provided by your company"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <InfoIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Collapse>

        <Button
          fullWidth
          type="submit"
          variant="contained"
          startIcon={!loginMutation.isPending && <LoginIcon />}
          sx={{
            mt: 3,
            mb: 3,
            py: 1.5,
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            borderRadius: 1.5,
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.2)',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1.05rem',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: '0 8px 25px rgba(124, 58, 237, 0.3)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          }}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Signing in...
            </motion.div>
          ) : (
            'Sign In'
          )}
        </Button>

        <Divider sx={{ 
          my: 3, 
          '&::before, &::after': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            OR
          </Typography>
        </Divider>

        <GoogleAuthButton 
          role={formData.role}
          companyId={formData.role === 'agent' ? formData.companyId : undefined} 
          label="Continue with Google"
        />        <Box sx={{ 
          textAlign: 'center', 
          mt: 4, 
          pt: 1,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <Typography variant="body2" sx={{ display: 'inline', color: 'text.secondary' }}>
            Don&apos;t have an account?{' '}
          </Typography>
          <Link href="/register" passHref>
            <MuiLink
              component="span"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                position: 'relative',
                '&:hover': {
                  textDecoration: 'none',
                  '&::after': {
                    transform: 'scaleX(1)',
                    transformOrigin: 'bottom left',
                  }
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  transform: 'scaleX(0)',
                  height: '1px',
                  bottom: -1,
                  left: 0,
                  backgroundColor: 'primary.main',
                  transformOrigin: 'bottom right',
                  transition: 'transform 0.3s ease-out'
                }
              }}
            >
              Sign Up
            </MuiLink>
          </Link>
        </Box>
        
        {}
        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Link href="/debug/oauth" passHref>
            <MuiLink
              component="span"
              sx={{
                fontSize: '0.7rem',
                color: 'text.disabled',
                textDecoration: 'none',
                opacity: 0.5,
                '&:hover': {
                  opacity: 1
                }
              }}
            >
              OAuth Debug
            </MuiLink>
          </Link>
        </Box>
      </Box>
    </motion.div>
  );
}