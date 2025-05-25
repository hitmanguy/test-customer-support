'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  AttachFile as AttachmentIcon,
  Download as DownloadIcon,
  CheckCircle as SolvedIcon,
  Timer as PendingIcon,
  ArrowBack as BackIcon,
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

  const ticketId = params.id as string;

  // Fetch ticket details
  const { data: ticketData, isLoading } = trpc.ticket.getTicketDetails.useQuery({ ticketId });

  const ticket = ticketData?.ticket;

  // Submit review mutation
  const submitReviewMutation = trpc.ticket.submitReview.useMutation({
    onSuccess: () => {
      setIsReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ticket.getTicketDetails'] });
    },
  })

  // Show review dialog when ticket is closed
  useEffect(() => {
    if (ticket?.status === 'closed' && !ticket.utilTicket?.customer_review) {
      setIsReviewOpen(true);
    }
  }, [ticket]);

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