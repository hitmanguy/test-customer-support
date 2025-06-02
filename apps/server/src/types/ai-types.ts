// Types for AI Chatbot Service
export interface ChatMessage {
  role: 'customer' | 'bot';
  content: string;
  timestamp: string;
}

export interface ConversationMemory {
  [sessionId: string]: ChatMessage[];
}

export interface SupportTicket {
  sessionId: string;
  issue: string;
  timestamp: string;
  ticketId: string;
}

export interface AIResponse {
  answer: string;
  sources: string[];
  sessionId: string;
  shouldCreateTicket?: boolean;
  ticketId?: string;
}

export interface PineconeMatch {
  id: string;
  score: number;
  metadata: {
    category?: string;
    company_id?: string;
    source_document?: string;
    text?: string;
    title?: string;
  };
}
