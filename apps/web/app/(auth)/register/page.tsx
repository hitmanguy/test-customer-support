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
  Chip,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import GoogleAuthButton from '@web/app/components/shared/GoogleAuthButton';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import Link from 'next/link';

type UserRole = 'customer' | 'agent' | 'company';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  support_emails: string[];
}

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    role: 'customer',
    companyId: '',
    companyName: '',
    support_emails: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [newSupportEmail, setNewSupportEmail] = useState('');

  // Different registration mutations for each role
  const customerRegisterMutation = trpc.auth.registerCustomer.useMutation({
      onSuccess: handleRegistrationSuccess,
      onError: (error) => setError(error.message),
    })

  const agentRegisterMutation = trpc.auth.registerAgent.useMutation({
      onSuccess: handleRegistrationSuccess,
      onError: (error) => setError(error.message),
    })

  const companyRegisterMutation = trpc.auth.registerCompany.useMutation({
      onSuccess: handleRegistrationSuccess,
      onError: (error) => setError(error.message),
    })



  function handleRegistrationSuccess(data: any) {
    if (data.success && data.token && data.user) {
      setAuth(data.token, data.user);
      router.push('/verify-email');
    }
  }

  const addSupportEmail = () => {
    if (newSupportEmail && !formData.support_emails.includes(newSupportEmail)) {
      setFormData({
        ...formData,
        support_emails: [...formData.support_emails, newSupportEmail],
      });
      setNewSupportEmail('');
    }
  };

  const removeSupportEmail = (email: string) => {
    setFormData({
      ...formData,
      support_emails: formData.support_emails.filter(e => e !== email),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.role === 'company' && activeStep === 0) {
      setActiveStep(1);
      return;
    }

    try {
      switch (formData.role) {
        case 'customer':
          customerRegisterMutation.mutate({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          });
          break;

        case 'agent':
          if (!formData.companyId) {
            setError('Company ID is required');
            return;
          }
          agentRegisterMutation.mutate({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            companyId: formData.companyId,
          });
          break;

        case 'company':
          if (!formData.companyName || formData.support_emails.length === 0) {
            setError('Please fill all company details');
            return;
          }
          companyRegisterMutation.mutate({
            name: formData.companyName,
            o_name: formData.name,
            o_email: formData.email,
            o_password: formData.password,
            support_emails: formData.support_emails,
          });
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
        <Typography variant="h4" sx={{ mb: 4, textAlign: 'center', fontWeight: 700 }}>
          Create Account
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

        {formData.role === 'company' && (
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            <Step>
              <StepLabel>Basic Information</StepLabel>
            </Step>
            <Step>
              <StepLabel>Company Details</StepLabel>
            </Step>
          </Stepper>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {activeStep === 0 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>I am a</InputLabel>
                  <Select
                    value={formData.role}
                    label="I am a"
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        role: e.target.value as UserRole,
                        companyId: '',
                        companyName: '',
                        support_emails: [],
                      });
                      setActiveStep(0);
                    }}
                  >
                    <MenuItem value="customer">Customer</MenuItem>
                    <MenuItem value="agent">Support Agent</MenuItem>
                    <MenuItem value="company">Company Owner</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label={formData.role === 'company' ? "Owner Name" : "Name"}
                  margin="normal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <TextField
                  fullWidth
                  label={formData.role === 'company' ? "Owner Email" : "Email"}
                  type="email"
                  margin="normal"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  margin="normal"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
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

                {formData.role === 'agent' && (
                  <TextField
                    fullWidth
                    label="Company ID"
                    margin="normal"
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    required
                    helperText="Enter the ID provided by your company"
                  />
                )}
              </motion.div>
            )}

            {activeStep === 1 && formData.role === 'company' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <TextField
                  fullWidth
                  label="Company Name"
                  margin="normal"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Support Email Addresses
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add support email"
                      value={newSupportEmail}
                      onChange={(e) => setNewSupportEmail(e.target.value)}
                      type="email"
                    />
                    <Button
                      variant="outlined"
                      onClick={addSupportEmail}
                      disabled={!newSupportEmail}
                    >
                      <AddIcon />
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {formData.support_emails.map((email) => (
                      <Chip
                        key={email}
                        label={email}
                        onDelete={() => removeSupportEmail(email)}
                        deleteIcon={<CloseIcon />}
                      />
                    ))}
                  </Box>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

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
            disabled={
              customerRegisterMutation.isPending ||
              agentRegisterMutation.isPending ||
              companyRegisterMutation.isPending
            }
          >
            {customerRegisterMutation.isPending ||
             agentRegisterMutation.isPending ||
             companyRegisterMutation.isPending
              ? 'Creating Account...'
              : formData.role === 'company' && activeStep === 0
              ? 'Next'
              : 'Create Account'}
          </Button>          {activeStep === 0 && formData.role !== 'company' && (
            <>
              <Divider sx={{ my: 2 }}>OR</Divider>

              {/* Show validation warning for agents without companyId */}
              {formData.role === 'agent' && !formData.companyId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Please fill in your Company ID above before continuing with Google
                </Alert>
              )}

              <GoogleAuthButton 
                role={formData.role}
                companyId={formData.role === 'agent' ? formData.companyId : undefined} 
                label="Continue with Google"
                disabled={formData.role === 'agent' && !formData.companyId}
              />
            </>
          )}

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ display: 'inline' }}>
              Already have an account?{' '}
            </Typography>
            <Link href="/login" passHref>
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
                Sign In
              </MuiLink>
            </Link>
          </Box>
        </Box>
      </Paper>
    </motion.div>
  );
}