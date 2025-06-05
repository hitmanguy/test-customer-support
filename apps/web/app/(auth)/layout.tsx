'use client';

import { Box, Container, Paper, Typography, useMediaQuery, useTheme } from '@mui/material';
import ThemeRegistry from '../components/shared/ThemeRegistry';
import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isMounted, setIsMounted] = useState(false);
  
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <ThemeRegistry>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          py: { xs: 6, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {}
        <Box
          sx={{
            position: 'absolute',
            width: '60vw',
            height: '60vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
            filter: 'blur(80px)',
            top: '-20%',
            right: '-20%',
            zIndex: 0,
            opacity: 0.7,
            animation: 'pulse 15s infinite alternate',
            '@keyframes pulse': {
              '0%': { opacity: 0.5, transform: 'scale(1)' },
              '100%': { opacity: 0.7, transform: 'scale(1.05)' }
            }
          }}
        />
        
        <Box
          sx={{
            position: 'absolute',
            width: '40vw',
            height: '40vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #10B981 0%, transparent 70%)',
            filter: 'blur(100px)',
            bottom: '-10%',
            left: '-10%',
            zIndex: 0,
            opacity: 0.5,
            animation: 'pulse2 20s infinite alternate',
            '@keyframes pulse2': {
              '0%': { opacity: 0.4, transform: 'scale(1)' },
              '100%': { opacity: 0.6, transform: 'scale(1.1)' }
            }
          }}
        />

        <Container 
          maxWidth="sm" 
          sx={{ 
            position: 'relative', 
            zIndex: 1,
            px: { xs: 2, sm: 3 }
          }}
        >
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Typography
                variant={isMobile ? "h4" : "h3"}
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                  backgroundClip: 'text',
                  textFillColor: 'transparent',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.5px',
                  transition: 'transform 0.3s ease',
                  display: 'inline-block',
                  '&:hover': {
                    transform: 'scale(1.03)',
                  },
                }}
              >
                SupportHub
              </Typography>
            </Link>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mt: 1, opacity: 0.8 }}
            >
              Your complete customer support solution
            </Typography>
          </Box>
          
          {}
          {isMounted ? (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, sm: 4 },
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 2,
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)',
                }
              }}
            > 
              <Suspense fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <Typography>Loading...</Typography>
                </Box>
              }>
                {children}
              </Suspense>
            </Paper>
          ) : (
            <Box 
              sx={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Loading...
              </Typography>
            </Box>
          )}
        </Container>
      </Box>
    </ThemeRegistry>
  );
}