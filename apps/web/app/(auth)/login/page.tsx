'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Google as GoogleIcon,
  Info as InfoIcon 
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTRPC } from '../../trpc/client';
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
  const trpc = useTRPC();
  const { setAuth } = useAuthStore();
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    role: 'customer',
    companyId: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Login mutation
  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: (data) => {
        if (data.success && data.token && data.user) {
          setAuth(data.token, data.user);
          
          if (!data.user.verified) {
            router.push('/verify-email');
            return;
          }

          router.push(`/${data.user.role}/dashboard`);
        }
      },
      onError: (error) => {
        if (error.message.includes('Please login with Google')) {
          setError('Please use Google Sign In for this account');
        } else {
          setError(error.message || 'Login failed');
        }
      },
    })
  );

  // Google auth mutation
//   const googleAuthMutation = useMutation(
//     trpc.auth.googleAuth.mutationOptions({
//       onSuccess: (data) => {
//         if (data.url) {
//           window.location.href = data.url;
//         }
//       },
//       onError: (error) => {
//         setError(error.message || 'Google authentication failed');
//       },
//     })
//   );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.role === 'agent' && !formData.companyId) {
      setError('Company ID is required for agents');
      return;
    }

    loginMutation.mutate(formData);
  };

//   const handleGoogleAuth = () => {
//     googleAuthMutation.mutate({ 
//       role: formData.role,
//       companyId: formData.role === 'agent' ? formData.companyId : undefined,
//       returnTo: window.location.href
//     });
//   };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Typography variant="h4" sx={{ mb: 4, textAlign: 'center', fontWeight: 700 }}>
          Welcome Back
        </Typography>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>I am a</InputLabel>
            <Select
              value={formData.role}
              label="I am a"
              onChange={(e) => setFormData({ 
                ...formData, 
                role: e.target.value as UserRole,
                companyId: e.target.value === 'agent' ? formData.companyId : '',
              })}
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
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
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
            sx={{
              mt: 3,
              mb: 2,
              py: 1.5,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }}>OR</Divider>

        <Button
          fullWidth
          variant="outlined"
          startIcon={<GoogleIcon />}
          //onClick={handleGoogleAuth}
          sx={{
            mb: 2,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
         // disabled={googleAuthMutation.isPending}
        >
          {/* {googleAuthMutation.isPending ? 'Redirecting...' : 'Continue with Google'} */}
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" sx={{ display: 'inline' }}>
            Don&apos;t have an account?{' '}
          </Typography>
          <Link href="/register" passHref>
            <MuiLink
              component="span"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Sign Up
            </MuiLink>
          </Link>
        </Box>
      </Paper>
    </motion.div>
  );
}