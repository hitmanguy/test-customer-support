'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { trpc } from '../trpc/client';
import { v4 as uuidv4 } from 'uuid';
import { throttle } from 'lodash';


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


export function useChat({ 
  initialSessionId, 
  customerId = 'anonymous-user',
  companyId = 'default-company', 
  onNewTicket 
}: UseChatOptions = {}) {
  
  const [sessionId] = useState(() => initialSessionId || `session-${uuidv4()}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  
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
  
  
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(`chat-messages-${sessionId}`, JSON.stringify(messages));
      } catch (err) {
        console.error('Error saving messages to session storage:', err);
      }
    }
  }, [messages, sessionId]);
  
  
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
  
  
  const throttledSendMessage = useRef(
    throttle(async (content: string) => {
      try {
        
        const response = await chatMutation.mutateAsync({
          message: content,
          chatId: sessionId,
          customerId: customerId,
          companyId: companyId
        });
        
        
        const aiMessage: Message = {
          id: uuidv4(),
          content: response.aiResponse.answer,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        
        if (response.aiResponse.shouldCreateTicket && response.aiResponse.ticketId && onNewTicket) {
          onNewTicket(response.aiResponse.ticketId);
        }
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
    
    
    const userMessage: Message = {
      id: uuidv4(),
      content,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    
    throttledSendMessage(content);
    
  }, [throttledSendMessage]);
  
  
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
  
  
  function transformChatContent(content: any): Message {
    return {
      id: uuidv4(),
      content: content.content,
      isUser: content.role === 'customer',
      timestamp: new Date(content.timestamp ?? Date.now())
    };
  }

  
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
