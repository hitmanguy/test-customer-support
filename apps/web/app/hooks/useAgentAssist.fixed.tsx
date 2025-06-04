'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { trpc } from '../trpc/client';
import { v4 as uuidv4 } from 'uuid';
import { throttle } from 'lodash';

// Define types for the agent assistance functionality
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

/**
 * A custom React hook for agent assistance functionality
 * This centralizes all agent-related state and API calls for better reuse across components
 */
export function useAgentAssist({ 
  agentId,
  onError 
}: UseAgentAssistOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use the TRPC client with proper routes
  const agentAssistMutation = trpc.agent.getAIResponse.useMutation({
    onError: (error) => {
      console.error('Agent assist error:', error);
      handleError(`Failed to get assistance: ${error.message}`);
    }
  });
  
  // Use the getAgentTickets endpoint as a substitute for chat history
  const getAgentTicketsQuery = trpc.agent.getAgentTickets.useQuery({ 
    agentId,
    limit: 20
  }, {
    enabled: false, // Don't fetch automatically
    staleTime: 30000 // Consider data fresh for 30 seconds
  });
  
  // Persist messages in session storage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(`agent-messages-${agentId}`, JSON.stringify(messages));
      } catch (err) {
        console.error('Error saving messages to session storage:', err);
      }
    }
  }, [messages, agentId]);
  
  // Load messages from session storage on initial render
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
  
  // Throttled send message function to prevent rapid-fire API calls
  const throttledSendMessage = useRef(
    throttle(async (content: string) => {
      try {
        // Call the API with the correct parameter names
        const response = await agentAssistMutation.mutateAsync({
          query: content,
          agentId
        });
        
        // Add AI response to the chat
        const aiMessage: Message = {
          id: uuidv4(),
          content: response.answer,
          isAgent: false,
          timestamp: new Date(),
          sources: response.sources
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } catch (err) {
        // Error handling is done in the mutation config
      } finally {
        setIsLoading(false);
      }
    }, 750) // Throttle to prevent hammering the API
  ).current;
  
  // Send a message to get AI assistance
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add agent message to the chat immediately
    const agentMessage: Message = {
      id: uuidv4(),
      content,
      isAgent: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, agentMessage]);
    
    // Use throttled function for API call
    throttledSendMessage(content);
    
  }, [throttledSendMessage]);
  
  // Clear the chat history (locally only)
  const clearChat = useCallback(async () => {
    try {
      setMessages([]);
      sessionStorage.removeItem(`agent-messages-${agentId}`);
    } catch (err) {
      console.error('Error clearing chat:', err);
      handleError('Failed to clear chat history.');
    }
  }, [agentId, handleError]);
  
  // Transform ticket to message format
  const transformTicketToMessage = useCallback((ticket: any) => {
    return {
      id: ticket._id || uuidv4(),
      content: ticket.title + ": " + ticket.content,
      isAgent: false,
      timestamp: new Date(ticket.createdAt),
      sources: []
    };
  }, []);

  // Load chat history with optimized transformations
  const loadChatHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data } = await getAgentTicketsQuery.refetch();
      
      if (data?.tickets && Array.isArray(data.tickets)) {
        // Transform tickets into message format
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
  
  // Memoize the return value to prevent unnecessary re-renders
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
