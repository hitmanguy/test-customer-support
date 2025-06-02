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
  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = trpc.utils.getCompanyAgents.useQuery({
    companyId: companyId || '',
    verified: true,
    page: 1,
    limit: 50,
  }, {
    enabled: !!companyId
  });

  // Get all open tickets
  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = trpc.ticket.getTicketsByQuery.useQuery({
    companyId: companyId || '',
    status: 'open',
    page: 1,
    limit: 50,
  }, {
    enabled: !!companyId
  });

  // Find least busy agent
  const findLeastBusyAgent = () => {
    console.log('=== DEBUG findLeastBusyAgent (ticket create) ===');
    console.log('companyId:', companyId);
    console.log('agentsLoading:', agentsLoading);
    console.log('agentsError:', agentsError);
    console.log('ticketsLoading:', ticketsLoading);
    console.log('ticketsError:', ticketsError);
    console.log('agentsData:', agentsData);
    console.log('ticketsData:', ticketsData);

    // Check if queries are still loading
    if (agentsLoading || ticketsLoading) {
      console.log('⏳ Still loading data...');
      return null;
    }

    // Check for query errors
    if (agentsError) {
      console.error('❌ Agents query error:', agentsError);
      return null;
    }

    if (ticketsError) {
      console.error('❌ Tickets query error:', ticketsError);
      return null;
    }

    // Log the actual structure we received
    console.log('agentsData structure:', JSON.stringify(agentsData, null, 2));
    console.log('ticketsData structure:', JSON.stringify(ticketsData, null, 2));

    // Check if we have the expected data structure
    const agents = agentsData?.items || [];
    const tickets = ticketsData?.tickets || [];

    console.log('Extracted agents:', agents);
    console.log('Extracted tickets:', tickets);

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      console.log('❌ No agents found or invalid agents data');
      console.log('agents is array:', Array.isArray(agents));
      console.log('agents length:', agents?.length);
      return null;
    }

    if (!tickets || !Array.isArray(tickets)) {
      console.log('⚠️ No tickets found or invalid tickets data, but proceeding with 0 tickets for all agents');
      // Proceed with empty tickets array - this is valid (no tickets yet)
    }

    const ticketCounts = new Map<string, number>();
    
    // Initialize all agents with 0 tickets
    agents.forEach((agent: any) => {
      const agentId = agent._id || agent.id;
      console.log('Adding agent to ticketCounts:', agentId, 'Agent object:', agent);
      if (agentId) {
        ticketCounts.set(agentId, 0);
      }
    });

    console.log('Initial ticket counts:', Object.fromEntries(ticketCounts));

    // Count tickets if we have any
    if (tickets && Array.isArray(tickets)) {
      tickets.forEach((ticket: any) => {
        console.log('Processing ticket:', ticket);
        const agentId = ticket.agentId || ticket.agent_id || ticket.assignedTo;
        console.log('Ticket agentId:', agentId);
        
        if (agentId && ticketCounts.has(agentId)) {
          const currentCount = ticketCounts.get(agentId) || 0;
          ticketCounts.set(agentId, currentCount + 1);
          console.log(`Updated agent ${agentId} ticket count to:`, currentCount + 1);
        } else {
          console.log('⚠️ Ticket has no valid agentId or agent not found in agents list');
        }
      });
    }

    console.log('Final ticket counts:', Object.fromEntries(ticketCounts));

    if (ticketCounts.size === 0) {
      console.log('❌ No valid agents found');
      return null;
    }

    let minTickets = Infinity;
    let leastBusyAgents: string[] = [];

    ticketCounts.forEach((count, agentId) => {
      console.log(`Agent ${agentId} has ${count} tickets`);
      if (count < minTickets) {
        minTickets = count;
        leastBusyAgents = [agentId];
      } else if (count === minTickets) {
        leastBusyAgents.push(agentId);
      }
    });

    console.log('Min tickets:', minTickets);
    console.log('Least busy agents:', leastBusyAgents);

    if (leastBusyAgents.length === 0) {
      console.log('❌ No least busy agents found');
      return null;
    }

    // Randomly select one of the least busy agents
    const randomIndex = Math.floor(Math.random() * leastBusyAgents.length);
    const selectedAgent = leastBusyAgents[randomIndex];
    console.log('Selected agent:', selectedAgent);
    console.log('=== END DEBUG ===');
    return selectedAgent;
  };

  const createTicketMutation = trpc.ticket.createTicket.useMutation();

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
        // File validation
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        if (attachment.size > maxSize) {
          throw new Error('File size must be less than 5MB');
        }
        
        if (!allowedTypes.includes(attachment.type)) {
          throw new Error('Invalid file type. Only JPG, PNG, PDF, and DOC files are allowed');
        }

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

      // Reset form and redirect
      router.push(`/customer/tickets?company=${companyId}`);
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