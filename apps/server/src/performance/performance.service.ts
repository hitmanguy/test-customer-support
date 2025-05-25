// src/performance/performance.service.ts

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@google/generative-ai';
import { HumanMessage } from 'langchain_core/messages';
import statistics from 'statistics.js'; // you can use a package like `simple-statistics`

interface Ticket {
  _id: string;
  title: string;
  content: string;
  status: string;
  solution: string;
  customerId: string;
  agentId: string;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UtilData {
  ticketId: string;
  companyId: string;
  seen_time: Date;
  resolved_time: Date;
  customer_review: string;
  customer_review_rating: number;
}

interface Agent {
  _id: string;
  name: string;
  companyId: string;
}

@Injectable()
export class PerformanceService {
  private llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    temperature: 0.3,
  });

  // Replace these with your MongoDB repositories later
  private SAMPLE_TICKETS: Ticket[] = [ /* ... */ ];
  private SAMPLE_UTIL_TICKETS: UtilData[] = [ /* ... */ ];
  private SAMPLE_AGENTS: Agent[] = [ /* ... */ ];

  private calculateHandlingTime(ticket: Ticket, util: UtilData): number {
    if (!util?.seen_time || !util?.resolved_time) return 0;
    const minutes = (util.resolved_time.getTime() - util.seen_time.getTime()) / 60000;
    return Math.max(minutes, 0);
  }

  private async analyzeSolutionQuality(ticket: Ticket) {
    const prompt = `Analyze this customer service ticket solution for quality:

Customer Issue: ${ticket.title}
Customer Description: ${ticket.content}
Agent Solution: ${ticket.solution}

Evaluate on:
1. Completeness
2. Clarity
3. Empathy
4. Proactiveness
5. Technical Accuracy
6. Customer Focus

Return _only_ a JSON object:
{
  "completeness": number,
  "clarity": number,
  "empathy": number,
  "proactiveness": number,
  "technical_accuracy": number,
  "customer_focus": number,
  "strengths": [string],
  "improvements": [string],
  "grade": string,
  "feedback": string
}`;
    try {
      const res = await this.llm.invoke([new HumanMessage(prompt)]);
      return JSON.parse(res.content.trim());
    } catch {
      return {
        completeness: 6,
        clarity: 6,
        empathy: 6,
        proactiveness: 6,
        technical_accuracy: 6,
        customer_focus: 6,
        strengths: ['Provided solution'],
        improvements: ['Provide more detail'],
        grade: 'C',
        feedback: 'Average solution quality.',
      };
    }
  }

  private async generateCoachingRecommendations(perf: any) {
    const perfSummary = `
Agent Performance Summary:
- Average Handling Time: ${perf.avg_handling_time.toFixed(1)} minutes
- Customer Satisfaction: ${perf.avg_csat.toFixed(1)}/5
- Solution Quality Scores: ${JSON.stringify(perf.solution_scores)}
- Total Tickets Handled: ${perf.total_tickets}
- Common Issues: ${perf.common_issues.join(', ')}
`;
    const prompt = `Based on this summary, provide personalized coaching recommendations in JSON:

{
  "strengths": [string, string, string],
  "improvements": [string, string, string],
  "training": [string, string, string],
  "short_term_goals": [string, string, string],
  "long_term_plan": [string, string, string]
}`;
    try {
      const res = await this.llm.invoke([new HumanMessage(perfSummary + prompt)]);
      return JSON.parse(res.content.trim());
    } catch {
      return {
        strengths: ['Problem solving', 'Technical accuracy', 'Professional tone'],
        improvements: ['Show more empathy', 'Be more proactive', 'Clarify next steps'],
        training: ['Empathy workshop', 'Advanced troubleshooting', 'Customer communication'],
        short_term_goals: ['Improve clarity score', 'Reduce handling time', 'Increase CSAT by 0.5'],
        long_term_plan: ['Mentor juniors', 'Develop knowledge base', 'Lead quality initiatives'],
      };
    }
  }

  async getAgentPerformance(agentId: string, companyId: string) {
    // 1. Filter tickets and utils
    const tickets = this.SAMPLE_TICKETS.filter(
      t => t.agentId === agentId && t.companyId === companyId,
    );
    if (!tickets.length) {
      throw new HttpException('No tickets found for this agent', HttpStatus.NOT_FOUND);
    }
    const utils = this.SAMPLE_UTIL_TICKETS.filter(u =>
      tickets.some(t => t._id === u.ticketId),
    );

    // 2. Compute metrics
    const handlingTimes: number[] = [];
    const csatScores: number[] = [];
    const qualityAnalyses: any[] = [];

    for (const ticket of tickets) {
      const util = utils.find(u => u.ticketId === ticket._id) || ({} as UtilData);
      const ht = this.calculateHandlingTime(ticket, util);
      if (ht > 0) handlingTimes.push(ht);
      if (util.customer_review_rating) csatScores.push(util.customer_review_rating);
      qualityAnalyses.push(await this.analyzeSolutionQuality(ticket));
    }

    const avg_handling_time = handlingTimes.length
      ? statistics.mean(handlingTimes)
      : 0;
    const avg_csat = csatScores.length ? statistics.mean(csatScores) : 0;

    const solution_scores = {};
    ['completeness','clarity','empathy','proactiveness','technical_accuracy','customer_focus']
      .forEach((key: string) => {
        solution_scores[key] = statistics.mean(
          qualityAnalyses.map(a => a[key] || 0),
        );
      });

    const common_issues = Array.from(
      new Set(tickets.map(t => t.title.split(' ')[0])),
    ).slice(0, 5);

    const performance_data = {
      agent_id: agentId,
      agent_name:
        this.SAMPLE_AGENTS.find(a => a._id === agentId)?.name || agentId,
      total_tickets: tickets.length,
      avg_handling_time,
      avg_csat,
      solution_scores,
      common_issues,
      performance_trend: avg_csat >= 4 ? 'improving' : 'needs_attention',
    };

    // 3. Coaching
    const coaching_recommendations = await this.generateCoachingRecommendations(
      performance_data,
    );

    return {
      agent_performance: performance_data,
      coaching_recommendations,
      recent_feedback: qualityAnalyses.slice(-3).map(a => a.feedback),
    };
  }

  async assessTicketQuality(ticketId: string) {
    const ticket = this.SAMPLE_TICKETS.find(t => t._id === ticketId);
    if (!ticket) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    const util = this.SAMPLE_UTIL_TICKETS.find(u => u.ticketId === ticketId);
    const quality_scores = await this.analyzeSolutionQuality(ticket);
    const handling_time = this.calculateHandlingTime(ticket, util as UtilData);
    return {
      ticket_id: ticketId,
      agent_id: ticket.agentId,
      customer_issue: ticket.content,
      agent_solution: ticket.solution,
      quality_scores,
      handling_time_minutes: handling_time,
      customer_satisfaction: util?.customer_review_rating || 0,
      customer_feedback: util?.customer_review || '',
      resolution_status: ticket.status,
      areas_of_excellence: quality_scores.strengths,
      improvement_areas: quality_scores.improvements,
    };
  }

  async getTeamPerformance(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    let tickets = this.SAMPLE_TICKETS.filter(t => t.companyId === companyId);
    if (startDate)
      tickets = tickets.filter(t => t.createdAt >= startDate);
    if (endDate)
      tickets = tickets.filter(t => t.createdAt <= endDate);

    // Group by agent
    const byAgent = new Map<string, Ticket[]>();
    tickets.forEach(t => {
      (byAgent.get(t.agentId) || byAgent.set(t.agentId, []).get(t.agentId))!.push(t);
    });

    const individual_performance = {};
    for (const [agentId, agentTickets] of byAgent.entries()) {
      const utils = this.SAMPLE_UTIL_TICKETS.filter(u =>
        agentTickets.some(t => t._id === u.ticketId),
      );
      const handlingTimes = agentTickets.map(t =>
        this.calculateHandlingTime(t, utils.find(u => u.ticketId === t._id) as UtilData),
      ).filter(v => v > 0);
      const csatScores = utils.map(u => u.customer_review_rating).filter(v => v > 0);

      // Quality analyses
      const analyses = [];
      for (const t of agentTickets) {
        analyses.push(await this.analyzeSolutionQuality(t));
      }

      const avg_solution_quality = {};
      ['completeness','clarity','empathy','proactiveness','technical_accuracy','customer_focus']
        .forEach(key => {
          avg_solution_quality[key] = statistics.mean(analyses.map(a => a[key] || 0));
        });

      const agentName = this.SAMPLE_AGENTS.find(a => a._id === agentId)?.name || agentId;
      individual_performance[agentId] = {
        name: agentName,
        total_tickets: agentTickets.length,
        avg_handling_time: handlingTimes.length ? statistics.mean(handlingTimes) : 0,
        avg_csat: csatScores.length ? statistics.mean(csatScores) : 0,
        solution_quality_scores: avg_solution_quality,
      };
    }

    const allHandling = Object.values(individual_performance).map((d: any) => d.avg_handling_time);
    const allCsat = Object.values(individual_performance).map((d: any) => d.avg_csat);

    const top_performer = Object.entries(individual_performance).sort(([,a],[,b]) => {
      const scoreA = a.avg_csat * 0.4 + statistics.mean(Object.values(a.solution_quality_scores)) * 0.6;
      const scoreB = b.avg_csat * 0.4 + statistics.mean(Object.values(b.solution_quality_scores)) * 0.6;
      return scoreB - scoreA;
    })[0]?.[0] || null;

    return {
      team_overview: {
        total_agents: Object.keys(individual_performance).length,
        total_tickets: tickets.length,
        avg_team_handling_time: allHandling.length ? statistics.mean(allHandling) : 0,
        avg_team_csat: allCsat.length ? statistics.mean(allCsat) : 0,
        top_performer,
      },
      individual_performance,
      performance_trends: {
        high_performers: Object.entries(individual_performance)
          .filter(([,d]: any) => d.avg_csat >= 4.5)
          .map(([id]) => id),
        needs_attention: Object.entries(individual_performance)
          .filter(([,d]: any) => d.avg_csat < 3.5)
          .map(([id]) => id),
      },
    };
  }

  async getCoachingInsights(
    companyId: string,
    agentId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    // Reuse getTeamPerformance to collect performance_data per agent
    const teamPerf = await this.getTeamPerformance(companyId, startDate, endDate);
    const insights = {};

    for (const [agentIdKey, perfData] of Object.entries<any>(teamPerf.individual_performance)) {
      if (agentId && agentIdKey !== agentId) continue;
      const coaching = await this.generateCoachingRecommendations({
        avg_handling_time: perfData.avg_handling_time,
        avg_csat: perfData.avg_csat,
        solution_scores: perfData.solution_quality_scores,
        total_tickets: perfData.total_tickets,
        common_issues: perfData.common_issues,
      });
      const avgSolutionScore = statistics.mean(Object.values(perfData.solution_quality_scores));
      const priority =
        perfData.avg_csat < 3.5 || avgSolutionScore < 6
          ? 'high'
          : perfData.avg_csat < 4 || avgSolutionScore < 7
          ? 'medium'
          : 'low';

      insights[agentIdKey] = {
        agent_name: perfData.name,
        performance_summary: {
          avg_handling_time: perfData.avg_handling_time,
          avg_csat: perfData.avg_csat,
          solution_scores: perfData.solution_quality_scores,
          common_issues: perfData.common_issues,
        },
        coaching_plan: coaching,
        priority_level: priority,
        focus_areas:
          priority === 'high'
            ? ['Solution Quality', 'Customer Empathy', 'Technical Accuracy']
            : ['Advanced Skills', 'Leadership'],
      };
    }

    return {
      coaching_insights: insights,
      summary: {
        total_agents_analyzed: Object.keys(insights).length,
        high_priority_coaching: Object.values(insights).filter((i: any) => i.priority_level === 'high')
          .length,
        focus_on_solution_quality: true,
        performance_overview: 'Solution-based performance analysis complete',
      },
    };
  }
}
