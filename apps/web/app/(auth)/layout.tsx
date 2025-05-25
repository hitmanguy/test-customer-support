'use client';

import { Box, Container, Paper, Typography } from '@mui/material';
import ThemeRegistry from '../components/shared/ThemeRegistry';
import Image from 'next/image';
import { Suspense } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'background.default',
          py: 12,
          position: 'relative',
        }}
      >
        {/* Background gradient */}
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
          }}
        />

        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SupportHub
          </Typography>
          </Box>
          
          <Paper
            elevation={0}
            sx={{
              p: 4,
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          > <Suspense>
            {children}
          </Suspense>
          </Paper>
        </Container>
      </Box>
    </ThemeRegistry>
  );
}