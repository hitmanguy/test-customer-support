'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Grid,
  TextField,
  Button,
  Avatar,
  IconButton,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Check as CheckIcon,
  Pause as PauseIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { trpc } from '@web/app/trpc/client';
import { LoadingAnimation } from '@web/app/components/shared/LoadingAnimation';
import { useAuthStore } from '@web/app/store/authStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Message } from '@web/app/types/ticket';

const statusColors = {
  open: '#22C55E',
  in_progress: '#EAB308',
  closed: '#64748B',
} as const;

type TicketStatus = keyof typeof statusColors;

// Define the TicketResponse type to match the expected API response
interface TicketResponse {
  success: boolean;
  ticket: Ticket | null;
}

const priorityColors = {
  low: '#22C55E',
  medium: '#EAB308',
  high: '#EF4444',
} as const;

type PriorityLevel = keyof typeof priorityColors;
interface Ticket {
  _id: string;
  title: string;
  content: string;
  attachment?: string;
  status: 'open' | 'in_progress' | 'closed';
  createdAt: string;
  updatedAt: string;
  customerId: string;
  companyId: string;
  agentId?: string;
  agent?: {
    _id: string;
    name: string;
    image?: string;
  };
  customer?: {
    _id: string;
    name: string;
    image?: string;
  };
  aiTicket?: {
    summarized_content: string;
    predicted_solution: string;
    priority_rate: number;
  };
  aiSuggestions?: string[];
  messages?: Message[];
  chatId?: string;
  __v: number;
}

