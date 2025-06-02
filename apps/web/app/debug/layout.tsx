'use client';

import { Box, Typography, Container } from '@mui/material';

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom 
          sx={{ 
            borderBottom: '2px solid', 
            borderColor: 'primary.main',
            pb: 1
          }}
        >
          Debug Tools
        </Typography>
        
        <Box sx={{ mt: 4 }}>
          {children}
        </Box>
      </Box>
    </Container>
  );
}
