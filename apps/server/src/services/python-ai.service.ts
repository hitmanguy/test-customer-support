import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AIResponse, PythonAIChatRequest, PythonAIChatResponse, AgentAIRequest, AgentAIResponse, AgentTicketAIRequest } from '../types/ai-types';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  performance_monitoring?: 'enabled' | 'disabled';
  error?: string;
  timestamp: Date;
  responseTimeMs?: number;
  performance?: string;
}

@Injectable()
export class PythonAIService {
  private readonly logger = new Logger(PythonAIService.name);
  private pythonServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get<string>('PYTHON_AI_SERVICE_URL') || 'http://localhost:8000';
    this.logger.log(`Python AI Service URL: ${this.pythonServiceUrl}`);
  }
  async checkHealth(): Promise<HealthCheckResponse> {
    try {
      this.logger.log(`Checking health of Python AI service at: ${this.pythonServiceUrl}/health`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
      
      const startTime = Date.now();
      
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.pythonServiceUrl}/health`,
          { signal: controller.signal as any }
        )
      ).finally(() => clearTimeout(timeoutId));
      
      const responseTime = Date.now() - startTime;
      
      this.logger.log(`Health check successful (${responseTime}ms)`, response.data);
      return {
        ...response.data,
        timestamp: new Date(),
        responseTimeMs: responseTime,
        performance: responseTime < 200 ? 'excellent' : 
                     responseTime < 500 ? 'good' : 
                     responseTime < 1000 ? 'fair' : 'poor'
      };
    } catch (error) {
      this.logger.error('Health check failed:', error.message);

      // Specific error response based on error type
      if (error.code === 'ECONNREFUSED') {
        return {
          status: 'unhealthy',
          database: 'disconnected',
          error: 'Cannot connect to Python service: Connection refused',
          timestamp: new Date(),
          responseTimeMs: -1,
          performance: 'unavailable'
        };
      } else if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        return {
          status: 'unhealthy',
          database: 'disconnected',
          error: 'Health check timed out',
          timestamp: new Date(),
          responseTimeMs: 5000,
          performance: 'timeout'
        };
      }

      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: `Health check failed: ${error.message}`,
        timestamp: new Date(),
        responseTimeMs: -1,
        performance: 'error'
      };
    }
  }
  
  async respondToCustomer(
    query: string,
    sessionId: string = 'default',
    companyId?: string,
    companyName?: string,
  ): Promise<AIResponse> {
    const requestPayload: PythonAIChatRequest = {
      query,
      session_id: sessionId,
      company_id: companyId,
      company_name: companyName,
    };

    try {
      this.logger.log(`Sending request to Python AI service: ${this.pythonServiceUrl}/customer-chat/respond`);
      const response = await firstValueFrom(
        this.httpService.post<PythonAIChatResponse>(
          `${this.pythonServiceUrl}/customer-chat/respond`,
          requestPayload,
        ),
      );
      
      const data = response.data;
      this.logger.log('Received response from Python AI service');
      
      return {
        answer: data.answer,
        sources: data.sources,
        sessionId: data.session_id,
        shouldCreateTicket: data.should_create_ticket,
        ticketId: data.ticket_id,
      };
    } catch (error) {
      this.logger.error('Error calling Python AI service for respondToCustomer', error.response?.data || error.message);
      
      // Provide a fallback response in case of service failure
      return {
        answer: "I'm experiencing technical difficulties. Please try again later or contact support for assistance.",
        sources: [],
        sessionId: sessionId,
        shouldCreateTicket: true,
        ticketId: `TCKT-ERROR-${Date.now().toString(36).toUpperCase()}`
      };
    }
  }

  async respondToAgent(
    query: string,
    agentId: string,
  ): Promise<AgentAIResponse> {
    const requestPayload: AgentAIRequest = {
      query,
      agent_id: agentId,
    };

    try {
      this.logger.log(`Sending request to Python AI service: ${this.pythonServiceUrl}/agent-ai/respond`);
      const response = await firstValueFrom(
        this.httpService.post<AgentAIResponse>(
          `${this.pythonServiceUrl}/agent-ai/respond`,
          requestPayload,
        ),
      );
      
      const data = response.data;
      this.logger.log('Received response from Python AI service');

      return {
        answer: data.answer,
        sources: data.sources || [],
      };
    } catch (error) {
      this.logger.error('Error calling Python AI service:', error);
      return {
        answer: 'Sorry, I encountered an error processing your request. Please try again later.',
        sources: [],
      };
    }
  }

  async respondToAgentWithTicketContext(
    query: string,
    ticketId: string,
    agentId: string,
    ticketData: any,
    aiTicketData?: any
  ): Promise<AgentAIResponse> {
    const requestPayload: AgentTicketAIRequest = {
      query,
      ticket_id: ticketId,
      agent_id: agentId,
      ticket_data: ticketData,
      ai_ticket_data: aiTicketData
    };

    try {
      this.logger.log(`Sending request to Python AI service: ${this.pythonServiceUrl}/agent-ai/ticket-respond`);
      const response = await firstValueFrom(
        this.httpService.post<AgentAIResponse>(
          `${this.pythonServiceUrl}/agent-ai/ticket-respond`,
          requestPayload,
        ),
      );
      
      const data = response.data;
      this.logger.log('Received response from Python AI service');

      return {
        answer: data.answer,
        sources: data.sources || [],
      };
    } catch (error) {
      this.logger.error('Error calling Python AI service:', error);
      return {
        answer: 'Sorry, I encountered an error processing this ticket. Please try again later.',
        sources: [],
      };
    }
  }

  async getCustomerTicketHistory(customerId: string, limit: number = 5): Promise<any[]> {
    try {
      this.logger.log(`Getting customer ticket history from Python AI service`);
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/agent-ai/customer-history`,
          { customer_id: customerId, limit }
        ),
      );
      
      return response.data.tickets || [];
    } catch (error) {
      this.logger.error('Error getting customer ticket history:', error);
      return [];
    }
  }

  async getSimilarTickets(ticketId: string, limit: number = 3): Promise<any[]> {
    try {
      this.logger.log(`Getting similar tickets from Python AI service`);
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/agent-ai/similar-tickets`,
          { ticket_id: ticketId, limit }
        ),
      );
      
      return response.data.similar_tickets || [];
    } catch (error) {
      this.logger.error('Error getting similar tickets:', error);
      return [];
    }
  }
  async analyzeTicket(ticketId: string, companyId: string): Promise<any> {
    try {
      this.logger.log(`Analyzing ticket ${ticketId} from Python AI service`);
      this.logger.log(`Using Python service URL: ${this.pythonServiceUrl}/analyze-ticket`);
      
      // Create request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/analyze-ticket`,
          { ticket_id: ticketId, company_id: companyId },
          { signal: controller.signal as any }
        ),
      ).finally(() => clearTimeout(timeoutId));
      
      this.logger.log(`Analysis completed for ticket ${ticketId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error analyzing ticket ${ticketId}:`, error);
      this.logger.error('Error details:', error.response?.status, error.response?.statusText, error.response?.data);
      this.logger.error('Request was made to:', `${this.pythonServiceUrl}/analyze-ticket`);
      
      // Provide more specific error messages based on error type
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AI service is not running. Please check the Python service.');
      } else if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        throw new Error('AI analysis request timed out. The operation may take too long.');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid ticket or company ID format: ${error.response.data?.detail || 'Unknown error'}`);
      } else if (error.response?.status === 404) {
        throw new Error(`Ticket not found: ${error.response.data?.detail || 'The ticket could not be found'}`);
      } else if (error.response?.status === 500) {
        throw new Error(`AI service internal error: ${error.response.data?.detail || 'Unknown server error'}`);
      }
      
      throw new Error(`Failed to analyze ticket: ${error.message}`);
    }
  }
  async getTicketAnalysis(ticketId: string): Promise<any> {
    try {
      this.logger.log(`Getting existing ticket analysis for ${ticketId}`);
      this.logger.log(`Using Python service URL: ${this.pythonServiceUrl}/ticket-analysis/${ticketId}`);
      
      // Create request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (shorter since it's just a GET)
      
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.pythonServiceUrl}/ticket-analysis/${ticketId}`,
          { signal: controller.signal as any }
        )
      ).finally(() => clearTimeout(timeoutId));
      
      this.logger.log(`Successfully retrieved analysis for ticket ${ticketId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting ticket analysis for ${ticketId}:`, error.response?.status, error.response?.statusText);
      this.logger.error('Request was made to:', `${this.pythonServiceUrl}/ticket-analysis/${ticketId}`);
      
      // Return null with 404 errors (no analysis yet)
      if (error.response?.status === 404) {
        this.logger.log(`No analysis found for ticket ${ticketId} (404 response)`);
        return null; // No analysis found
      }
      
      // Provide more specific error messages based on error type
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AI service is not running. Please check the Python service.');
      } else if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        throw new Error('AI analysis request timed out.');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid ticket ID format: ${error.response.data?.detail || 'Unknown error'}`);
      } else if (error.response?.status === 500) {
        throw new Error(`AI service internal error: ${error.response.data?.detail || 'Unknown server error'}`);
      }
      
      this.logger.error('Error getting ticket analysis:', error);
      throw new Error(`Failed to get ticket analysis: ${error.message}`);
    }
  }

  async clearConversationMemory(sessionId: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.pythonServiceUrl}/customer-chat/clear-memory`, { session_id: sessionId })
      );
      return response.data.success;
    } catch (error) {
      this.logger.error('Error clearing conversation memory', error.message);
      return false;
    }
  }

  async getConversationSummary(sessionId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.pythonServiceUrl}/customer-chat/get-summary`, { session_id: sessionId })
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error getting conversation summary', error.message);
      return { 
        error: true,
        message: "Failed to retrieve conversation history",
        sessionId
      };
    }
  }

  async performDiagnosticCheck(): Promise<any> {
    try {
      this.logger.log('Performing full diagnostic check of Python AI service');
      
      // First, check basic health
      const healthStatus = await this.checkHealth();
      
      if (healthStatus.status !== 'healthy') {
        return {
          ...healthStatus,
          diagnosticDetails: {
            message: 'Service health check failed, skipping additional diagnostics',
            dbStatsAvailable: false
          }
        };
      }
      
      // If healthy, check database stats
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const dbStatsResponse = await firstValueFrom(
          this.httpService.get(
            `${this.pythonServiceUrl}/db-stats`,
            { signal: controller.signal as any }
          )
        ).finally(() => clearTimeout(timeoutId));
        
        return {
          ...healthStatus,
          diagnosticDetails: {
            message: 'Full diagnostic completed successfully',
            dbStatsAvailable: true,
            dbStats: dbStatsResponse.data
          }
        };
      } catch (error) {
        this.logger.error('Error getting database stats:', error.message);
        return {
          ...healthStatus,
          diagnosticDetails: {
            message: 'Database stats check failed',
            dbStatsAvailable: false,
            error: error.message
          }
        };
      }
    } catch (error) {
      this.logger.error('Error performing diagnostic check:', error);
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: `Diagnostic check failed: ${error.message}`,
        timestamp: new Date(),
        diagnosticDetails: {
          message: 'Diagnostic check failed completely',
          dbStatsAvailable: false
        }
      };
    }
  }
}
