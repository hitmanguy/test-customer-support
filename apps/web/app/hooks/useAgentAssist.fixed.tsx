'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { trpc } from '../trpc/client';
import { v4 as uuidv4 } from 'uuid';
import { throttle } from 'lodash';


interface Message {
  id: string;
  content: string;
  isAgent: boolean;
  timestamp: Date;
  sources?: string[];
}

interface UseAgentAssistOptions {
  agentId: string;
  onError?: (error: string) => void;
}


export function useAgentAssist({ 
  agentId,
  onError 
}: UseAgentAssistOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  
  const agentAssistMutation = trpc.agent.getAIResponse.useMutation({
    onError: (error) => {
      console.error('Agent assist error:', error);
      handleError(`Failed to get assistance: ${error.message}`);
    }
  });
  
  
  const getAgentTicketsQuery = trpc.agent.getAgentTickets.useQuery({ 
    agentId,
    limit: 20
  }, {
    enabled: false, 
    staleTime: 30000 
  });
  
  
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(`agent-messages-${agentId}`, JSON.stringify(messages));
      } catch (err) {
        console.error('Error saving messages to session storage:', err);
      }
    }
  }, [messages, agentId]);
  
  
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(`agent-messages-${agentId}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (err) {
      console.error('Error loading messages from session storage:', err);
    }
  }, [agentId]);
  
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
  }, [onError]);
  
  
  const throttledSendMessage = useRef(
    throttle(async (content: string) => {
      try {
        
        const response = await agentAssistMutation.mutateAsync({
          query: content,
          agentId
        });
        
        
        const aiMessage: Message = {
          id: uuidv4(),
          content: response.answer,
          isAgent: false,
          timestamp: new Date(),
          sources: response.sources
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } catch (err) {
        
      } finally {
        setIsLoading(false);
      }
    }, 750) 
  ).current;
  
  
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    
    const agentMessage: Message = {
      id: uuidv4(),
      content,
      isAgent: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, agentMessage]);
    
    
    throttledSendMessage(content);
    
  }, [throttledSendMessage]);
  
  
  const clearChat = useCallback(async () => {
    try {
      setMessages([]);
      sessionStorage.removeItem(`agent-messages-${agentId}`);
    } catch (err) {
      console.error('Error clearing chat:', err);
      handleError('Failed to clear chat history.');
    }
  }, [agentId, handleError]);
  
  
  const transformTicketToMessage = useCallback((ticket: any) => {
    return {
      id: ticket._id || uuidv4(),
      content: ticket.title + ": " + ticket.content,
      isAgent: false,
      timestamp: new Date(ticket.createdAt),
      sources: []
    };
  }, []);

  
  const loadChatHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data } = await getAgentTicketsQuery.refetch();
      
      if (data?.tickets && Array.isArray(data.tickets)) {
        
        const loadedMessages = data.tickets.map(transformTicketToMessage);
        setMessages(loadedMessages);
      }
    } catch (err) {
      console.error('Error loading ticket history:', err);
      handleError('Failed to load history.');
    } finally {
      setIsLoading(false);
    }
  }, [getAgentTicketsQuery, handleError, transformTicketToMessage]);
  
  
  const returnValue = useMemo(() => ({
    messages,
    sendMessage,
    clearChat,
    loadChatHistory,
    isLoading,
    error
  }), [
    messages, 
    sendMessage,
    clearChat,
    loadChatHistory,
    isLoading,
    error
  ]);
  
  return returnValue;
}
