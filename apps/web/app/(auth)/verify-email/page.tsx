'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Tooltip,
  Snackbar,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { VerifiedUser as VerifiedIcon, Email as EmailIcon } from '@mui/icons-material';
import { trpc } from '../../trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [success, setSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  useEffect(() => {
    setIsClient(true);
    
    // Redirect if no user in store
    if (isClient && !user) {
      router.replace('/login');
      return;
    }
    
    // Auto-focus first input when component mounts
    if (inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 500);
    }
    
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, user, router, isClient]);

  // Handle paste event for OTP
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // If pasted data is 6 digits, fill the OTP fields
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      
      // Focus last input after paste
      if (inputRefs.current[5]) {
        inputRefs.current[5]?.focus();
      }
    }
  };  const verifyMutation = trpc.auth.verifyOTP.useMutation({      onSuccess: async (data) => {
        if (data.success) {
          setSuccess(true);
          
          // Always update the user's verified status in the auth store
          const { setAuth, user: currentUser, token: currentToken } = useAuthStore.getState();
          
          if (currentUser && currentToken) {
            // If response contains updated token and user (for companies), use that
            if ('token' in data && 'user' in data && data.token && data.user) {
              setAuth(data.token, {
                ...data.user,
                role: data.user.role as 'customer' | 'agent' | 'company'
              });
            } else {
              // For agents and customers, just update the verified status
              setAuth(currentToken, {
                ...currentUser,
                verified: true
              });
            }
          }
          
          // Show success message briefly before redirecting
          setTimeout(() => {
            router.push(`/${user?.role}`);
          }, 1500);
        }
      },
      onError: (error) => {
        setError(error.message || 'Verification failed');
        // Clear OTP fields on error
        setOtp(['', '', '', '', '', '']);
        // Focus first input after error
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      },
    });

  const resendMutation = trpc.auth.resendOTP.useMutation({
      onSuccess: () => {
        setCountdown(60); // Increase countdown for better UX
        setError('');
        // Clear OTP fields
        setOtp(['', '', '', '', '', '']);
        // Focus first input after resend
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      },
      onError: (error) => {
        setError(error.message || 'Failed to resend code');
      },
    });

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return;
    
    // Allow clearing the input
    if (value.length > 1) value = value.slice(-1);
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // If all digits filled, automatically submit
    if (value && index === 5 && newOtp.every(digit => digit)) {
      setTimeout(() => {
        const otpString = newOtp.join('');
        verifyMutation.mutate({
          email: user?.email || '',
          otp: otpString,
          role: user?.role || 'customer',
        });
      }, 300);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to move to previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // Handle arrow keys for navigation between inputs
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    verifyMutation.mutate({
      email: user?.email || '',
      otp: otpString,
      role: user?.role || 'customer',
    });
  };

  const handleResend = () => {
    if (countdown === 0 && !resendMutation.isPending) {
      resendMutation.mutate({
        email: user?.email || '',
        role: user?.role || 'customer',
      });
    }
  };
  
  // Prevent rendering during SSR to avoid hydration issues
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
      <Box 
        sx={{ 
          textAlign: 'center', 
          mb: 3, 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'rgba(124, 58, 237, 0.1)',
            mb: 3,
          }}
        >
          <EmailIcon 
            sx={{ 
              fontSize: 40, 
              color: '#7C3AED' 
            }} 
          />
        </Box>

        <Typography 
          variant={isMobile ? "h5" : "h4"} 
          sx={{ 
            fontWeight: 700,
            background: 'linear-gradient(45deg, #7C3AED 30%, #10B981 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Verify Your Email
        </Typography>

        <Typography 
          variant="body1" 
          sx={{ 
            mt: 1, 
            color: 'text.secondary',
            maxWidth: 400,
          }}
        >
          We've sent a verification code to<br />
          <Box 
            component="span" 
            sx={{ 
              fontWeight: 600, 
              color: 'text.primary',
              wordBreak: 'break-all'
            }}
          >
            {user?.email}
          </Box>
        </Typography>
      </Box>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert 
              severity="success" 
              icon={<VerifiedIcon />} 
              sx={{ 
                mb: 3,
                alignItems: 'center',
                '& .MuiAlert-icon': {
                  fontSize: '1.5rem'
                }
              }}
            >
              Email verified successfully! Redirecting...
            </Alert>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                alignItems: 'center'
              }}
            >
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ textAlign: 'center' }}
        onPaste={handlePaste}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            mb: 2, 
            color: 'text.secondary',
            fontSize: '0.9rem'
          }}
        >
          Enter the 6-digit code
        </Typography>
        
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.5, sm: 1.5 },
            justifyContent: 'center',
            mb: 3,
          }}
        >
          {otp.map((digit, index) => (
            <TextField
              key={index}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              inputRef={(el) => (inputRefs.current[index] = el)}
              sx={{
                width: { xs: '42px', sm: '54px' },
                '& .MuiInputBase-root': {
                  borderRadius: 1.5,
                  height: { xs: '48px', sm: '56px' },
                  transition: 'all 0.2s ease',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  '&.Mui-focused': {
                    bgcolor: 'rgba(124, 58, 237, 0.08)',
                    boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.2)'
                  },
                },
                '& input': {
                  textAlign: 'center',
                  fontSize: { xs: '1.3rem', sm: '1.5rem' },
                  fontWeight: 600,
                  p: 0,
                  caretColor: '#7C3AED',
                },
              }}
              inputProps={{
                maxLength: 1,
                inputMode: 'numeric',
                pattern: '[0-9]*',
                'aria-label': `Digit ${index + 1} of verification code`,
                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, e),
              }}
            />
          ))}
        </Box>

        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ mb: 3, fontSize: '0.85rem', fontStyle: 'italic' }}
        >
          You can paste the full code at once
        </Typography>

        <Button
          fullWidth
          type="submit"
          variant="contained"
          disabled={verifyMutation.isPending || otp.join('').length !== 6}
          sx={{
            mb: 3,
            py: 1.5,
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1.05rem',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 15px rgba(124, 58, 237, 0.2)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          }}
        >
          {verifyMutation.isPending ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            'Verify Email'
          )}
        </Button>

        <Tooltip 
          title={countdown > 0 ? `Wait ${countdown} seconds` : "Click to resend"}
          placement="top"
          arrow
        >
          <span>
            <Button
              fullWidth
              variant="text"
              onClick={handleResend}
              disabled={countdown > 0 || resendMutation.isPending || verifyMutation.isPending}
              sx={{ 
                color: 'text.secondary',
                borderRadius: 1.5,
                '&:not(:disabled):hover': {
                  color: 'primary.main',
                  bgcolor: 'rgba(124, 58, 237, 0.04)',
                },
              }}
            >
              {resendMutation.isPending ? (
                <>
                  <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend code in ${countdown}s`
              ) : (
                'Resend verification code'
              )}
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Snackbar
        open={resendMutation.isSuccess}
        autoHideDuration={6000}
        onClose={() => {}}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="Verification code sent successfully"
      />
    </motion.div>
  );
}