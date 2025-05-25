import { Injectable, Logger } from '@nestjs/common';
import {Pinecone} from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryEntry { query: string; response: string; }
const conversationMemory: Record<string, MemoryEntry[]> = {};

@Injectable()
export class AgentAssistService {
  private readonly logger = new Logger(AgentAssistService.name);
  private pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
  private index = this.pinecone.Index(process.env.PINECONE_INDEX_NAME!).namespace(process.env.PINECONE_NAMESPACE || 'default');
  private llm = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  async assist(query: string, sessionId = 'default') {
    const embeddingModel = this.llm.getGenerativeModel({ model: 'embedding-001' });
    const embed = await embeddingModel.embedContent({
      content: {
        role: 'user',
        parts: [{ text: query }]
      }
    });
    const vector = embed.embedding.values;
    const qres = await this.index.query({
      vector, topK: 5, includeMetadata: true,
    });
    const chunks = qres.matches
      .map(m => (m.metadata && m.metadata.text ? m.metadata.text as string : ''))
      .filter(text => text);
    const convCtx = this.getConversationContext(sessionId);

    let answer: string;
    if (!chunks.length) {
      answer = `No KB match. Could you clarify your question?`;
    } else {
      const prompt = this.buildPrompt(chunks, convCtx, query);
      const chatModel = this.llm.getGenerativeModel({ model: 'gemini-pro' });
      const gen = await chatModel.generateContent([prompt]);
      answer = gen.response.text().trim();
    }

    this.storeConversation(sessionId, query, answer);
    return { answer, sources: chunks, sessionId };
  }

  clearSession(sessionId: string) {
    delete conversationMemory[sessionId];
    return true;
  }

  getSessionSummary(sessionId: string) {
    const hist = conversationMemory[sessionId] || [];
    return { sessionId, totalExchanges: hist.length, conversation: hist };
  }

  private getConversationContext(sid: string): string {
    const hist = conversationMemory[sid] || [];
    return hist.slice(-5)
      .map(e => `Agent Q: ${e.query}\nAI A: ${e.response}`)
      .join('\n\n');
  }

  private storeConversation(sid: string, q: string, r: string) {
    if (!conversationMemory[sid]) conversationMemory[sid] = [];
    conversationMemory[sid].push({ query: q, response: r });
    if (conversationMemory[sid].length > 10)
      conversationMemory[sid] = conversationMemory[sid].slice(-10);
  }

  private buildPrompt(kb: string[], ctx: string, q: string): string {
    return `
You are an AI assistant for support agents.
${ctx ? `Previous Conversation:\n${ctx}\n\n` : ''}
Knowledge Base:
${kb.join('\n\n')}

Agent Question: ${q}

Provide a concise, actionable response.`;
  }
}
