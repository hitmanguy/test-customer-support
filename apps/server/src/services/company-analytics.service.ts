import { Injectable, Logger } from '@nestjs/common';
import { Company } from '../models/Company.model';
import { Ticket } from '../models/ticket.model';
import { Chat } from '../models/Chat.model';
import { Customer } from '../models/Customer.model';
import { AITicket } from '../models/AI_ticket.model';
import { UtilTicket } from '../models/util_ticket.model';
import { Types } from 'mongoose';

export interface CompanyAnalytics {
  overview: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    totalCustomers: number;
    avgResolutionTime: number;
    customerSatisfaction: number;
  };
  trends: {
    ticketVolume: Array<{ date: string; count: number }>;
    categoryDistribution: Array<{ category: string; count: number; percentage: number }>;
    priorityDistribution: Array<{ priority: string; count: number }>;
    resolutionTrends: Array<{ date: string; avgTime: number }>;
  };
  insights: {
    commonProblems: Array<{ problem: string; frequency: number; impact: string }>;
    futureRecommendations: Array<{ recommendation: string; priority: string; expectedImpact: string }>;
    riskFactors: Array<{ factor: string; severity: string; description: string }>;
  };
  performance: {
    agentPerformance: Array<{ agentId: string; ticketsResolved: number; avgTime: number; rating: number }>;
    channelPerformance: Array<{ channel: string; tickets: number; satisfaction: number }>;
  };
}

@Injectable()
export class CompanyAnalyticsService {
  private readonly logger = new Logger(CompanyAnalyticsService.name);

  constructor() {}

