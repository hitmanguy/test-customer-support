'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { useTRPC } from '@web/app/trpc/client';
import { useMutation } from '@tanstack/react-query';

export default function CreateTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('company');
  const trpc = useTRPC();
  const { user } = useAuthStore();

  const [ticketData, setTicketData] = useState({
    title: '',
    content: '',
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState('');

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let fileUrl = '';
      
      if (attachment) {
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: data,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }
        
        const uploadResult = await uploadResponse.json();
        fileUrl = uploadResult.fileUrl;
      }
    return trpc.ticket.createTicket.mutate({
        title: ticketData.title,
        content: ticketData.content,
        attachment: fileUrl || undefined,
        sender_role: 'customer',
        customerId: user?.id || '',
        companyId: companyId || '',
      });
    },
    onSuccess: () => {
      router.push(`/customer/tickets?company=${companyId}`);
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!ticketData.title || !ticketData.content) {
      setError('Please fill in all required fields');
      return;
    }

    const formData = new FormData();
    if (attachment) {
      formData.append('file', attachment);
    }

    createTicketMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  if (!companyId) {
    router.push('/customer');
    return null;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        Create New Ticket
      </Typography>

      <Paper
        component={motion.form}
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        elevation={0}
        sx={{
          p: 3,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Title"
          value={ticketData.title}
          onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
          sx={{ mb: 3 }}
          required
        />

        <TextField
          fullWidth
          label="Description"
          multiline
          rows={6}
          value={ticketData.content}
          onChange={(e) => setTicketData({ ...ticketData, content: e.target.value })}
          sx={{ mb: 3 }}
          required
        />

        <Box sx={{ mb: 3 }}>
          <input
            type="file"
            id="file-upload"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx"
          />
          <label htmlFor="file-upload">
            <Button
              component="span"
              variant="outlined"
              startIcon={<UploadIcon />}
            >
              Attach File
            </Button>
          </label>

          {attachment && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mt: 2,
              p: 1,
              borderRadius: 1,
              bgcolor: 'background.paper' 
            }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {attachment.name}
              </Typography>
              <IconButton size="small" onClick={() => setAttachment(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
          )}
        </Box>

        <Button
          fullWidth
          type="submit"
          variant="contained"
          disabled={createTicketMutation.isPending}
          sx={{
            py: 1.5,
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          {createTicketMutation.isPending ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            'Submit Ticket'
          )}
        </Button>
      </Paper>
    </Box>
  );
}