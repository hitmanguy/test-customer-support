'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  Autocomplete,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Extension as CopilotIcon,
  MenuBook,
  Description as DescriptionIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { Grid } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';

interface Message {
  id: string; 
  role: 'agent' | 'ai';
  content: string;
  type?: 'suggestion' | 'resolution' | 'info';
  timestamp: Date;
  ticketReference?: {
    id: string;
    title: string;
  };
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}


const getAiResponse = async (
  message: string, 
  agentId: string, 
  ticketId?: string,
  agentMutation?: any,
  ticketMutation?: any
): Promise<Message> => {
  try {
    let data;
    
    if (ticketId && ticketMutation) {
      
      data = await ticketMutation.mutateAsync({
        query: message,
        ticketId,
        agentId
      });
    } else if (agentMutation) {
      
      data = await agentMutation.mutateAsync({
        query: message,
        agentId
      });
    } else {
      throw new Error('No mutation functions available');
    }
    
    return {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'ai',
      content: data.answer || "I'm here to help! Please provide more details about your question.",
      type: 'suggestion',
      timestamp: new Date(),
      ticketReference: ticketId ? {
        id: ticketId,
        title: `Ticket #${ticketId.substring(0, 6)}`,
      } : undefined,
    };
  } catch (error) {
    console.error('Error getting AI response:', error);
    return {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'ai',
      content: "I'm sorry, I encountered an error. Please try again later.",
      type: 'info',
      timestamp: new Date(),
    };
  }
};

