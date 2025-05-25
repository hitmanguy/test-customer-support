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
  Tooltip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery,useMutation } from '@tanstack/react-query';

export default function CreateTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('company');
  const { user } = useAuthStore();

  const [ticketData, setTicketData] = useState({
    title: '',
    content: '',
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get all agents for the company
  const { data: agentsData } = trpc.utils.getCompanyAgents.useQuery({
      companyId: companyId || '',
      verified: true,
      page: 1,
      limit: 100,
    })


  // Get all open tickets
  const { data: ticketsData } = trpc.ticket.getTicketsByQuery.useQuery({
      companyId: companyId || '',
      status: 'open',
      page: 1,
      limit: 1000,
    })
  

  // Find least busy agent
  const findLeastBusyAgent = () => {
    if (!agentsData?.items || !ticketsData?.tickets) return null;

    const ticketCounts = new Map<string, number>();
    agentsData.items.forEach((agent: { _id: string }) => ticketCounts.set(agent._id, 0));

    ticketsData.tickets.forEach(ticket => {
      const currentCount = ticketCounts.get(ticket.agentId) || 0;
      ticketCounts.set(ticket.agentId, currentCount + 1);
    });

    let minTickets = Infinity;
    let leastBusyAgents: string[] = [];

    ticketCounts.forEach((count, agentId) => {
      if (count < minTickets) {
        minTickets = count;
        leastBusyAgents = [agentId];
      } else if (count === minTickets) {
        leastBusyAgents.push(agentId);
      }
    });

    const randomIndex = Math.floor(Math.random() * leastBusyAgents.length);
    return leastBusyAgents[randomIndex];
  };

  // ... existing imports ...

// Add loading and error states
const createTicketMutation = trpc.ticket.createTicket.useMutation({
  onSuccess: () => {
    router.push(`/customer/tickets?company=${companyId}`);
  },
  onError: (error) => {
    setError(error.message);
  },
});

// Modify handleSubmit function
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setIsSubmitting(true);

  try {
    if (!ticketData.title || !ticketData.content) {
      throw new Error('Please fill in all required fields');
    }

    let fileUrl = '';
    if (attachment) {
      // File validation remains the same...
      const formData = new FormData();
      formData.append('file', attachment);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const uploadResult = await uploadResponse.json();
      fileUrl = uploadResult.fileUrl;
    }

    // Find least busy agent
    const selectedAgentId = findLeastBusyAgent();
    if (!selectedAgentId) {
      throw new Error('No available agents found');
    }

    await createTicketMutation.mutateAsync({
      title: ticketData.title,
      content: ticketData.content,
      attachment: fileUrl || undefined,
      sender_role: 'customer',
      customerId: user?.id || '',
      companyId: companyId || '',
      agentId: selectedAgentId,
    });
  } catch (err: any) {
    setError(err.message || 'Failed to create ticket');
  } finally {
    setIsSubmitting(false);
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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
        />

        <Box sx={{ mb: 3 }}>
          <input
            type="file"
            id="file-upload"
            onChange={(e) => e.target.files?.[0] && setAttachment(e.target.files[0])}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx"
            disabled={isSubmitting}
          />
          <label htmlFor="file-upload">
            <Button
              component="span"
              variant="outlined"
              startIcon={<UploadIcon />}
              disabled={isSubmitting}
            >
              Attach File
            </Button>
            <Tooltip title="Maximum file size: 5MB. Allowed types: JPG, PNG, PDF, DOC">
              <IconButton size="small" sx={{ ml: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
              <IconButton 
                size="small" 
                onClick={() => setAttachment(null)}
                disabled={isSubmitting}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          )}
        </Box>

        <Button
          fullWidth
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          sx={{
            py: 1.5,
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          {isSubmitting ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            'Submit Ticket'
          )}
        </Button>
      </Paper>
    </Box>
  );
}