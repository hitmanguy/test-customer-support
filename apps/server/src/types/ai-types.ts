
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
  ticketTitle?: string;
  ticketContent?: string;
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


export interface PythonAIChatRequest {
  query: string;
  session_id?: string;
  company_id?: string;
  company_name?: string;
}

export interface PythonAIChatResponse {
  answer: string;
  sources: string[];
  session_id: string;
  should_create_ticket?: boolean;
  ticket_id?: string;
  ticket_title?: string;
  ticket_content?: string;
}


export interface AgentAIRequest {
  query: string;
  agent_id: string;
}

export interface AgentAIResponse {
  answer: string;
  sources: string[];
}

export interface AgentTicketAIRequest {
  query: string;
  ticket_id: string;
  agent_id: string;
  ticket_data: any;
  ai_ticket_data?: any;
}