  /**
   * Get comprehensive company analytics
   */
  async getCompanyAnalytics(companyId: string): Promise<CompanyAnalytics> {
    try {
      this.logger.log(`Generating analytics for company: ${companyId}`);

      const [overview, trends, insights, performance] = await Promise.all([
        this.getOverviewStats(companyId),
        this.getTrendAnalysis(companyId),
        this.getInsights(companyId),
        this.getPerformanceMetrics(companyId)
      ]);

      return {
        overview,
        trends,
        insights,
        performance
      };
    } catch (error) {
      this.logger.error('Error generating company analytics:', error);
      throw error;
    }
  }
  /**
   * Get overview statistics
   */
  private async getOverviewStats(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    
    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      totalCustomers,
      avgResolutionTime,
      customerSatisfaction
    ] = await Promise.all([
      Ticket.countDocuments({ companyId: companyObjectId }),
      Ticket.countDocuments({ companyId: companyObjectId, status: { $in: ['open', 'in_progress'] } }),
      Ticket.countDocuments({ companyId: companyObjectId, status: 'closed' }),
      Customer.countDocuments(),
      this.calculateAverageResolutionTime(companyId),
      this.calculateCustomerSatisfaction(companyId)
    ]);

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      totalCustomers,
      avgResolutionTime,
      customerSatisfaction
    };
  }

  /**
   * Get trend analysis
   */
  private async getTrendAnalysis(companyId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [ticketVolume, categoryDistribution, priorityDistribution, resolutionTrends] = await Promise.all([
      this.getTicketVolumeTrend(companyId, thirtyDaysAgo),
      this.getCategoryDistribution(companyId),
      this.getPriorityDistribution(companyId),
      this.getResolutionTrends(companyId, thirtyDaysAgo)
    ]);

    return {
      ticketVolume,
      categoryDistribution,
      priorityDistribution,
      resolutionTrends
    };
  }

  /**
   * Get AI-powered insights
   */
  private async getInsights(companyId: string) {
    const [commonProblems, futureRecommendations, riskFactors] = await Promise.all([
      this.analyzeCommonProblems(companyId),
      this.generateFutureRecommendations(companyId),
      this.identifyRiskFactors(companyId)
    ]);

    return {
      commonProblems,
      futureRecommendations,
      riskFactors
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(companyId: string) {
    const [agentPerformance, channelPerformance] = await Promise.all([
      this.getAgentPerformance(companyId),
      this.getChannelPerformance(companyId)
    ]);

    return {
      agentPerformance,
      channelPerformance
    };
  }

  // Helper methods for specific calculations
  private async calculateAverageResolutionTime(companyId: string): Promise<number> {
    const companyObjectId = new Types.ObjectId(companyId);
    const pipeline = [
      { $match: { companyId: companyObjectId, status: 'closed', updatedAt: { $exists: true }, createdAt: { $exists: true } } },
      {
        $addFields: {
          resolutionTime: {
            $subtract: ['$updatedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' }
        }
      }
    ];

    const result = await Ticket.aggregate(pipeline);
    return result[0]?.avgTime ? Math.round(result[0].avgTime / (1000 * 60 * 60)) : 0; // Convert to hours
  }
  private async calculateCustomerSatisfaction(companyId: string): Promise<number> {
    const companyObjectId = new Types.ObjectId(companyId);
    // Mock calculation - in real app, this would come from customer feedback
    const resolvedTickets = await Ticket.countDocuments({ companyId: companyObjectId, status: 'closed' });
    const totalTickets = await Ticket.countDocuments({ companyId: companyObjectId });
    
    return totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
  }  private async getTicketVolumeTrend(companyId: string, fromDate: Date) {
    const companyObjectId = new Types.ObjectId(companyId);
    const pipeline = [
      { $match: { companyId: companyObjectId, createdAt: { $gte: fromDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } as any },
      { $project: { date: '$_id', count: 1, _id: 0 } }
    ];

    return await Ticket.aggregate(pipeline);
  }
  private async getCategoryDistribution(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    // Since tickets don't have categories directly, we'll use AI ticket data or create mock data
    const pipeline = [
      { 
        $lookup: {
          from: 'aitickets',
          localField: '_id',
          foreignField: 'ticketId',
          as: 'aiData'
        }
      },
      { $match: { companyId: companyObjectId } },
      { 
        $addFields: {
          category: {
            $ifNull: [
              { $arrayElemAt: ['$aiData.category', 0] },
              'General'
            ]
          }
        }
      },      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } as any }
    ];

    const results = await Ticket.aggregate(pipeline);
    const total = results.reduce((sum: number, item: any) => sum + item.count, 0);

    return results.map((item: any) => ({
      category: item._id || 'Uncategorized',
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));
  }
  private async getPriorityDistribution(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const pipeline = [
      { 
        $lookup: {
          from: 'aitickets',
          localField: '_id',
          foreignField: 'ticketId',
          as: 'aiData'
        }
      },
      { $match: { companyId: companyObjectId } },
      { 
        $addFields: {
          priority: {
            $switch: {
              branches: [
                { case: { $gte: [{ $arrayElemAt: ['$aiData.priority_rate', 0] }, 4] }, then: 'High' },
                { case: { $gte: [{ $arrayElemAt: ['$aiData.priority_rate', 0] }, 2] }, then: 'Medium' },
              ],
              default: 'Low'
            }
          }
        }
      },      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } as any }
    ];

    const results = await Ticket.aggregate(pipeline);
    return results.map((item: any) => ({
      priority: item._id || 'Normal',
      count: item.count
    }));
  }
  private async getResolutionTrends(companyId: string, fromDate: Date) {
    const companyObjectId = new Types.ObjectId(companyId);
    const pipeline = [
      { 
        $match: { 
          companyId: companyObjectId, 
          status: 'closed',
          createdAt: { $gte: fromDate },
          updatedAt: { $exists: true }
        } 
      },
      {
        $addFields: {
          resolutionTime: {
            $subtract: ['$updatedAt', '$createdAt']
          },
          date: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          }
        }
      },
      {
        $group: {
          _id: '$date',
          avgTime: { $avg: '$resolutionTime' }
        }
      },
      { $sort: { '_id': 1 } as any },
      { 
        $project: { 
          date: '$_id', 
          avgTime: { $round: [{ $divide: ['$avgTime', 3600000] }, 1] }, // Convert to hours
          _id: 0 
        } 
      }
    ];

    return await Ticket.aggregate(pipeline);
  }
  private async analyzeCommonProblems(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    // Use AI ticket analysis to find common problems
    const pipeline = [
      { $match: { companyId: companyObjectId } },
      { 
        $group: { 
          _id: { 
            $ifNull: ['$category', 'General Issues'] 
          }, 
          frequency: { $sum: 1 } 
        } 
      },
      { $sort: { frequency: -1 } as any },
      { $limit: 10 }
    ];

    const results = await AITicket.aggregate(pipeline);
    
    return results.map((item: any) => ({
      problem: item._id || 'General Issues',
      frequency: item.frequency,
      impact: this.calculateImpact(item.frequency)
    }));
  }

  private calculateImpact(frequency: number): string {
    if (frequency > 50) return 'High';
    if (frequency > 20) return 'Medium';
    return 'Low';
  }

  private async generateFutureRecommendations(companyId: string) {
    // AI-powered recommendations based on ticket patterns
    const commonCategories = await this.getCategoryDistribution(companyId);
    const recommendations = [];

    for (const category of commonCategories.slice(0, 3)) {
      if (category.percentage > 20) {
        recommendations.push({
          recommendation: `Create dedicated FAQ section for ${category.category} issues`,
          priority: 'High',
          expectedImpact: `Could reduce ${category.category} tickets by 30-40%`
        });
      }
    }

    // Add general recommendations
    recommendations.push(
      {
        recommendation: 'Implement proactive customer communication for common issues',
        priority: 'Medium',
        expectedImpact: 'Reduce ticket volume by 15-20%'
      },
      {
        recommendation: 'Set up automated responses for frequently asked questions',
        priority: 'Medium',
        expectedImpact: 'Improve response time by 50%'
      }
    );

    return recommendations;
  }
  private async identifyRiskFactors(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const riskFactors = [];
    
    // Check for high open ticket ratio
    const totalTickets = await Ticket.countDocuments({ companyId: companyObjectId });
    const openTickets = await Ticket.countDocuments({ 
      companyId: companyObjectId, 
      status: { $in: ['open', 'in_progress'] } 
    });

    if (totalTickets > 0 && (openTickets / totalTickets) > 0.3) {
      riskFactors.push({
        factor: 'High Open Ticket Ratio',
        severity: 'High',
        description: `${Math.round((openTickets / totalTickets) * 100)}% of tickets are still open`
      });
    }

    // Check for ticket volume trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTickets = await Ticket.countDocuments({ 
      companyId: companyObjectId, 
      createdAt: { $gte: thirtyDaysAgo } 
    });
    
    if (recentTickets > 100) {
      riskFactors.push({
        factor: 'High Ticket Volume',
        severity: 'Medium',
        description: `${recentTickets} tickets created in the last 30 days`
      });
    }

    // Check for low resolution rate
    const resolvedTickets = await Ticket.countDocuments({ companyId: companyObjectId, status: 'closed' });
    if (totalTickets > 0 && (resolvedTickets / totalTickets) < 0.7) {
      riskFactors.push({
        factor: 'Low Resolution Rate',
        severity: 'High',
        description: `Only ${Math.round((resolvedTickets / totalTickets) * 100)}% of tickets are resolved`
      });
    }

    return riskFactors;
  }

  private async getAgentPerformance(companyId: string) {
    // Mock data - in real app, track agent assignments and performance
    return [
      { agentId: 'agent1', ticketsResolved: 45, avgTime: 24, rating: 4.8 },
      { agentId: 'agent2', ticketsResolved: 38, avgTime: 18, rating: 4.6 },
      { agentId: 'agent3', ticketsResolved: 52, avgTime: 32, rating: 4.9 }
    ];
  }
  private async getChannelPerformance(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    // Mock channel performance since tickets don't have channel field
    const totalTickets = await Ticket.countDocuments({ companyId: companyObjectId });
    
    return [
      {
        channel: 'Web Portal',
        tickets: Math.round(totalTickets * 0.6),
        satisfaction: Math.round(80 + Math.random() * 15)
      },
      {
        channel: 'Email',
        tickets: Math.round(totalTickets * 0.25),
        satisfaction: Math.round(75 + Math.random() * 15)
      },
      {
        channel: 'Chat',
        tickets: Math.round(totalTickets * 0.15),
        satisfaction: Math.round(85 + Math.random() * 10)
      }
    ];
  }
}
