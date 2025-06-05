'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Avatar,
  Tooltip,
  Button,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';
import { useQuery, useMutation } from '@tanstack/react-query';

interface Message {
  role: 'agent' | 'ai';
  content: string;
  timestamp: Date;
}

export default function AgentCopilot() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  
  const agentAIQuery = trpc.agent.getAIResponse.useMutation();

  
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim() || isLoading) return;
    
    const newAgentMessage: Message = {
      role: 'agent',
      content: query,
      timestamp: new Date(),
    };
    
    setMessages(prevMessages => [...prevMessages, newAgentMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      
      const response = await agentAIQuery.mutateAsync({
        query: query,
        agentId: user?.id || '',
      });

      if (response.success) {
        const newAIMessage: Message = {
          role: 'ai',
          content: response.answer || 'Sorry, I couldn\'t process your request.',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, newAIMessage]);
      } else {
        const errorMessage: Message = {
          role: 'ai',
          content: 'Sorry, I encountered an error. Please try again later.',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, errorMessage]);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const errorMessage: Message = {
        role: 'ai',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: isExpanded ? 350 : 'auto',
        maxHeight: isExpanded ? 500 : 'auto',
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'width 0.3s ease',
        zIndex: 1000,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'primary.main',
          color: 'white',
          p: 2,
          cursor: 'pointer',
        }}
        onClick={toggleExpand}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon />
          <Typography variant="subtitle1" fontWeight={500}>
            Agent Assistant
          </Typography>
        </Box>
        <Box>
          {isExpanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </Box>
      </Box>
      
      <Collapse in={isExpanded}>
        <Box
          sx={{
            height: 350,
            overflow: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'background.default',
          }}
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                flexDirection: message.role === 'ai' ? 'row' : 'row-reverse',
                gap: 1,
                alignItems: 'flex-start',
              }}
            >
              <Avatar
                sx={{
                  bgcolor: message.role === 'ai' ? 'primary.main' : 'secondary.main',
                  width: 32,
                  height: 32,
                }}
              >
                {message.role === 'ai' ? 'AI' : 'A'}
              </Avatar>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  maxWidth: '75%',
                  bgcolor: message.role === 'ai' ? 'grey.100' : 'primary.light',
                  color: message.role === 'ai' ? 'text.primary' : 'white',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, opacity: 0.7, textAlign: 'right' }}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Paper>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        <Divider />
        
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, bgcolor: 'background.paper' }}>
          <TextField
            fullWidth
            placeholder="Ask me anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="small"
            disabled={isLoading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    color="primary"
                    type="submit"
                    disabled={isLoading || !query.trim()}
                  >
                    {isLoading ? <CircularProgress size={20} /> : <SendIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Ask about company policies, ticket guidelines, or general assistance.
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}
