import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AIResponse, PythonAIChatRequest, PythonAIChatResponse } from '../types/ai-types';

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
}
