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

  // Fetch ticket details using the agent router
  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['ticket', params.id],
    queryFn: async () => {
      try {
        // Use the getTicketDetails endpoint from the agent router
        const result = trpc.agent.getTicketDetails.useQuery({
          ticketId: params.id,
        })
        
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
      await updateTicketStatusMutation.mutateAsync({
        ticketId: params.id,
        status: newStatus,
      } as any); // TODO: Fix type
    } catch (error) {
      console.error('Failed to update ticket status:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !attachment) return;
    setIsSubmitting(true);

    try {
      // Handle file upload if needed
      let attachmentUrl = '';
      if (attachment) {
        // Upload file using the utils router
        const formData = new FormData();
        formData.append('file', attachment);
        
        try {
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          if (uploadResponse.ok) {
            const data = await uploadResponse.json();
            attachmentUrl = data.url;
          }
        } catch (uploadError) {
          console.error('Failed to upload attachment:', uploadError);
        }
      }
  
      // Add message to ticket
      await addMessageMutation.mutateAsync({
        ticketId: params.id,
        content: newMessage,
        attachment: attachmentUrl,
        isAgent: true,
      } as any); // TODO: Fix type
      
      setNewMessage('');
      setAttachment(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityLevel = (rate: number): PriorityLevel => {
    if (rate <= 2) return 'low';
    if (rate >= 4) return 'high';
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
                  #{ticket._id} - {ticket.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {ticket.aiTicket && (
                    <Chip
                      label={`Priority: ${ticket.aiTicket.priority_rate}`}
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
