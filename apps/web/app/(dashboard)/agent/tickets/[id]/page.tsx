'use client';

import React, { useState } from 'react';
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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Check as CheckIcon,
  Pause as PauseIcon,
  Close as CloseIcon,
  Chat as ChatIcon,
  SmartToy as SmartToyIcon,
  Assistant as AssistantIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
} from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'framer-motion';
import { trpc } from '@web/app/trpc/client';
import { LoadingAnimation } from '@web/app/components/shared/LoadingAnimation';
import { useAuthStore } from '@web/app/store/authStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Message } from '@web/app/types/ticket';
import TicketAICopilot from '@web/app/components/agent/TicketAICopilot';
import { Alert, Snackbar } from '@mui/material';

const statusConfig = {
  open: {
    color: '#10B981',
    label: 'Open',
  },
  in_progress: {
    color: '#F59E0B', 
    label: 'In Progress',
  },
  closed: {
    color: '#6B7280',
    label: 'Resolved',
  },
};

const statusColors = {
  open: '#22C55E',
  in_progress: '#EAB308',
  closed: '#64748B',
} as const;

type TicketStatus = keyof typeof statusColors;


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
  customerId: string | {
    _id: string;
    name: string;
    email: string;
    image?: string;
  };
  companyId: string;
  agentId?: string | {
    _id: string;
    name: string;
    email: string;
    image?: string;
  };
  aiTicket?: {
    _id?: string;
    companyId?: string;
    __v?: number;
    createdAt?: string;
    updatedAt?: string;
    ticketId?: string;
    priority_rate: number;
    predicted_solution: string;
    predicted_solution_attachment?: string;
    summarized_content: string;
    similar_ticketids?: string[];
  } | null;
  aiSuggestions?: string[];
  messages?: Message[];
  chatId?: string;
  __v: number;
}

