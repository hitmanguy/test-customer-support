'use client';

import { Box } from '@mui/material';
import { redirect } from 'next/navigation';

// This page simply redirects to the actual callback handler
export default function Page() {
  redirect('/auth/google/callback'); 
  
  return <Box>Redirecting...</Box>;
}
