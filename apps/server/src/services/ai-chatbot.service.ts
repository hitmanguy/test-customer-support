import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { Injectable } from '@nestjs/common';

// Configuration
const AI_CONFIG = {
  PINECONE: {
    API_KEY: process.env.PINECONE_API_KEY || "pcsk_6huYPr_DJ1sQeb1hTAHfJ7B2gkSpksssvi76qJDJEGUfpVfUMB41kictgkvQqLUw62Jmsi",
    INDEX_NAME: process.env.PINECONE_INDEX_NAME || "llama-text-embed-v2-index",
    NAMESPACE: process.env.PINECONE_NAMESPACE || "ns3",
  },
  GOOGLE: {
    API_KEY: process.env.GOOGLE_GEMINI_API_KEY || "AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw",
    MODEL: "gemini-2.0-flash",
    TEMPERATURE: 0.3,
  },
  CHAT: {
    MAX_HISTORY: 10,
    RECENT_HISTORY: 5,
    TOP_K_RESULTS: 10,
    MAX_CONTEXT_CHUNKS: 5,
  },
  TICKET: {
    HELP_INDICATORS: [
      'problem', 'issue', 'error', 'broken', 'not working', 'help',
      'complaint', 'refund', 'cancel', 'billing', 'account',
      'urgent', 'emergency', 'frustrated', 'angry'
    ],
  },
};

const EMBEDDING_CONFIG = {
  DIMENSION: 1024,
  NORMALIZATION: true,
  SIMPLE_HASH_MULTIPLIER: 31,
};

// Types
interface ChatMessage {
  role: 'customer' | 'bot';
  content: string;
  timestamp: string;
}

interface ConversationMemory {
  [sessionId: string]: ChatMessage[];
}

interface SupportTicket {
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

interface PineconeMatch {
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

@Injectable()
export class AIChatbotService {
  private genAI: GoogleGenerativeAI;
  private pinecone: Pinecone;
  private index: any;
  private conversationMemory: ConversationMemory = {};
  private supportTickets: { [ticketId: string]: SupportTicket } = {};  // Configuration
  private readonly config = AI_CONFIG;

  constructor() {
    this.initializeServices();
  }
  private async initializeServices() {
    try {
      // Initialize Google Generative AI
      this.genAI = new GoogleGenerativeAI(this.config.GOOGLE.API_KEY);

      // Initialize Pinecone
      this.pinecone = new Pinecone({
        apiKey: this.config.PINECONE.API_KEY,
      });

      this.index = this.pinecone.index(this.config.PINECONE.INDEX_NAME).namespace(this.config.PINECONE.NAMESPACE);
      console.log('AI Chatbot Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
    }
  }
  /**
   * Get query embedding using an improved TF-IDF approach with better hashing
   * Note: In production, you'd want to use the same embedding model as Python (e5-large-v2)
   */
  private async getQueryEmbedding(queryText: string): Promise<number[]> {
    if (!queryText) return [];
    
    // Preprocessing
    const words = queryText.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter short words
    
    if (words.length === 0) return [];
    
    const embedding = new Array(EMBEDDING_CONFIG.DIMENSION).fill(0);
    
    // Improved embedding with word frequency and position weighting
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    words.forEach((word, index) => {
      const freq = wordFreq.get(word) || 1;
      const positionWeight = 1 / Math.sqrt(index + 1); // Earlier words get higher weight
      const tfWeight = Math.log(1 + freq); // TF component
      
      // Multiple hash functions for better distribution
      const hash1 = this.improvedHash(word, 31) % EMBEDDING_CONFIG.DIMENSION;
      const hash2 = this.improvedHash(word, 37) % EMBEDDING_CONFIG.DIMENSION;
      const hash3 = this.improvedHash(word, 41) % EMBEDDING_CONFIG.DIMENSION;
      
      const weight = tfWeight * positionWeight;
      embedding[hash1] += weight;
      embedding[hash2] += weight * 0.7;
      embedding[hash3] += weight * 0.5;
    });
    
    // Normalize the vector
    if (EMBEDDING_CONFIG.NORMALIZATION) {
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
    }
    
    return embedding;
  }

  private improvedHash(str: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash * EMBEDDING_CONFIG.SIMPLE_HASH_MULTIPLIER) + char) % 2147483647;
    }
    return Math.abs(hash);
  }
  /**
   * Search Pinecone for relevant context
   */
  private async searchPinecone(query: string, companyId?: string): Promise<string[]> {
    try {
      console.log('🔍 Searching Pinecone for query:', query);
      const queryEmbedding = await this.getQueryEmbedding(query);
      
      if (queryEmbedding.length === 0) {
        console.log('❌ Empty query embedding generated');
        return [];
      }

      console.log('✅ Generated embedding with dimension:', queryEmbedding.length);

      const searchRequest = {
        vector: queryEmbedding,
        topK: this.config.CHAT.TOP_K_RESULTS,
        includeMetadata: true,
        ...(companyId && {
          filter: {
            company_id: { $eq: 'BK001' }
          }
        })
      };

      console.log('📡 Pinecone search request:', { ...searchRequest, vector: `[${queryEmbedding.length} dimensions]` });

      // Use namespace in the query
      const results = await this.index.namespace(this.config.PINECONE.NAMESPACE).query(searchRequest);
      
      console.log('📊 Pinecone results:', {
        matchesCount: results.matches?.length || 0,
        firstMatch: results.matches?.[0] ? {
          id: results.matches[0].id,
          score: results.matches[0].score,
          hasMetadata: !!results.matches[0].metadata,
          hasText: !!results.matches[0].metadata?.text
        } : null
      });
      
      if (!results.matches || results.matches.length === 0) {
        console.log('❌ No matches found in Pinecone');
        return [];
      }

      // Extract text from metadata and rank by relevance
      const contextChunks = results.matches
        .filter((match: PineconeMatch) => match.metadata?.text)
        .slice(0, this.config.CHAT.MAX_CONTEXT_CHUNKS) // Top 5 results
        .map((match: PineconeMatch) => match.metadata.text!);

      console.log('✅ Extracted context chunks:', contextChunks.length);
      return contextChunks;
    } catch (error) {
      console.error('❌ Error searching Pinecone:', error);
      return [];
    }
  }
  /**
   * Get conversation context for a session
   */
  private getConversationContext(sessionId: string): string {
    if (!this.conversationMemory[sessionId]) {
      return "";
    }

    const history = this.conversationMemory[sessionId];
    const recentHistory = history.slice(-this.config.CHAT.RECENT_HISTORY); // Last 5 exchanges
      const contextParts: string[] = [];
    recentHistory.forEach((exchange: ChatMessage) => {
      contextParts.push(`User: ${exchange.content}`);
    });

    return contextParts.join('\n');
  }

