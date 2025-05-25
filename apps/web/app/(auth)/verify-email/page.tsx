'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    // Redirect if no user in store
    if (!user) {
      router.replace('/login');
      return;
    }

    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, user, router]);

  const verifyMutation = trpc.auth.verifyOTP.useMutation({
      onSuccess: (data) => {
        if (data.success) {
          router.push(`/${user?.role}`);
        }
      },
      onError: (error) => {
        setError(error.message || 'Verification failed');
      },
    });

  const resendMutation = trpc.auth.resendOTP.useMutation({
      onSuccess: () => {
        setCountdown(30);
        setError('');
      },
      onError: (error) => {
        setError(error.message || 'Failed to resend code');
      },
    });

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple digits
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all digits');
      return;
    }

    verifyMutation.mutate({
      email: user?.email || '',
      otp: otpString,
      role: user?.role || 'customer',
    });
  };

  const handleResend = () => {
    if (countdown === 0) {
      resendMutation.mutate({
        email: user?.email || '',
        role: user?.role || 'customer',
      });
    }
  };

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
        }}
      >
        <Typography variant="h4" sx={{ mb: 2, textAlign: 'center', fontWeight: 700 }}>
          Verify Your Email
        </Typography>

        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          We've sent a verification code to<br />
          <strong>{user?.email}</strong>
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

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ textAlign: 'center' }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
              mb: 3,
            }}
          >
            {otp.map((digit, index) => (
              <TextField
                key={index}
                id={`otp-${index}`}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                sx={{
                  width: '52px',
                  '& input': {
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    p: 1,
                  },
                }}
                inputProps={{
                  maxLength: 1,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digit && index > 0) {
                    const prevInput = document.getElementById(`otp-${index - 1}`);
                    prevInput?.focus();
                  }
                }}
              />
            ))}
          </Box>

          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={verifyMutation.isPending || otp.join('').length !== 6}
            sx={{
              mb: 2,
              py: 1.5,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
          >
            {verifyMutation.isPending ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Verify Email'
            )}
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={handleResend}
            disabled={countdown > 0 || resendMutation.isPending}
            sx={{ color: 'text.secondary' }}
          >
            {resendMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : countdown > 0 ? (
              `Resend code in ${countdown}s`
            ) : (
              'Resend code'
            )}
          </Button>
        </Box>
      </Paper>
    </motion.div>
  );
}