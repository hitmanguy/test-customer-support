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
import { LoadingAnimation } from '@web/app/components/shared/LoadingAnimation';
import { useQuery, useMutation } from '@tanstack/react-query';

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

  // All hooks must be at the top level
  // Fetch or create chat
  const { data: chatData, isLoading } = trpc.chat.getLatestCompanyChat.useQuery({
      customerId: user?.id || '',
      companyId,
  }, {
    enabled: !!user?.id // Only run query if user exists
  });  // Get agents data
  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = trpc.utils.getCompanyAgents.useQuery({
      companyId,
      verified: true,
      page: 1,
      limit: 50,
    }, {
      enabled: !!user?.id && !!companyId
    });

  // Get all open tickets
  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = trpc.ticket.getTicketsByQuery.useQuery({
      companyId,
      status: 'open',
      page: 1,
      limit: 50,
    }, {
      enabled: !!user?.id && !!companyId
    });

  // Mutations
  const sendMessageMutation = trpc.chat.addMessage.useMutation();
  const sendAIMessageMutation = trpc.chat.addAIMessage.useMutation();
  const createTicketMutation = trpc.ticket.createTicket.useMutation();
  // Early return after all hooks
  if(!user?.id){
    return <LoadingAnimation message='no user id sir!!' />;
  }

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat?.contents]);
  const handleSendMessage = async () => {
    if (!message.trim() && !attachment) return;

    let attachmentUrl = '';
    try {
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
      }      // Use AI-powered message endpoint
      const response = await sendAIMessageMutation.mutateAsync({
        chatId: chat?._id || '',
        customerId: user?.id || '',
        companyId,
        message: message,
        attachment: attachmentUrl,
      });

      setMessage('');
      setAttachment(null);

      // Check if AI suggests creating a ticket
      if (response.aiResponse?.shouldCreateTicket && response.aiResponse?.ticketId) {
        setIsTicketSuggested(true);
        setSuggestedTicket({
          title: 'AI-Suggested Support Ticket',
          content: message,
          ticketId: response.aiResponse.ticketId,
        });
      }

    } catch (error) {
      console.error('Failed to send message:', error);
        // Fallback to regular message if AI fails
      try {
        await sendMessageMutation.mutateAsync({
          chatId: chat?._id || '',
          message: {
            role: 'customer',
            content: message,
            attachment: attachmentUrl,
          },
        });

        // Send a simple bot response
        await sendMessageMutation.mutateAsync({
          chatId: chat?._id || '',
          message: {
            role: 'bot',
            content: "I'm experiencing some technical difficulties. Let me connect you with a human agent.",
          },
        });

        setMessage('');
        setAttachment(null);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }    }
  };  // Find least busy agent
  const findLeastBusyAgent = () => {
    console.log('=== DEBUG findLeastBusyAgent ===');
    console.log('companyId:', companyId);
    console.log('user?.id:', user?.id);
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
    console.log('ticketsData structure:', JSON.stringify(ticketsData, null, 2));    // Check if we have the expected data structure
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