  /**
   * Store conversation in memory
   */
  private storeConversation(sessionId: string, role: 'customer' | 'bot', content: string) {
    if (!this.conversationMemory[sessionId]) {
      this.conversationMemory[sessionId] = [];
    }

    this.conversationMemory[sessionId].push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 exchanges
    if (this.conversationMemory[sessionId].length > this.config.CHAT.MAX_HISTORY) {
      this.conversationMemory[sessionId] = this.conversationMemory[sessionId].slice(-this.config.CHAT.MAX_HISTORY);
    }
  }

  /**
   * Generate customer response using Gemini
   */  private async generateCustomerResponse(
    contextChunks: string[],
    question: string,
    conversationContext: string = "",
    companyName?: string
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.config.GOOGLE.MODEL,
        generationConfig: {
          temperature: this.config.GOOGLE.TEMPERATURE,
        }
      });
      
      const context = contextChunks.join('\n');
      const convContextSection = conversationContext 
        ? `\nPrevious Conversation:\n${conversationContext}\n` 
        : "";
      
      const companyContext = companyName 
        ? `You are helping customers of ${companyName}.` 
        : "You are helping customers of a business.";

      const prompt = `You are a friendly and helpful AI chatbot assisting customers.
${companyContext}
${convContextSection}
Knowledge Base:
${context}

Customer's Question: ${question}

Instructions:
- Respond in a polite, clear, and helpful tone
- Use plain language and be conversational
- If you can answer based on the knowledge base, provide a comprehensive response
- If you cannot find relevant information, politely say you need to connect them with a human agent
- Do not mention internal tools or technical details
- Keep responses focused and not too lengthy

Response:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating response:', error);      return "I'm sorry, I'm having trouble processing your request right now. Let me connect you with a human agent who can better assist you.";
    }
  }

  /**
   * Generate a general AI response when no specific context is found
   */
  private async generateGeneralResponse(
    question: string,
    conversationContext: string = "",
    companyName?: string
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.config.GOOGLE.MODEL,
        generationConfig: {
          temperature: this.config.GOOGLE.TEMPERATURE,
        }
      });
      
      const convContextSection = conversationContext 
        ? `\nPrevious Conversation:\n${conversationContext}\n` 
        : "";
      
      const companyContext = companyName 
        ? `You are helping customers of ${companyName}.` 
        : "You are helping customers of a business.";

      const prompt = `You are a friendly and helpful AI customer service assistant.
${companyContext}
${convContextSection}

Customer's Question: ${question}

Instructions:
- Respond in a polite, helpful, and conversational tone
- Try to provide general guidance or suggestions based on the question
- If you cannot provide specific information, offer to help in other ways
- Be empathetic and understanding
- Keep responses concise but helpful
- Do not mention that you lack specific information about the company
- If the question seems like it needs human assistance, suggest they can contact support

