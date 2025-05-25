'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Button,
  Avatar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  Close as CloseIcon,
  CheckCircle as ConfirmIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';

// This will be replaced with your AI integration
const mockBotResponse = async (message: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return "I understand your concern. Let me help you with that...";
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isTicketSuggested, setIsTicketSuggested] = useState(false);
  const [suggestedTicket, setSuggestedTicket] = useState<any>(null);

  const companyId = params.id as string;

  // Fetch or create chat
  const { data: chatData, isLoading } = trpc.chat.getLatestCompanyChat.useQuery({
      customerId: user?.id || '',
      companyId,
    })

  type ChatMessage = {
    role: 'customer' | 'bot';
    content: string;
    attachment?: string;
    createdAt: string;
  };

  type Chat = {
    _id: string;
    contents: ChatMessage[];
  };

  const chat = chatData?.chat as Chat | undefined;

  // Mutations
  const sendMessageMutation = trpc.chat.addMessage.useMutation();
  const createTicketMutation = trpc.ticket.createTicket.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat?.contents]);

  const handleSendMessage = async () => {
    if (!message.trim() && !attachment) return;

    try {
      let attachmentUrl = '';
      if (attachment) {
        const formData = new FormData();
        formData.append('file', attachment);
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadResponse.ok) {
          const { fileUrl } = await uploadResponse.json();
          attachmentUrl = fileUrl;
        }
      }

      // Send user message
      await sendMessageMutation.mutateAsync({
        chatId: chat?._id || '',
        message: {
          role: 'customer',
          content: message,
          attachment: attachmentUrl,
        },
      });

      setMessage('');
      setAttachment(null);

      // Get bot response
      const botResponse = await mockBotResponse(message);
      
      // Send bot response
      await sendMessageMutation.mutateAsync({
        chatId: chat?._id || '',
        message: {
          role: 'bot',
          content: botResponse,
        },
      });

      // Simulate ticket suggestion (replace with your AI logic)
      if (message.toLowerCase().includes('problem') || message.toLowerCase().includes('issue')) {
        setIsTicketSuggested(true);
        setSuggestedTicket({
          title: 'Issue reported via chat',
          content: message,
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const { data: agentsData } = trpc.utils.getCompanyAgents.useQuery({
      companyId,
      verified: true,
      page: 1,
      limit: 100,
    })

  // Get all open tickets
  const { data: ticketsData } = trpc.ticket.getTicketsByQuery.useQuery({
      companyId,
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

    // Randomly select one of the least busy agents
    const randomIndex = Math.floor(Math.random() * leastBusyAgents.length);
    return leastBusyAgents[randomIndex];
  };

  // Update the handleCreateTicket function
  const handleCreateTicket = async () => {
    if (!suggestedTicket) return;

    try {
      // Find least busy agent
      const selectedAgentId = findLeastBusyAgent();
      if (!selectedAgentId) {
        throw new Error('No available agents found');
      }

      await createTicketMutation.mutateAsync({
        title: suggestedTicket.title,
        content: suggestedTicket.content,
        customerId: user?.id || '',
        companyId,
        sender_role: 'customer',
        agentId: selectedAgentId,
        chatId: chat?._id,
      });

      setIsTicketSuggested(false);
      setSuggestedTicket(null);

      // Send confirmation message
      await sendMessageMutation.mutateAsync({
        chatId: chat?._id || '',
        message: {
          role: 'bot',
          content: "I've created a support ticket for you. Our support team will review it shortly.",
        },
      });

      // Optional: Add agent name to the confirmation
      const assignedAgent = agentsData?.items.find((agent: { _id: string }) => agent._id === selectedAgentId);
      if (assignedAgent) {
        await sendMessageMutation.mutateAsync({
          chatId: chat?._id || '',
          message: {
            role: 'bot',
            content: `Your ticket has been assigned to ${assignedAgent.name}.`,
          },
        });
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      
      // Send error message to chat
      await sendMessageMutation.mutateAsync({
        chatId: chat?._id || '',
        message: {
          role: 'bot',
          content: "I'm sorry, but I couldn't create the ticket at this moment. Please try again later.",
        },
      });
    }
  };
  
  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Avatar
          sx={{
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            width: 40,
            height: 40,
          }}
        >
          AI
        </Avatar>
        <Box>
          <Typography variant="h6">AI Assistant</Typography>
          <Typography variant="caption" color="text.secondary">
            Always here to help
          </Typography>
        </Box>
      </Paper>

      {/* Messages Container */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          mb: 2,
          p: 3,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
          overflowY: 'auto',
        }}
      >
        <AnimatePresence mode="popLayout">
          {chat?.contents.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'customer' ? 'flex-end' : 'flex-start',
                  mb: 2,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    maxWidth: '70%',
                    p: 2,
                    background: msg.role === 'customer'
                      ? 'linear-gradient(45deg, #7C3AED, #10B981)'
                      : 'rgba(255, 255, 255, 0.1)',
                    color: msg.role === 'customer' ? 'white' : 'inherit',
                    borderRadius: 2,
                    position: 'relative',
                  }}
                >
                  <Typography variant="body1">{msg.content}</Typography>
                  {msg.attachment && (
                    <Button
                      startIcon={<AttachIcon />}
                      size="small"
                      component="a"
                      href={msg.attachment}
                      target="_blank"
                      sx={{ mt: 1 }}
                    >
                      View Attachment
                    </Button>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      bottom: -20,
                      right: msg.role === 'customer' ? 0 : 'auto',
                      left: msg.role === 'bot' ? 0 : 'auto',
                      color: 'text.secondary',
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </Typography>
                </Paper>
              </Box>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </Paper>

      {/* Input Area */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            InputProps={{
              endAdornment: (
                <IconButton
                  component="label"
                  sx={{ mr: 1 }}
                >
                  <AttachIcon />
                  <input
                    type="file"
                    hidden
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  />
                </IconButton>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!message.trim() && !attachment}
            sx={{
              minWidth: 100,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                background: 'linear-gradient(45deg, #6D28D9, #059669)',
              },
            }}
          >
            Send
          </Button>
        </Box>
        {attachment && (
          <Box
            sx={{
              mt: 1,
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <AttachIcon fontSize="small" />
            <Typography variant="body2" sx={{ flex: 1 }} noWrap>
              {attachment.name}
            </Typography>
            <IconButton size="small" onClick={() => setAttachment(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Paper>

      {/* Ticket Suggestion Dialog */}
      <Dialog
        open={isTicketSuggested}
        onClose={() => setIsTicketSuggested(false)}
        TransitionComponent={Slide}
      >
        <DialogTitle>
          <Typography variant="h6">Create Support Ticket?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            I notice this might need attention from our support team. Would you like me to create a ticket?
          </Typography>
          {suggestedTicket && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {suggestedTicket.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {suggestedTicket.content}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsTicketSuggested(false)}>
            No, thanks
          </Button>
          <Button
            variant="contained"
            startIcon={<ConfirmIcon />}
            onClick={handleCreateTicket}
            sx={{
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                background: 'linear-gradient(45deg, #6D28D9, #059669)',
              },
            }}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}