'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  Avatar,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  AttachFile as AttachmentIcon,
  Download as DownloadIcon,
  CheckCircle as SolvedIcon,
  Timer as PendingIcon,
  ArrowBack as BackIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

const statusConfig = {
  open: { 
    color: '#10B981', 
    icon: <PendingIcon />, 
    label: 'Open',
    description: 'Ticket has been created and is awaiting agent response'
  },
  in_progress: { 
    color: '#F59E0B', 
    icon: <TimeIcon />, 
    label: 'In Progress',
    description: 'Agent is working on your ticket'
  },
  closed: { 
    color: '#6B7280', 
    icon: <SolvedIcon />, 
    label: 'Resolved',
    description: 'Your issue has been resolved'
  },
};

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ticketId = params.id as string;
  // Define types for ticket data
  interface TicketMessage {
    content: string;
    createdAt: string;
    isAgent: boolean;
    attachment?: string;
  }

  interface Ticket {
    _id: string;
    title: string;
    content: string;
    status: 'open' | 'in_progress' | 'closed';
    createdAt: string;
    attachment?: string;
    solution?: string;
    solution_attachment?: string;
    messages?: TicketMessage[];
    utilTicket?: {
      customer_review?: string;
      customer_review_rating?: number;
    };
  }

  interface TicketResponse {
    success: boolean;
    ticket: Ticket;
  }  // Fetch ticket details
  const { data: ticketData, isLoading } = trpc.ticket.getTicketDetails.useQuery(
    { ticketId }
  );
  // Set up polling for in-progress tickets
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (ticketData?.ticket?.status === 'in_progress') {
      intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['ticket.getTicketDetails'] });
      }, 5000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [ticketData?.ticket?.status, queryClient]);

  const ticket = ticketData?.ticket;

  // Submit review mutation
  const submitReviewMutation = trpc.ticket.submitReview.useMutation({
    onSuccess: () => {
      setIsReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ticket.getTicketDetails'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = trpc.ticket.addMessage.useMutation({
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['ticket.getTicketDetails'] });
    },
  });

  // Show review dialog when ticket is closed
  useEffect(() => {
    if (ticket?.status === 'closed' && !ticket.utilTicket?.customer_review) {
      setIsReviewOpen(true);
    }
  }, [ticket]);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    if (messagesEndRef.current && ticket?.status === 'in_progress') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.messages]);

  const handleSubmitReview = async () => {
    if (!rating) return;

    try {
      await submitReviewMutation.mutateAsync({
        ticketId,
        review,
        rating,
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessageMutation.mutateAsync({
        ticketId,
        content: newMessage,
        isAgent: false,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ticket) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error">Ticket not found</Typography>
        <Button 
          variant="outlined" 
          onClick={() => router.back()} 
          sx={{ mt: 2 }}
          startIcon={<BackIcon />}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Ticket Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {ticket.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                icon={statusConfig[ticket.status].icon}
                label={statusConfig[ticket.status].label}
                sx={{
                  bgcolor: `${statusConfig[ticket.status].color}15`,
                  color: statusConfig[ticket.status].color,
                  fontWeight: 600,
                }}
              />
              <Typography variant="body2" color="text.secondary">
                Created {formatDistanceToNow(new Date(ticket.createdAt))} ago
              </Typography>
              {ticket.utilTicket?.customer_review_rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Rating value={ticket.utilTicket.customer_review_rating} readOnly size="small" />
                </Box>
              )}
            </Box>
          </Box>
          <Button 
            variant="outlined" 
            onClick={() => router.back()}
            startIcon={<BackIcon />}
          >
            Back to Tickets
          </Button>
        </Box>

        {/* Status Description */}
        <Paper
          sx={{
            mt: 2,
            p: 2,
            bgcolor: `${statusConfig[ticket.status].color}10`,
            border: '1px solid',
            borderColor: `${statusConfig[ticket.status].color}30`,
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color={statusConfig[ticket.status].color}>
            {statusConfig[ticket.status].description}
          </Typography>
        </Paper>
      </Box>

      {/* Ticket Content */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>
          {ticket.content}
        </Typography>

        {ticket.attachment && (
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <AttachmentIcon color="primary" />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
              Attachment
            </Typography>
            <IconButton
              component="a"
              href={ticket.attachment}
              target="_blank"
              download
              color="primary"
            >
              <DownloadIcon />
            </IconButton>
          </Box>
        )}
      </Paper>

      {/* Solution Section */}
      {ticket.solution && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'rgba(16, 185, 129, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid',
            borderColor: '#10B981',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, color: '#10B981' }}>
            Solution
          </Typography>
          
          <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>
            {ticket.solution}
          </Typography>

          {ticket.solution_attachment && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <AttachmentIcon color="primary" />
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                Solution Attachment
              </Typography>
              <IconButton
                component="a"
                href={ticket.solution_attachment}
                target="_blank"
                download
                color="primary"
              >
                <DownloadIcon />
              </IconButton>
            </Box>
          )}
        </Paper>
      )}

      {/* Chat Interface for in-progress tickets */}
      {ticket.status === 'in_progress' && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            height: '400px',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            Chat with Support
          </Typography>
            {/* Chat Messages */}
          <Box sx={{ 
            flex: 1,
            overflow: 'auto',
            mb: 2,
            display: 'flex', 
            flexDirection: 'column',
            gap: 2
          }}>
            {ticket.messages && ticket.messages.length > 0 ? (
              (ticket.messages as TicketMessage[]).map((message, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    flexDirection: message.isAgent ? 'row' : 'row-reverse',
                    gap: 1,
                    alignItems: 'flex-start',
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: message.isAgent ? 'primary.main' : 'secondary.main',
                      width: 32,
                      height: 32,
                    }}
                  >
                    {message.isAgent ? 'A' : 'C'}
                  </Avatar>
                  <Paper
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      maxWidth: '80%',
                      bgcolor: message.isAgent ? 'grey.100' : 'primary.light',
                      color: message.isAgent ? 'text.primary' : 'white',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7, textAlign: 'right' }}>
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </Typography>
                  </Paper>
                </Box>
              ))
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography color="text.secondary">No messages yet. Start the conversation!</Typography>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Message Input */}
          <Box component="form" onSubmit={handleSendMessage} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton 
                      color="primary" 
                      type="submit" 
                      disabled={sendMessageMutation.isPending || !newMessage.trim()}
                    >
                      {sendMessageMutation.isPending ? <CircularProgress size={20} /> : <SendIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Paper>
      )}

      {/* Review Dialog */}
      <Dialog 
        open={isReviewOpen} 
        onClose={() => ticket?.utilTicket?.customer_review ? setIsReviewOpen(false) : null}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            How was your experience?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, my: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography gutterBottom>Rate the solution provided</Typography>
              <Rating
                value={rating}
                onChange={(_, newValue) => setRating(newValue)}
                size="large"
                sx={{ '& .MuiRating-icon': { fontSize: '2rem' } }}
              />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Your Review (Optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Tell us what you liked or what could be improved..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setIsReviewOpen(false)} disabled={submitReviewMutation.isPending}>
            Skip
          </Button>
          <Button
            onClick={handleSubmitReview}
            disabled={!rating || submitReviewMutation.isPending}
            variant="contained"
            sx={{
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            }}
          >
            {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}