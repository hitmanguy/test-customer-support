export interface Company {
  _id: string;
  name: string;
  email: string;
  picture?: string;
  verified: boolean;
  support_emails: string[];
}

export interface Ticket {
  _id: string;
  title: string;
  content: string;
  status: 'open' | 'in_progress' | 'closed';
  attachment?: string;
  sender_role: 'customer' | 'bot';
  solution?: string;
  solution_attachment?: string;
  customerId: string;
  agentId: string;
  companyId: string;
  chatId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    name: string;
    email: string;
    picture?: string;
  };
  agent?: {
    name: string;
    email: string;
    picture?: string;
  };
  utilTicket?: {
    seen_time?: string;
    resolved_time?: string;
    customer_review?: string;
    customer_review_rating?: number;
  };
}

export interface CompanyStats {
  agents: {
    total: number;
    verified: number;
  };
  tickets: {
    total: number;
    open: number;
    resolved: number;
  };
  rating: number;
}