export default function TicketPage({ params }: { params: { id: string } }) {
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  // Mock the ticket data since the API call is having type issues
  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['ticket', params.id],
    queryFn: async () => {
      try {
        //In a real app, this would call:
        const result = trpc.ticket.getTicketById.useQuery({
          id: params.id,
        })
        
        // For now, return mock data
        // await new Promise(r => setTimeout(r, 1000)); // Simulate API delay
        // return {
        //   success: true,
        //   ticket: {
        //     _id: params.id,
        //     title: 'Customer Account Access Issue',
        //     content: 'I cannot login to my account. It keeps saying invalid credentials.',
        //     status: 'in_progress' as const,
        //     createdAt: new Date().toISOString(),
        //     updatedAt: new Date().toISOString(),
        //     customerId: 'customer-123',
        //     companyId: 'company-456',
        //     agentId: user?.id,
        //     __v: 0,
        //     customer: {
        //       _id: 'customer-123',
        //       name: 'Jane Doe',
        //       image: undefined
        //     },
        //     aiTicket: {
        //       summarized_content: 'Customer unable to login due to credential issues',
        //       predicted_solution: 'Verify identity and reset password',
        //       priority_rate: 0.8
        //     },
        //     aiSuggestions: [
        //       'Have you tried resetting your password?',
        //       'I can help you verify your account and reset your credentials.'
        //     ],
        //     messages: [
        //       {
        //         _id: 'msg-1',
        //         content: 'I cannot login to my account. It keeps saying invalid credentials.',
        //         isAgent: false,
        //         createdAt: new Date(Date.now() - 3600000).toISOString()
        //       },
        //       {
        //         _id: 'msg-2',
        //         content: 'I understand you're having trouble logging in. Let me verify your account and help you reset your password.',
        //         isAgent: true,
        //         createdAt: new Date(Date.now() - 1800000).toISOString()
        //       }
        //     ]
        //   }
        // } as TicketResponse;
        return result.data as TicketResponse;
      } catch (error) {
        console.error('Failed to fetch ticket:', error);
        throw error;
      }
    }
  });

  const ticket = ticketData?.ticket;

  const updateTicketStatusMutation = trpc.ticket.updateTicketStatus.useMutation();
  const addMessageMutation = trpc.ticket.addMessage.useMutation();

  if (isLoading) {
    return <LoadingAnimation message="Loading ticket details..." />;
  }

  if (!ticket) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5">Ticket not found</Typography>
      </Box>
    );
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      // Mock status change
      console.log(`Status changed to: ${newStatus}`);
      
      // In a real app we would call:
      
      await updateTicketStatusMutation.mutateAsync({
        ticketId: params.id,
        status: newStatus,
      });
      
    } catch (error) {
      console.error('Failed to update ticket status:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !attachment) return;
    setIsSubmitting(true);

    try {
      // Mock file upload - in a real app this would call the API
      let attachmentUrl = '';
      if (attachment) {
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
      attachmentUrl = uploadResult.fileUrl;
      }
      
      // In a real app we would call the API:

      await addMessageMutation.mutateAsync({
        ticketId: params.id,
        content: newMessage,
        attachment: attachmentUrl,
        isAgent: true,
      });
      
      setNewMessage('');
      setAttachment(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityLevel = (rate: number): PriorityLevel => {
    if (rate < 0.4) return 'low';
    if (rate >= 0.7) return 'high';
    return 'medium';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Grid container spacing={3}>
          {/* Ticket Header */}
          <Grid size = {{xs:12}}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  #{ticket._id.substring(0, 6)} - {ticket.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {ticket.aiTicket && (
                    <Chip
                      label={`Priority: ${getPriorityLevel(ticket.aiTicket.priority_rate)}`}
                      sx={{
                        bgcolor: `${priorityColors[getPriorityLevel(ticket.aiTicket.priority_rate)]}15`,
                        color: priorityColors[getPriorityLevel(ticket.aiTicket.priority_rate)],
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Chip
                    label={ticket.status}
                    sx={{
                      bgcolor: `${statusColors[ticket.status as TicketStatus]}15`,
                      color: statusColors[ticket.status as TicketStatus],
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Box>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Created on {new Date(ticket.createdAt).toLocaleDateString()}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant={ticket.status === 'in_progress' ? 'contained' : 'outlined'}
                  startIcon={<PauseIcon />}
                  onClick={() => handleStatusChange('in_progress')}
                  color="warning"
                >
                  In Progress
                </Button>
                <Button
                  variant={ticket.status === 'closed' ? 'contained' : 'outlined'}
                  startIcon={<CheckIcon />}
                  onClick={() => handleStatusChange('closed')}
                  color="success"
                >
                  Resolve
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Main Content and AI Assistant */}
          <Grid size = {{xs:12,md:8}}>
            <Paper sx={{ p: 3, mb: { xs: 3, md: 0 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Conversation</Typography>
                {ticket.chatId && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {/* Handle view chat history */}}
                  >
                    View Chat History
                  </Button>
                )}
              </Box>
              
              {/* Initial ticket content */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <Avatar
                    src={ticket.customer?.image}
                    sx={{ width: 40, height: 40 }}
                  />
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      bgcolor: 'grey.100',
                    }}
                  >
                    <Typography variant="body2">{ticket.content}</Typography>
                    {ticket.attachment && (
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<AttachFileIcon />}
                        href={ticket.attachment}
                        target="_blank"
                        sx={{ mt: 1 }}
                      >
                        View Attachment
                      </Button>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, mt: 1 }}>
                      Initial message
                    </Typography>
                  </Paper>
                </Box>

                {/* Message history */}
                {ticket.messages?.map((message: Message, index: number) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      mb: 2,
                      flexDirection: message.isAgent ? 'row-reverse' : 'row',
                    }}
                  >
                    <Avatar
                      src={message.isAgent ? ticket.agent?.image : ticket.customer?.image}
                      sx={{ width: 40, height: 40 }}
                    />
                    <Paper
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        bgcolor: message.isAgent ? 'primary.light' : 'grey.100',
                        color: message.isAgent ? 'white' : 'inherit',
                      }}
                    >
                      <Typography variant="body2">{message.content}</Typography>
                      {message.attachment && (
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<AttachFileIcon />}
                          href={message.attachment}
                          target="_blank"
                          sx={{ 
                            mt: 1,
                            color: message.isAgent ? 'inherit' : 'primary',
                          }}
                        >
                          View Attachment
                        </Button>
                      )}
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, mt: 1 }}>
                        {new Date(message.createdAt).toLocaleString()}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
              </Box>

              {/* Message input */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  disabled={isSubmitting}
                />
                <input
                  type="file"
                  id="ticket-attachment"
                  onChange={(e) => e.target.files?.[0] && setAttachment(e.target.files[0])}
                  style={{ display: 'none' }}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <label htmlFor="ticket-attachment">
                  <IconButton
                    component="span"
                    disabled={isSubmitting}
                    sx={{ p: 1 }}
                  >
                    <AttachFileIcon />
                  </IconButton>
                </label>
                {attachment && (
                  <Chip
                    label={attachment.name}
                    onDelete={() => setAttachment(null)}
                    disabled={isSubmitting}
                  />
                )}
                <Button
                  variant="contained"
                  endIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
                  onClick={handleSendMessage}
                  disabled={isSubmitting || (!newMessage.trim() && !attachment)}
                  sx={{ minWidth: 100 }}
                >
                  Send
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* AI Suggestions */}
          <Grid size = {{xs:12,md:4}}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>AI Suggestions</Typography>
                
                {ticket.aiTicket && (
                  <>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                      AI Analysis
                    </Typography>
                    <Paper
                      sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}
                    >
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Summary:</strong> {ticket.aiTicket.summarized_content}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Suggested Solution:</strong> {ticket.aiTicket.predicted_solution}
                      </Typography>
                    </Paper>
                  </>
                )}

                <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                  Response Suggestions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {ticket.aiSuggestions?.map((suggestion: string, index: number) => (
                    <Paper
                      key={index}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: 'primary.50',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'primary.100',
                          transform: 'translateX(8px)',
                        },
                      }}
                      onClick={() => setNewMessage(suggestion)}
                    >
                      <Typography variant="body2">{suggestion}</Typography>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </motion.div>
  );
}
