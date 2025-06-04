'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { trpc } from '../trpc/client';
import { v4 as uuidv4 } from 'uuid';
import { throttle } from 'lodash';

// Define types for the chat functionality
interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface UseChatOptions {
  initialSessionId?: string;
  customerId?: string;
  companyId?: string;
  onNewTicket?: (ticketId: string) => void;
}

/**
 * A custom React hook for chat functionality
 * This centralizes all chat-related state and API calls for better reuse across components
 */
export function useChat({ 
  initialSessionId, 
  customerId = 'anonymous-user',
  companyId = 'default-company', 
  onNewTicket 
}: UseChatOptions = {}) {
  // Generate a session ID if none was provided
  const [sessionId] = useState(() => initialSessionId || `session-${uuidv4()}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use the TRPC client with proper routes
  const chatMutation = trpc.chat.addAIMessage.useMutation({
    onError: (error) => {
      console.error('Chat mutation error:', error);
      setError(`Failed to send message: ${error.message}`);
    }
  });
  
  const startChatMutation = trpc.chat.startChat.useMutation({
    onError: (error) => {
      console.error('Start chat error:', error);
      setError(`Failed to start a new chat: ${error.message}`);
    }
  });
  
  const getChatHistoryQuery = trpc.chat.getChatHistory.useQuery(
    { chatId: sessionId },
    {
      enabled: false
    }
  );
  
  // Persist messages in session storage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(`chat-messages-${sessionId}`, JSON.stringify(messages));
      } catch (err) {
        console.error('Error saving messages to session storage:', err);
      }
    }
  }, [messages, sessionId]);
  
  // Load messages from session storage on initial render
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(`chat-messages-${sessionId}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (err) {
      console.error('Error loading messages from session storage:', err);
    }
  }, [sessionId]);
  
  // Throttled send message function to prevent rapid-fire API calls
  const throttledSendMessage = useRef(
    throttle(async (content: string) => {
      try {
        // Call the API with the correct parameter names
        const response = await chatMutation.mutateAsync({
          message: content,
          chatId: sessionId,
          customerId: customerId,
          companyId: companyId
        });
        
        // Add AI response to the chat
        const aiMessage: Message = {
          id: uuidv4(),
          content: response.aiResponse.answer,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // Handle ticket creation if needed
        if (response.aiResponse.shouldCreateTicket && response.aiResponse.ticketId && onNewTicket) {
          onNewTicket(response.aiResponse.ticketId);
        }
      } catch (err) {
        // Error handling is done in the mutation config
      } finally {
        setIsLoading(false);
      }
    }, 750) // Throttle to prevent hammering the API
  ).current;
  
  // Send a message to the AI
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add user message to the chat immediately
    const userMessage: Message = {
      id: uuidv4(),
      content,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Use throttled function for API call
    throttledSendMessage(content);
    
  }, [throttledSendMessage]);
  
  // Clear the chat history by starting a new chat
  const clearChat = useCallback(async () => {
    try {
      await startChatMutation.mutateAsync({ 
        customerId, 
        companyId 
      });
      setMessages([]);
      sessionStorage.removeItem(`chat-messages-${sessionId}`);
    } catch (err) {
      console.error('Error clearing chat:', err);
      setError('Failed to clear chat history.');
    }
  }, [customerId, companyId, sessionId, startChatMutation]);
  
  // Transform chat content to our message format
  function transformChatContent(content: any): Message {
    return {
      id: uuidv4(),
      content: content.content,
      isUser: content.role === 'customer',
      timestamp: new Date(content.timestamp ?? Date.now())
    };
  }

  // Load chat history 
  const loadChatHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getChatHistoryQuery.refetch();

      if (
        response.data &&
        response.data.chat &&
        typeof response.data.chat === 'object' &&
        'contents' in response.data.chat &&
        Array.isArray((response.data.chat as { contents?: any[] }).contents)
      ) {
        // Transform chat contents to our message format
        const loadedMessages = (response.data.chat as { contents: any[] }).contents.map(transformChatContent);
        setMessages(loadedMessages);
      } else if (response.error) {
        console.error('Get chat history error:', response.error);
        setError(`Failed to load history: ${response.error.message}`);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load chat history.');
    } finally {
      setIsLoading(false);
    }
  }, [getChatHistoryQuery]);

  const returnValue = useMemo(() => ({
    messages,
    sendMessage,
    clearChat,
    loadChatHistory,
    isLoading,
    error,
    sessionId
  }), [
    messages,
    sendMessage,
    clearChat,
    loadChatHistory,
    isLoading,
    error,
    sessionId
  ]);

  return returnValue;
}