Response:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating general response:', error);
      return "I'm here to help! While I may not have specific details about your question right now, I'd be happy to assist you. Could you tell me more about what you're looking for, or would you like me to connect you with our support team?";
    }
  }

  /**
   * Create a support ticket
   */
  private createSupportTicket(sessionId: string, issue: string): string {
    const ticketId = `TCKT-${Date.now().toString(36).toUpperCase()}`;
    
    this.supportTickets[ticketId] = {
      sessionId,
      issue,
      timestamp: new Date().toISOString(),
      ticketId
    };

    return ticketId;
  }  /**
   * Determine if a ticket should be created based on the response and context
   */
  private shouldCreateTicket(query: string, contextChunks: string[]): boolean {
    const lowercaseQuery = query.toLowerCase();
    
    // Only create ticket if EXPLICITLY asking for help AND no context found
    const explicitHelpRequest = [
      'create ticket', 'need help', 'contact support', 'speak to agent',
      'human agent', 'talk to someone', 'escalate', 'complaint',
      'refund', 'billing issue', 'account problem', 'urgent', 'emergency'
    ].some(phrase => lowercaseQuery.includes(phrase));

    // If no relevant context found AND it's a complex issue
    const noRelevantContext = contextChunks.length === 0;
    const isComplexIssue = query.length > 150 && lowercaseQuery.includes('problem');
    
    console.log('🎫 Ticket creation check:', {
      query: query.substring(0, 50) + '...',
      explicitHelpRequest,
      noRelevantContext,
      isComplexIssue,
      contextChunksCount: contextChunks.length
    });
    
    // Much more conservative ticket creation - only when explicitly requested or very complex issues
    return explicitHelpRequest || (noRelevantContext && isComplexIssue);
  }  /**
   * Main chatbot response method
   */
  async respondToCustomer(
    query: string, 
    sessionId: string = 'default',
    companyId?: string,
    companyName?: string
  ): Promise<AIResponse> {
    try {
      console.log('🤖 AI Chatbot processing query:', { query, sessionId, companyId, companyName });
      
      // Store customer message
      this.storeConversation(sessionId, 'customer', query);

      // Get conversation context
      const conversationContext = this.getConversationContext(sessionId);

      // Search knowledge base
      const contextChunks = await this.searchPinecone(query, companyId);
      console.log('📚 Knowledge base search result:', { contextChunksCount: contextChunks.length });

      let response: string;
      let shouldCreateTicket = false;
      let ticketId: string | undefined;

      // Check if we should create a ticket
      const shouldCreateTicketResult = this.shouldCreateTicket(query, contextChunks);
      
      if (shouldCreateTicketResult) {
        // Create support ticket
        ticketId = this.createSupportTicket(sessionId, query);
        shouldCreateTicket = true;
        
        response = `I understand you need assistance with this matter. I've created a support ticket (${ticketId}) and our team will follow up with you shortly. Is there anything else I can help you with in the meantime?`;
        console.log('🎫 Created support ticket:', ticketId);
      } else {
        // Generate AI response - either with context or general response
        if (contextChunks.length > 0) {
          console.log('✅ Generating AI response with knowledge base context');
          response = await this.generateCustomerResponse(
            contextChunks,
            query,
            conversationContext,
            companyName
          );
        } else {
          console.log('🤔 No context found, generating general AI response');
          // Generate a helpful response even without specific context
          response = await this.generateGeneralResponse(query, conversationContext, companyName);
        }
      }

      // Store bot response
      this.storeConversation(sessionId, 'bot', response);

      console.log('✅ AI response generated:', { 
        responseLength: response.length, 
        shouldCreateTicket, 
        ticketId 
      });

      return {
        answer: response,
        sources: contextChunks,
        sessionId,
        shouldCreateTicket,
        ticketId
      };
    } catch (error) {
      console.error('❌ Error in respondToCustomer:', error);
      
      // Fallback response
      const ticketId = this.createSupportTicket(sessionId, query);
      return {
        answer: "I'm experiencing technical difficulties. I've created a support ticket for you and our team will assist you shortly.",
        sources: [],
        sessionId,
        shouldCreateTicket: true,
        ticketId
      };
    }
  }

  /**
   * Clear conversation memory for a session
   */
  clearConversationMemory(sessionId: string): boolean {
    if (this.conversationMemory[sessionId]) {
      delete this.conversationMemory[sessionId];
      return true;
    }
    return false;
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(sessionId: string): any {
    if (!this.conversationMemory[sessionId]) {
      return { message: "No conversation found for this session" };
    }

    const history = this.conversationMemory[sessionId];
    return {
      sessionId,
      totalExchanges: history.length,
      conversation: history
    };
  }

  /**
   * Get support ticket details
   */
  getSupportTicket(ticketId: string): SupportTicket | null {
    return this.supportTickets[ticketId] || null;
  }
}