const CopilotFeatureCard = ({ title, description, icon }: FeatureCardProps) => (
  <Card
    elevation={0}
    sx={{
      height: '100%',
      border: '1px solid',
      borderColor: 'divider',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.2s',
      '&:hover': {
        borderColor: 'primary.main',
        transform: 'translateY(-4px)',
      },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'start', gap: 2, mb: 2 }}>
        {icon}
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function CopilotPage() {
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    
  const { user } = useAuthStore();

  const { data: ticketDetails } = trpc.agent.getTicketDetails.useQuery(
  {
    ticketId: selectedTicketId as string,
  },
  {
    enabled: !!selectedTicketId, 
  }
);

  const { data: ticketData, isLoading: ticketsLoading } = trpc.agent.getAgentTickets.useQuery({
      agentId: user!.id,
      limit: 20, 
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },{
      enabled: !!user?.id,
    }
    );

  
  const agentAIMutation = trpc.agent.getAIResponse.useMutation();
  const ticketAIMutation = trpc.agent.getTicketAIResponse.useMutation();
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const handleSendMessage = async () => {
    if (!message.trim() || !user?.id) return;

    const ticket = selectedTicketId ? 
      ticketData?.tickets?.find((t: any) => t._id === selectedTicketId) || 
      (ticketDetails?.success ? ticketDetails.ticket : null) : 
      null;
    
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'agent',
      content: message,
      timestamp: new Date(),
      ticketReference: ticket ? {
        id: ticket._id || selectedTicketId,
        title: ticket.title || `Ticket #${selectedTicketId?.substring(0, 6)}`,
      } : undefined,
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    setIsTyping(true);

    try {      
      const response = await getAiResponse(
        newMessage.content, 
        user.id,
        selectedTicketId || undefined,
        agentAIMutation,
        ticketAIMutation
      );
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('Failed to get copilot response:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: "I apologize, but I'm having trouble processing your request right now. Please try again.",
        type: 'info',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setSelectedTicketId(null); 
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Box>
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          AI Copilot
        </Typography>
        <Typography color="text.secondary">
          Get AI-powered assistance for faster and more accurate customer support
        </Typography>
      </Box>

      {}
      {messages.length === 0 && (
        <Box sx={{ mb: 6 }}>
          <Grid container spacing={3}>
            <Grid size = {{xs:12,md:4}}>
              <CopilotFeatureCard
                title="Smart Suggestions"
                description="Get AI-powered response suggestions based on customer queries and historical data"
                icon={<AIIcon sx={{ color: '#7C3AED', fontSize: 32 }} />}
              />
            </Grid>
            <Grid size = {{xs:12,md:4}}>
              <CopilotFeatureCard
                title="Knowledge Base Integration"
                description="Access and search through your company's knowledge base for accurate information"
                icon={<MenuBook sx={{ color: '#10B981', fontSize: 32 }} />}
              />
            </Grid>
            <Grid size = {{xs:12,md:4}}>
              <CopilotFeatureCard
                title="Template Generation"
                description="Create customized response templates for common customer scenarios"
                icon={<DescriptionIcon sx={{ color: '#F59E0B', fontSize: 32 }} />}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {}
      <Paper
        elevation={0}
        sx={{
          height: messages.length > 0 ? '70vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
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
            <CopilotIcon />
          </Avatar>
          <Box>
            <Typography variant="h6">Support Copilot</Typography>
            <Typography variant="caption" color="text.secondary">
              AI-powered assistant
            </Typography>
          </Box>
        </Box>

        {}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <AnimatePresence mode="popLayout" initial = {false}>
            {messages.map((msg, index) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: msg.role === 'agent' ? 'flex-end' : 'flex-start',
                                mb: 2,
                              }}
                            >
                              {msg.role === 'ai' && (
                                <Avatar
                                  sx={{
                                    background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                                    width: 32,
                                    height: 32,
                                    mr: 1,
                                  }}
                                >
                                  <AIIcon sx={{ fontSize: 20 }} />
                                </Avatar>
                              )}
                              <Box sx={{ maxWidth: '70%' }}>
                                <Paper
                                  elevation={0}
                                  sx={{
                                    p: 2,
                                    background: msg.role === 'agent'
                                      ? 'linear-gradient(45deg, #7C3AED, #10B981)'
                                      : 'rgba(255, 255, 255, 0.1)',
                                    color: msg.role === 'agent' ? 'white' : 'inherit',
                                    position: 'relative',
                                  }}
                                >
                                  <Typography variant="body1">{msg.content}</Typography>
                                  
                                  {}
                                  {msg.ticketReference && (
                                    <Box 
                                      sx={{ 
                                        mt: 2, 
                                        p: 1.5, 
                                        borderRadius: 1, 
                                        bgcolor: 'rgba(124, 58, 237, 0.1)', 
                                        border: '1px dashed rgba(124, 58, 237, 0.3)',
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                          bgcolor: 'rgba(124, 58, 237, 0.15)',
                                          borderColor: 'rgba(124, 58, 237, 0.5)',
                                        }
                                      }}
                                    >
                                      <LinkIcon fontSize="small" color="primary" />
                                      <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Typography variant="caption" fontWeight="bold" color="primary.main">
                                            Ticket: #{msg.ticketReference.id.substring(0, 6)}
                                          </Typography>
                                          <Chip 
                                            size="small" 
                                            label="Referenced" 
                                            sx={{ 
                                              height: 20, 
                                              fontSize: '0.625rem',
                                              bgcolor: 'rgba(124, 58, 237, 0.2)',
                                              color: 'primary.main',
                                            }}
                                          />
                                        </Box>
                                        <Typography variant="body2" fontWeight="medium" sx={{ mt: 0.5 }}>
                                          {msg.ticketReference.title}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  )}
                                  
                                  {msg.role === 'ai' && (
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopyText(msg.content, index)}
                                      sx={{
                                        position: 'absolute',
                                        right: -40,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                      }}
                                    >
                                      {copiedIndex === index ? <CheckIcon color="success" /> : <CopyIcon />}
                                    </IconButton>
                                  )}
                                </Paper>
                                {msg.type && (
                                  <Chip
                                    size="small"
                                    label={msg.type}
                                    sx={{
                                      mt: 1,
                                      bgcolor: msg.type === 'suggestion'
                                        ? 'primary.main'
                                        : msg.type === 'resolution'
                                        ? 'success.main'
                                        : 'info.main',
                                      color: 'white',
                                    }}
                                  />
                                )}
                                <Typography
                                  variant="caption"
                                  sx={{
                                    mt: 0.5,
                                    display: 'block',
                                    color: 'text.secondary',
                                    textAlign: msg.role === 'agent' ? 'right' : 'left',
                                  }}
                                >
                                  {msg.timestamp.toLocaleTimeString()}
                                </Typography>
                              </Box>
                            </Box>
                          </motion.div>
                        ))}
            {isTyping && (
                <motion.div
        key="typing-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Copilot is thinking...
          </Typography>
        </Box>
      </motion.div>
            )}
            <div ref={messagesEndRef} />
          </AnimatePresence>
        </Box>

        {}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {}
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              options={ticketData?.tickets || []}
              getOptionLabel={(option: any) => `#${option._id.substring(0, 6)} - ${option.title}`}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2" fontWeight="500">
                      #{option._id.substring(0, 6)} - {option.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={option.status}
                        sx={{ 
                          height: 20, 
                          fontSize: '0.625rem',
                          bgcolor: option.status === 'open' 
                            ? 'rgba(16, 185, 129, 0.1)' 
                            : option.status === 'in_progress' 
                              ? 'rgba(245, 158, 11, 0.1)'
                              : 'rgba(107, 114, 128, 0.1)',
                          color: option.status === 'open' 
                            ? '#10B981' 
                            : option.status === 'in_progress' 
                              ? '#F59E0B'
                              : '#6B7280'
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(option.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Reference a Ticket (Optional)" 
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <LinkIcon color="action" fontSize="small" sx={{ mr: 1 }} />
                        {params.InputProps.startAdornment}
                      </>
                    )
                  }}
                />
              )}
              onChange={(e, value) => setSelectedTicketId(value ? value._id : null)}
              value={ticketData?.tickets?.find((t: any) => t._id === selectedTicketId) || null}
              loading={ticketsLoading}
              loadingText="Loading tickets..."
              size="small"
            />
            {selectedTicketId && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Chip 
                  label="Ticket referenced" 
                  color="primary" 
                  size="small" 
                  onDelete={() => setSelectedTicketId(null)}
                  icon={<LinkIcon fontSize="small" />}
                  sx={{ mr: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  The AI will provide context-aware assistance based on this ticket
                </Typography>
              </Box>
            )}
          </Box>
          
          {}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              placeholder="Ask the copilot for assistance..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              multiline
              maxRows={4}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!message.trim() || isTyping}
              sx={{
                px: 3,
                background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #6D28D9, #059669)',
                },
              }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
