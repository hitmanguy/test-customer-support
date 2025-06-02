'use client';

import { Box, Button, Typography, Paper, Divider } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface ErrorPageProps {
  title?: string;
  message?: string;
  code?: string | number;
  actionText?: string;
  actionHref?: string;
  showBackButton?: boolean;
}

export default function ErrorPage({
  title = "Something went wrong",
  message = "We're sorry, but we couldn't complete your request.",
  code,
  actionText = "Return to Login",
  actionHref = "/login",
  showBackButton = true
}: ErrorPageProps) {
  const router = useRouter();

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 2,
        bgcolor: 'background.default'
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
          borderRadius: 2,
          bgcolor: 'background.paper',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <ErrorIcon
          color="error"
          sx={{
            fontSize: 70,
            mb: 2
          }}
        />
        
        {code && (
          <Typography
            variant="h4"
            component="h1"
            color="error"
            fontWeight="bold"
            sx={{ mb: 1 }}
          >
            Error {code}
          </Typography>
        )}
        
        <Typography
          variant="h5"
          component="h2"
          fontWeight="bold"
          sx={{ mb: 2 }}
        >
          {title}
        </Typography>
        
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          {message}
        </Typography>
        
        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href={actionHref} passHref style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              color="primary"
              sx={{
                py: 1.5,
                borderRadius: 1.5,
                background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                boxShadow: '0 4px 6px rgba(124, 58, 237, 0.2)',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {actionText}
            </Button>
          </Link>
          
          {showBackButton && (
            <Button
              variant="outlined"
              onClick={() => router.back()}
              sx={{
                borderRadius: 1.5,
                py: 1.5,
                textTransform: 'none',
              }}
            >
              Go Back
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
