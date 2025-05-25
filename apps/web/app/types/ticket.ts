export const statusColors = {
  open: '#22C55E',
  in_progress: '#EAB308',
  closed: '#64748B',
} as const;

export const priorityColors = {
  low: '#22C55E',
  medium: '#EAB308',
  high: '#EF4444',
} as const;

export type PriorityLevel = keyof typeof priorityColors;

export interface Message {
  _id?: string;
  content: string;
  attachment?: string | null;
  isAgent: boolean;
  createdAt: string;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  image?: string;
}

export interface Agent {
  _id: string;
  name: string;
  email: string;
  image?: string;
}

export interface AITicket {
  _id: string;
  ticketId: string;
  priority_rate: number;
  predicted_solution: string;
  summarized_content: string;
  similar_ticketids?: string[];
}

export interface UtilTicket {
  _id: string;
  ticketId: string;
  seen_time?: string;
  resolved_time?: string;
  customer_review?: string;
  customer_review_rating?: number;
}

export interface Ticket {
  _id: string;
  title: string;
  content: string;
  status: 'open' | 'in_progress' | 'closed';
  attachment?: string | null;
  sender_role: 'customer' | 'bot';
  solution?: string | null;
  solution_attachment?: string | null;
  customerId: string;
  agentId: string;
  companyId: string;
  chatId?: string;
  messages: Message[];
  customer?: Customer;
  agent?: Agent;
  aiTicket?: AITicket | null;
  utilTicket?: UtilTicket | null;
  aiSuggestions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  ticket: T;
}

export interface TicketUpdateResponse {
  success: boolean;
  ticket: Ticket;
}

export interface AddMessageInput {
  ticketId: string;
  content: string;
  attachment?: string;
  isAgent: boolean;
}

export interface UpdateTicketStatusInput {
  ticketId: string;
  status: 'open' | 'in_progress' | 'closed';
}
