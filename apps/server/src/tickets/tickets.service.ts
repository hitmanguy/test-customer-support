// src/tickets/tickets.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HumanMessage } from 'langchain_core/messages';

interface TicketRecord {
  problem: string;
  solution: string;
  agent_involvement: boolean;
}
interface AnalyzeResult {
  category: string;
  priority: string;
  solution: string;
  agent_needed: boolean;
  summary: string;
  assigned_technician: string;
  confidence: string;
  solution_sources: { past_tickets: number; knowledge_base: number };
  tickets_in_db: number;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  // In-memory DB
  private ticketsDatabase: TicketRecord[] = [];
  private technicians = [
    { name: 'Priya', skills: ['order', 'general'], available: true },
    { name: 'Rahul', skills: ['delivery', 'order'], available: true },
    { name: 'Anjali', skills: ['technical', 'app', 'website'], available: true },
    { name: 'Mohit', skills: ['general', 'franchise'], available: false },
  ];

  private llm = new GoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    temperature: 0.3,
  });

  /** Analyze a new incoming ticket */
  async analyzeTicket(
    title: string,
    description: string,
    chatHistory: string[],
  ): Promise<AnalyzeResult> {
    const combined = description + ' ' + chatHistory.join(' ');
    const category = await this.categorizeTicket(description);
    const priority = await this.getPriority(combined);
    const hybrid = await this.getHybridSolution(description);
    const summary = await this.generateSummary(description, chatHistory);
    const assigned = hybrid.agent_needed
      ? this.assignTechnician(category)
      : 'Not needed';

    return {
      category,
      priority,
      solution: hybrid.solution,
      agent_needed: hybrid.agent_needed,
      summary,
      assigned_technician: assigned,
      confidence: hybrid.confidence,
      solution_sources: hybrid.sources,
      tickets_in_db: this.ticketsDatabase.length,
    };
  }

  /** Add resolved ticket to DB */
  addResolved(ticket: TicketRecord) {
    this.ticketsDatabase.push(ticket);
    return { message: 'Ticket added', total: this.ticketsDatabase.length };
  }

  /** Quick stats */
  stats() {
    return {
      total_tickets: this.ticketsDatabase.length,
      search_enabled: this.ticketsDatabase.length >= 3,
    };
  }

  // --- Helpers ported directly from Python ---

  private async categorizeTicket(text: string): Promise<string> {
    const prompt = `Analyze the following customer support ticket and categorize it into one of these categories:
- order
- delivery
- technical
- general

Ticket: ${text}

Return only the category name (order/delivery/technical/general):`;
    try {
      const res = await this.llm.invoke([new HumanMessage(prompt)]);
      const cat = res.content.trim().toLowerCase();
      return ['order','delivery','technical','general'].includes(cat)
        ? cat
        : 'general';
    } catch {
      // fallback keyword
      const kw: Record<string,string[]> = {
        order: ['order','missing','wrong','receipt','bill'],
        delivery: ['late','cold','delivery'],
        technical: ['app','website','login','payment'],
        general: ['menu','feedback','coupon','franchise'],
      };
      const low = text.toLowerCase();
      for (const [c, keys] of Object.entries(kw))
        if (keys.some(k => low.includes(k))) return c;
      return 'general';
    }
  }

  private async getPriority(text: string): Promise<string> {
    const prompt = `Analyze sentiment & urgency and return only High, Medium, or Low.

Text: ${text}`;
    try {
      const res = await this.llm.invoke([new HumanMessage(prompt)]);
      const p = res.content.trim();
      return ['High','Medium','Low'].includes(p) ? p : 'Medium';
    } catch {
      return 'Medium';
    }
  }

  private async getHybridSolution(problem: string): Promise<{
    solution: string;
    agent_needed: boolean;
    confidence: string;
    sources: { past_tickets: number; knowledge_base: number };
  }> {
    // past tickets
    const past = this.ticketsDatabase.filter(t =>
      problem.toLowerCase().includes(t.problem.toLowerCase().slice(0,5)),
    );
    const ticketSolutions = past.map(t => ({
      source: 'past_ticket',
      solution: t.solution,
      agent_needed: t.agent_involvement,
      similarity: 1.0,
      original_problem: t.problem,
    }));

    // KB via agent-assist (reuse that service!)
    // For brevity, we just count 0 here.
    const kbSolutionsCount = 0;

    // Combine via Gemini
    if (!ticketSolutions.length && kbSolutionsCount === 0) {
      return {
        solution: 'No similar cases. Escalate.',
        agent_needed: true,
        confidence: 'low',
        sources: { past_tickets: 0, knowledge_base: 0 },
      };
    }

    const contextParts: string[] = [];
    ticketSolutions.slice(0,3).forEach((s,i) => {
      contextParts.push(`Ticket${i+1}: ${s.original_problem}\nSolution: ${s.solution}`);
    });
    const context = contextParts.join('\n\n');
    const prompt = `Based on the following, provide best solution:

CUSTOMER PROBLEM: ${problem}

INFO:
${context}

Please output:
SOLUTION: [text]
AGENT_NEEDED: [true/false]
CONFIDENCE: [high/medium/low]`;
    try {
      const res = await this.llm.invoke([new HumanMessage(prompt)]);
      const txt = res.content.trim().split('\n');
      let sol='','conf'='low', agentNeeded=true;
      txt.forEach(l => {
        if (l.startsWith('SOLUTION:')) sol = l.replace('SOLUTION:','').trim();
        if (l.startsWith('AGENT_NEEDED:'))
          agentNeeded = l.toLowerCase().includes('true');
        if (l.startsWith('CONFIDENCE:'))
          conf = l.replace('CONFIDENCE:','').trim().toLowerCase();
      });
      return {
        solution: sol,
        agent_needed: agentNeeded,
        confidence: conf,
        sources: { past_tickets: ticketSolutions.length, knowledge_base: kbSolutionsCount },
      };
    } catch {
      return {
        solution: 'Error combining solutions.',
        agent_needed: true,
        confidence: 'low',
        sources: { past_tickets: ticketSolutions.length, knowledge_base: kbSolutionsCount },
      };
    }
  }

  private async generateSummary(desc: string, history: string[]): Promise<string> {
    const combined = desc + ' ' + history.join(' ');
    const prompt = `Summarize this ticket in 2-3 sentences:

${combined}

Summary:`;
    try {
      const res = await this.llm.invoke([new HumanMessage(prompt)]);
      return res.content.trim();
    } catch {
      return combined.slice(0,200) + '...';
    }
  }

  private assignTechnician(category: string): string {
    for (const tech of this.technicians) {
      if (tech.available && tech.skills.includes(category)) return tech.name;
    }
    return 'No technician available';
  }
}