export default function TicketPage({ params }: { params: { id: string } }) {
  
  const ticketId = params.id;
    const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const { user } = useAuthStore();
  
  
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    open: boolean;
  }>({
    message: '',
    type: 'info',
    open: false
  });

  
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type, open: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, open: false }));
    }, 6000);
  };
  
  
  const { data: ticketData, isLoading, refetch: refetchTicket } = trpc.ticket.getTicketById.useQuery(
    { id: ticketId },
    {
      refetchOnWindowFocus: false,
      refetchInterval: 10000, 
    }
  );

  const ticket = ticketData?.ticket as any; 
  
  const analyzeTicketMutation = trpc.agent.analyzeTicket.useMutation();
  const { data: aiAnalysisData, refetch: refetchAnalysis } = trpc.agent.getTicketAnalysis.useQuery(
    { ticketId: ticketId },
    {
      enabled: !!ticket,
      retry: false,
    }
  );      
  interface ChatHistoryContent {
    role: string;
    content: string;
    createdAt: string;
    attachment?: string;
    metadata?: {
      sources?: string[];
      shouldCreateTicket?: boolean;
      ticketId?: string;
      type?: string;
    };
  }
  interface ChatHistoryChat {
    contents: ChatHistoryContent[];
    _id?: string;
    customerId?: any;
    companyId?: any;
  }
  interface ChatHistoryResponse {
    success: boolean;
    chat: ChatHistoryChat | null;
    error?: string;
  }
  
  
  console.log('[DEBUG] Ticket object:', ticket);
  console.log('[DEBUG] ChatId value:', ticket?.chatId);
  console.log('[DEBUG] ChatId type:', typeof ticket?.chatId);
  
  
  const chatIdForQuery = React.useMemo(() => {
    if (!ticket?.chatId) return '';
    
    
    if (typeof ticket.chatId === 'object' && ticket.chatId?._id) {
      console.log('[DEBUG] chatId is an object with _id:', ticket.chatId._id);
      return ticket.chatId._id.toString();
    }
    
    
    return ticket.chatId.toString();
  }, [ticket?.chatId]);
  
  console.log('[DEBUG] Formatted chatIdForQuery:', chatIdForQuery);
  
  const { data: chatHistoryData, isLoading: chatHistoryLoading, error: chatHistoryError } = trpc.chat.getChatHistory.useQuery<ChatHistoryResponse>(
    { chatId: chatIdForQuery },
    {
      enabled: showChatHistory && !!chatIdForQuery && chatIdForQuery.length > 0,
      retry: 1
    }
  );
  
  React.useEffect(() => {
    if (chatHistoryData) {
      console.log('[CHAT HISTORY] Data received:', chatHistoryData);
      
      
      if (!chatHistoryData.success) {
        console.error('[CHAT HISTORY] Server reported error:', chatHistoryData.error);
      } else if (!chatHistoryData.chat) {
        console.error('[CHAT HISTORY] Missing chat object in response');
      } else if (!Array.isArray(chatHistoryData.chat.contents)) {
        console.error('[CHAT HISTORY] Invalid contents array:', chatHistoryData.chat.contents);
      } else {
        console.log('[CHAT HISTORY] Contents found, length:', chatHistoryData.chat.contents.length);
        if (chatHistoryData.chat.contents.length > 0) {
          console.log('[CHAT HISTORY] First message sample:', JSON.stringify(chatHistoryData.chat.contents[0], null, 2));
        } else {
          console.log('[CHAT HISTORY] Chat exists but has no messages');
        }
      }
    }
    
    if (chatHistoryError) {
      console.error('[CHAT HISTORY] Error fetching data:', chatHistoryError);
      if (chatIdForQuery) {
        console.log('[CHAT HISTORY] Query attempted with chatId:', chatIdForQuery);
      } else {
        console.error('[CHAT HISTORY] No valid chatId was available for query');
      }
    }
  }, [chatHistoryData, chatHistoryError, chatIdForQuery]);

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
      
      console.log(`Status changed to: ${newStatus}`);
      
      
      
      await updateTicketStatusMutation.mutateAsync({
        ticketId: ticketId,
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
      
      

      await addMessageMutation.mutateAsync({
        ticketId: ticketId,
        content: newMessage,
        attachment: attachmentUrl,
        isAgent: true,
      });
      
      setNewMessage('');
      setAttachment(null);
      showNotification('Message sent successfully!', 'success');
    } catch (error) {
      console.error('Failed to send message:', error);    
      showNotification('Failed to send message. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  
  const handleAnalyzeTicket = async () => {
    if (!ticket?.companyId) return;
    
    setAiAnalysisLoading(true);
    try {
      console.log('Starting ticket analysis for:', ticketId);
      const result = await analyzeTicketMutation.mutateAsync({
        ticketId: ticketId,
        companyId: ticket.companyId.toString ? ticket.companyId.toString() : ticket.companyId,
      });
      
      console.log('Analysis result:', result);
      
      if (result.success) {
        
        showNotification('Ticket analysis completed successfully!', 'success');
        
        
        await refetchAnalysis();
        
        
        await refetchTicket();
        
        console.log('Analysis data refreshed');
      } else {
        const errorMsg = (result as any)?.error || 'Unknown error';
        console.error('Analysis failed:', errorMsg);
        showNotification(`Analysis failed: ${errorMsg}`, 'error');
      }
    } catch (error: any) {
      console.error('Failed to analyze ticket:', error);
      showNotification(`Failed to analyze ticket: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setAiAnalysisLoading(false);
    }
  };
  
  const getPriorityLevel = (rate: number): PriorityLevel => {
    
    const normalizedRate = rate > 1 ? rate / 5 : rate;
    
    if (normalizedRate < 0.4) return 'low';
    if (normalizedRate >= 0.7) return 'high';
    return 'medium';
  };
  
  
  const getCustomer = (ticket: any) => {
    return typeof ticket.customerId === 'object' ? ticket.customerId : null;
  };

  
  const getAgent = (ticket: any) => {
    return typeof ticket.agentId === 'object' ? ticket.agentId : null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Grid container spacing={3}>
          {}
          <Grid size={{xs: 12}}>
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
                  )}                  <Chip
                    label={statusConfig[ticket.status as keyof typeof statusConfig].label}
                    sx={{
                      bgcolor: `${statusConfig[ticket.status as keyof typeof statusConfig].color}15`,
                      color: statusConfig[ticket.status as keyof typeof statusConfig].color,
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={getCustomer(ticket)?.image} sx={{ width: 32, height: 32 }} />
                  <Typography variant="body2">
                    Customer: {getCustomer(ticket)?.name || 'Unknown'}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Created: {new Date(ticket.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </Paper>
          </Grid>          {}
          <Grid size={{xs: 12, lg: 6}}>
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ChatIcon />
                Customer Conversation
              </Typography>
              
              {}
              <Box sx={{ 
                maxHeight: '500px', 
                overflowY: 'auto', 
                mb: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2
              }}>
                {}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Avatar
                      src={getCustomer(ticket)?.image}
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
                        {new Date(ticket.createdAt).toLocaleString()}
                      </Typography>
                    </Paper>
                  </Box>
                </Box>

                {}
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
                      src={message.isAgent ? getAgent(ticket)?.image : getCustomer(ticket)?.image}
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

              {}
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
          </Grid>          {}
          <Grid size={{xs: 12, lg: 6}}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {}              <Paper sx={{ p: 3 }}>                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SmartToyIcon />
                    AI Ticket Analysis
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>                    {}
                    {ticket?.chatId ? (
                      <Button 
                        variant="outlined" 
                        size="small" 
                        startIcon={<VisibilityIcon />}
                        onClick={() => setShowChatHistory(true)}
                        sx={{ mr: 1 }}
                      >
                        View Chat History
                      </Button>
                    ) : (
                      <Tooltip title="This ticket wasn't created from a chat conversation">
                        <span>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            startIcon={<ChatIcon />}
                            disabled={true}
                            sx={{ mr: 1 }}
                          >
                            No Chat History
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                    {}
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={aiAnalysisLoading ? <CircularProgress size={16} /> : <SmartToyIcon />}
                      onClick={handleAnalyzeTicket}
                      disabled={aiAnalysisLoading || !ticket?.companyId}
                    >
                      {aiAnalysisLoading ? 'Analyzing...' : (ticket.aiTicket ? 'Refresh Analysis' : 'Analyze Ticket')}
                    </Button>
                  </Box>
                </Box>
                
                {}
                {(ticket.aiTicket || (aiAnalysisData?.success && aiAnalysisData.analysis)) ? (
                  <Box>
                    {}
                    {(() => {
                      const aiData = ticket.aiTicket || aiAnalysisData?.analysis;
                      if (!aiData) return null;
                      
                      
                      const priorityRate = typeof aiData.priority_rate === 'number' ? 
                        (aiData.priority_rate > 1 ? aiData.priority_rate / 5 : aiData.priority_rate) : 0.5;
                      
                      return (
                        <>
                          {}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                              Priority Assessment
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box
                                sx={{
                                  width: 100,
                                  height: 8,
                                  bgcolor: 'grey.200',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                }}
                              >
                                <Box
                                  sx={{
                                    width: `${priorityRate * 100}%`,
                                    height: '100%',
                                    bgcolor: priorityColors[getPriorityLevel(priorityRate)],
                                  }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {(priorityRate * 100).toFixed(0)}% - {getPriorityLevel(priorityRate).toUpperCase()}
                              </Typography>
                            </Box>
                          </Box>

                          {}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                              Issue Summary
                            </Typography>
                            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                              <Typography variant="body2">
                                {aiData.summarized_content}
                              </Typography>
                            </Paper>
                          </Box>

                          {}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                              Predicted Solution
                            </Typography>
                            <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                              <Typography variant="body2">
                                {aiData.predicted_solution}
                              </Typography>
                              {aiData.predicted_solution_attachment && (
                                <Button
                                  variant="text"
                                  size="small"
                                  startIcon={<AttachFileIcon />}
                                  href={aiData.predicted_solution_attachment}
                                  target="_blank"
                                  sx={{ mt: 1 }}
                                >
                                  View Solution Attachment
                                </Button>
                              )}
                            </Paper>
                          </Box>

                          {}
                          {aiData.similar_ticketids && aiData.similar_ticketids.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HistoryIcon fontSize="small" />
                                Similar Tickets
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {aiData.similar_ticketids.slice(0, 3).map((ticketId: string, index: number) => (
                                  <Paper
                                    key={index}
                                    sx={{
                                      p: 1.5,
                                      cursor: 'pointer',
                                      bgcolor: 'primary.50',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        bgcolor: 'primary.100',
                                      },
                                    }}
                                    onClick={() => window.open(`/agent/tickets/${ticketId}`, '_blank')}
                                  >
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      #{ticketId.substring(0, 6)}
                                    </Typography>
                                  </Paper>
                                ))}
                              </Box>
                            </Box>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                ) : (                  <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <SmartToyIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {aiAnalysisLoading ? 'AI analysis is being processed...' : 'No AI analysis available yet. Click "Analyze Ticket" to generate insights.'}
                    </Typography>
                    {!aiAnalysisLoading && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        The AI will analyze ticket content, find similar cases, assess priority, and suggest solutions.
                      </Typography>
                    )}
                    {aiAnalysisLoading && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    )}
                  </Paper>
                )}
              </Paper>              {}
              <TicketAICopilot
                ticketId={ticketId}
                ticket={ticket}
                onStatusChange={(status: string) => handleStatusChange(status as TicketStatus)}
              />
            </Box>
          </Grid>
        </Grid>        {}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity={notification.type}
            sx={{ width: '100%' }}
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          >
            {notification.message}
          </Alert>
        </Snackbar>      {}
      <Dialog
        open={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ChatIcon />
          Full Customer Conversation History
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {ticket?.chatId ? 'This conversation led to the ticket creation' : 'No chat history available'}
          </Typography>
          <IconButton 
            aria-label="close"
            onClick={() => setShowChatHistory(false)}
            size="small"
            sx={{ ml: 1 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>          <DialogContent dividers>
            {chatHistoryLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading conversation...</Typography>
              </Box>
            ) : (!ticket?.chatId) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  This ticket wasn't created from a customer chat conversation.
                </Typography>
              </Box>
            ) : (!chatHistoryData) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="error">
                  Failed to load chat history data.
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Chat ID: {chatIdForQuery || 'undefined'}
                </Typography>
              </Box>
            ) : (!chatHistoryData.success) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="error">
                  Error loading chat history: {chatHistoryData.error || 'Unknown error'}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Chat ID: {chatIdForQuery || 'undefined'}
                </Typography>
              </Box>
            ) : (!chatHistoryData.chat || !Array.isArray(chatHistoryData.chat?.contents)) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="error">
                  Invalid chat history format
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  The chat history data structure is invalid.
                </Typography>
              </Box>
            ) : (chatHistoryData.chat.contents.length === 0) ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  Chat conversation exists but contains no messages.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {chatHistoryData.chat.contents.map((message: ChatHistoryContent, index: number) => (
                  <Box
                    key={`chat-message-${index}`}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      flexDirection: message.role === 'bot' ? 'row-reverse' : 'row',
                    }}
                  >
                    <Avatar
                      sx={{ 
                        width: 40, 
                        height: 40,
                        bgcolor: message.role === 'bot' ? 'primary.main' : 'grey.400'
                      }}
                    >
                      {message.role === 'bot' ? <SmartToyIcon /> : getCustomer(ticket)?.name?.[0] || 'C'}
                    </Avatar>
                    <Paper
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        bgcolor: message.role === 'bot' ? 'primary.light' : 'grey.100',
                        color: message.role === 'bot' ? 'white' : 'inherit',
                      }}
                    >                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {message.content}
                      </Typography>
                      {message.attachment && (
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<AttachFileIcon />}
                          href={message.attachment}
                          target="_blank"
                          sx={{ 
                            color: message.role === 'bot' ? 'inherit' : 'primary.main',
                            mt: 1 
                          }}
                        >
                          View Attachment
                        </Button>
                      )}
                      {/* Show ticket creation info if available */}
                      {message.role === 'bot' && message.metadata?.shouldCreateTicket && message.metadata?.ticketId && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: 'info.50', borderRadius: 1, border: '1px dashed', borderColor: 'info.main' }}>
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ConfirmationNumberIcon fontSize="inherit" />
                            Created ticket: #{message.metadata.ticketId.substring(0, 6)}
                          </Typography>
                        </Box>
                      )}
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, mt: 1 }}>
                        {message.role === 'bot' ? 'AI Assistant' : getCustomer(ticket)?.name || 'Customer'} • {new Date(message.createdAt).toLocaleString()}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
              </Box>            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowChatHistory(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </motion.div>
  );
}
