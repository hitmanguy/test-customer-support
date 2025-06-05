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
  Chip,
  Tooltip,
  Button,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  History as HistoryIcon,
  Description as DescriptionIcon,
  CheckCircle as SolutionIcon,
  Category as CategoryIcon,
  ArrowForward as ArrowIcon,
  Search as SearchIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';
import { useQuery, useMutation } from '@tanstack/react-query';

interface Message {
  role: 'agent' | 'ai';
  content: string;
  timestamp: Date;
}

interface TicketCopilotProps {
  ticketId: string;
  customerId: string;
  customerName?: string;
  ticketContent: string;
  aiTicket?: {
    summarized_content: string;
    predicted_solution: string;
    priority_rate: number;
    similar_ticketids?: string[];
  };
}

export default function TicketCopilot({ 
  ticketId,
  customerId,
  customerName,
  ticketContent,
  aiTicket
}: TicketCopilotProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: 'I\'m your ticket assistant. Ask me specific questions about this ticket, the customer\'s history, or for help with solutions.',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('assistant');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  
  interface TicketBasic {
    _id: string;
    title: string;
    content: string;
    status: string;
    createdAt: string;
    solution?: string;
  }

  
  const { data: customerHistory, isLoading: historyLoading } = trpc.agent.getCustomerHistory.useQuery(
    { customerId },
    { enabled: !!customerId }
  );

  
  const { data: similarTickets, isLoading: similarTicketsLoading } = trpc.agent.getSimilarTickets.useQuery(
    { ticketId },
    { enabled: !!aiTicket?.similar_ticketids?.length }
  );

  
  const ticketAIQuery = trpc.agent.getTicketAIResponse.useMutation();

  
  useEffect(() => {
    if (messagesEndRef.current && activeTab === 'assistant') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

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
      
      const response = await ticketAIQuery.mutateAsync({
        query: query,
        ticketId: ticketId,
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

  const getSuggestionMessage = () => {
    if (aiTicket?.predicted_solution) {
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          content: 'What solution would you recommend for this ticket?',
          timestamp: new Date()
        },
        {
          role: 'ai',
          content: `Based on my analysis, here's what I recommend:\n\n${aiTicket.predicted_solution}`,
          timestamp: new Date()
        }
      ]);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'assistant':
        return (
          <>
            <Box
              sx={{
                height: 300,
                overflow: 'auto',
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                p: 2,
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
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip 
                label="Suggest solution" 
                icon={<SolutionIcon />} 
                onClick={getSuggestionMessage} 
                color="primary" 
                variant="outlined"
              />
            </Box>
            
            <Box component="form" onSubmit={handleSubmit} sx={{ px: 2, pb: 2 }}>
              <TextField
                fullWidth
                placeholder="Ask about this ticket..."
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
            </Box>
          </>
        );
        
      case 'customer-history':
        return (
          <Box sx={{ p: 2, height: 350, overflow: 'auto' }}>
            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={30} />
              </Box>            ) : customerHistory?.ticketHistory && customerHistory.ticketHistory.length > 0 ? (
              <List>
                {(customerHistory.ticketHistory as TicketBasic[]).map((ticket, index) => (
                  <ListItem 
                    key={ticket._id} 
                    divider={index < customerHistory.ticketHistory.length - 1}
                    sx={{ px: 1, py: 1.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <DescriptionIcon color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={ticket.title}
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={ticket.status} 
                            sx={{ ml: 1, height: 20, fontSize: '0.625rem' }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No previous tickets found for this customer</Typography>
              </Box>
            )}
          </Box>
        );
        
      case 'similar-tickets':
        return (
          <Box sx={{ p: 2, height: 350, overflow: 'auto' }}>
            {similarTicketsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={30} />
              </Box>            ) : similarTickets?.tickets && similarTickets.tickets.length > 0 ? (
              <List>
                {(similarTickets.tickets as TicketBasic[]).map((ticket, index) => (
                  <ListItem 
                    key={ticket._id} 
                    divider={index < similarTickets.tickets.length - 1}
                    sx={{ px: 1, py: 1.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <SearchIcon color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={ticket.title}
                      secondary={
                        <>
                          <Typography variant="body2" sx={{ mb: 1, fontSize: '0.75rem' }}>
                            {ticket.content.length > 100 
                              ? `${ticket.content.substring(0, 100)}...` 
                              : ticket.content}
                          </Typography>
                          {ticket.solution && (
                            <Chip 
                              size="small" 
                              label="Has solution" 
                              color="success" 
                              sx={{ height: 20, fontSize: '0.625rem' }}
                            />
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No similar tickets found</Typography>
              </Box>
            )}
          </Box>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'primary.main',
            color: 'white',
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AIIcon />
            <Typography variant="subtitle1" fontWeight={500}>
              AI Ticket Assistant
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setActiveTab('assistant')}
            sx={{ 
              flex: 1, 
              py: 1, 
              borderBottom: activeTab === 'assistant' ? 2 : 0, 
              borderColor: 'primary.main',
              borderRadius: 0,
              color: activeTab === 'assistant' ? 'primary.main' : 'text.secondary'
            }}
            startIcon={<AIIcon />}
          >
            Assistant
          </Button>
          <Button 
            onClick={() => setActiveTab('customer-history')}
            sx={{ 
              flex: 1, 
              py: 1, 
              borderBottom: activeTab === 'customer-history' ? 2 : 0, 
              borderColor: 'primary.main',
              borderRadius: 0,
              color: activeTab === 'customer-history' ? 'primary.main' : 'text.secondary' 
            }}
            startIcon={<HistoryIcon />}
          >
            History
          </Button>
          <Button 
            onClick={() => setActiveTab('similar-tickets')}
            sx={{ 
              flex: 1, 
              py: 1, 
              borderBottom: activeTab === 'similar-tickets' ? 2 : 0, 
              borderColor: 'primary.main',
              borderRadius: 0,
              color: activeTab === 'similar-tickets' ? 'primary.main' : 'text.secondary' 
            }}
            startIcon={<SearchIcon />}
          >
            Similar
          </Button>
        </Box>
        
        {renderTabContent()}
      </CardContent>
    </Card>
  );
}
