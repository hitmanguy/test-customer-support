// Types for AI-related functionality

export interface AIResponse {
  answer: string;
  sources: string[];
}

export interface TicketAIResponse {
  success: boolean;
  answer: string;
  sources: string[];
}

export interface AIAnalysisResponse {
  success: boolean;
  analysis: {
    _id: string;
    ticketId: string;
    companyId: string;
    priority_rate: number;
    predicted_solution: string;
    predicted_solution_attachment?: string;
    summarized_content: string;
    similar_ticketids: string[];
    createdAt: string;
    updatedAt: string;
    __v: number;
  } | null;
  error?: string;
}
