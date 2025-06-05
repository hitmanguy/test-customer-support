'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  IconButton,
  Chip,
  CircularProgress,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Assistant as AssistantIcon,
  Pause as PauseIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';
import ServiceHealth from './ServiceHealth';

interface TicketAICopilotMessage {
  id: string;
  role: 'agent' | 'ai';
  content: string;
  timestamp: Date;
}

interface TicketAICopilotProps {
  ticketId: string;
  ticket: any;
  onStatusChange: (status: string) => void;
}

export default function TicketAICopilot({ 
  ticketId, 
  ticket, 
  onStatusChange
}: TicketAICopilotProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<TicketAICopilotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);  
  const { user } = useAuthStore();
  
  
  const ticketAIMutation = trpc.agent.getTicketAIResponse.useMutation();

  
  const healthCheck = trpc.agent.checkPythonServiceHealth.useQuery(
    undefined,
    {
      refetchInterval: 60000, 
      refetchOnWindowFocus: false,
    }
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessage: TicketAICopilotMessage = {
        id: `ai-initial-${Date.now()}`,
        role: 'ai',
        content: `Hi ${user?.name || 'there'}! I'm your AI assistant for this ticket. You can ask me questions about the ticket, get suggestions for responses, or help with troubleshooting.`,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
    }
  }, [messages.length, user?.name]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const handleSendMessage = async () => {
    if (!message.trim() || !user?.id) return;
    setError(null);

    
    if (healthCheck.data && healthCheck.data.status === 'unhealthy') {
      setError('The AI service is currently unavailable. Please try again later.');
      return;
    }

    const newMessage: TicketAICopilotMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'agent',
      content: message,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    setIsTyping(true);

    try {
      
      const timeoutPromise = new Promise<{success: false, answer: string}>(
        (_, reject) => setTimeout(() => reject(new Error('Request timed out')), 30000)
      );
      
      const responsePromise = ticketAIMutation.mutateAsync({
        query: newMessage.content,
        ticketId,
        agentId: user.id
      });
      
      
      const response = await Promise.race([responsePromise, timeoutPromise]);

      if (response.success) {
        const aiMessage: TicketAICopilotMessage = {
          id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'ai',
          content: response.answer || "I'm here to help with this ticket. What would you like to know?",
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(response.answer || 'Failed to get AI response');
      }
    } catch (error: any) {
      console.error('Failed to get AI response:', error);
      const errorMessage: TicketAICopilotMessage = {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: "I'm sorry, I encountered an error processing your request. Please try again or check if the AI service is running properly.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setError(`AI response failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsTyping(false);
    }
  };
  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssistantIcon />
          AI Copilot
        </Typography>
        <ServiceHealth />
      </Box>
      
      {}
      {healthCheck.data && healthCheck.data.status === 'unhealthy' && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => healthCheck.refetch()}
            >
              Retry
            </Button>
          }
        >
          The AI service is currently experiencing issues. AI-assisted features may be limited.
        </Alert>
      )}

      {}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
          Quick Actions
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CheckIcon />}
            onClick={() => onStatusChange('closed')}
            disabled={ticket.status === 'closed'}
          >
            Mark Resolved
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PauseIcon />}
            onClick={() => onStatusChange('in_progress')}
            disabled={ticket.status === 'in_progress'}
          >
            In Progress
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloseIcon />}
            onClick={() => onStatusChange('open')}
            disabled={ticket.status === 'open'}
          >
            Reopen
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
          Ask AI Assistant
        </Typography>
        
        {}
        <Box
          sx={{
            height: '300px', 
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            mb: 2,
            bgcolor: 'background.paper',
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
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
                        width: 24,
                        height: 24,
                        mr: 1,
                      }}
                    >
                      <AIIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                  )}
                  <Box sx={{ maxWidth: '80%' }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        background: msg.role === 'agent'
                          ? 'linear-gradient(45deg, #7C3AED, #10B981)'
                          : 'rgba(255, 255, 255, 0.1)',
                        color: msg.role === 'agent' ? 'white' : 'inherit',
                        position: 'relative',
                        fontSize: '0.875rem',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
                      
                      {msg.role === 'ai' && (
                        <IconButton
                          size="small"
                          onClick={() => handleCopyText(msg.content, index)}
                          sx={{
                            position: 'absolute',
                            right: -30,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 20,
                            height: 20,
                          }}
                        >
                          {copiedIndex === index ? (
                            <CheckIcon sx={{ fontSize: 12 }} color="success" />
                          ) : (
                            <CopyIcon sx={{ fontSize: 12 }} />
                          )}
                        </IconButton>
                      )}
                    </Paper>
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 0.5,
                        display: 'block',
                        color: 'text.secondary',
                        textAlign: msg.role === 'agent' ? 'right' : 'left',
                        fontSize: '0.75rem',
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
                    AI is thinking...
                  </Typography>
                </Box>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </AnimatePresence>
        </Box>

        {}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask the AI about this ticket..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={isTyping}
            multiline
            maxRows={3}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSendMessage}
            disabled={!message.trim() || isTyping}
            sx={{
              minWidth: 'auto',
              px: 2,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                background: 'linear-gradient(45deg, #6D28D9, #059669)',
              },
            }}
          >
            {isTyping ? <CircularProgress size={20} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
          </Button>
        </Box>
      </Box>

      {}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      <Divider sx={{ mb: 3 }} />      {}
      <ServiceHealth />
    </Paper>
  );
}
