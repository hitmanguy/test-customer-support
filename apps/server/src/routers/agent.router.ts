import { Injectable } from '@nestjs/common';
import { TrpcService } from '@server/trpc/trpc.service';
import { z } from 'zod';
import { Types } from 'mongoose';
import {Ticket} from '@server/models/ticket.model';
import {AITicket} from '@server/models/AI_ticket.model';
import {UtilTicket} from '@server/models/util_ticket.model';
import { Agent } from '@server/models/Agent.model';
import { PythonAIService } from '@server/services/python-ai.service';
import { Customer } from '@server/models/Customer.model';
import { HealthMonitorService } from '@server/services/health-monitor.service';


@Injectable()
export class AgentRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly pythonAIService: PythonAIService,
    private readonly healthMonitorService: HealthMonitorService
  ) {}
  agentRouter = this.trpc.router({
    
    checkPythonServiceHealth: this.trpc.procedure
      .query(async () => {
        try {
          
          const healthStatus = await this.pythonAIService.checkHealth();
          
          
          const monitorStatus = this.healthMonitorService.getLastHealthStatus();
          
          return {
            ...healthStatus,
            monitoring: {
              lastChecked: monitorStatus.lastChecked,
              consecutiveFailures: monitorStatus.failureCount,
              monitoredStatus: monitorStatus.status
            }
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date(),
            monitoring: {
              lastChecked: new Date(),
              consecutiveFailures: 0,
              monitoredStatus: 'unknown'
            }
          };
        }
      }),
    
    getAnalytics: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string(),
        timeRange: this.trpc.z.enum(['today', 'last7days', 'last30days', 'alltime']).default('last30days')
      }))
      .query(async ({ input }) => {
        try {
          
          const endDate = new Date();
          let startDate = new Date();
          
          switch(input.timeRange) {
            case 'today':
              startDate.setHours(0, 0, 0, 0);
              break;
            case 'last7days':
              startDate.setDate(endDate.getDate() - 7);
              break;
            case 'last30days':
              startDate.setDate(endDate.getDate() - 30);
              break;
            case 'alltime':
              startDate = new Date(0); 
              break;
          }

          
          const tickets = await Ticket.find({
            agentId: new Types.ObjectId(input.agentId),
            createdAt: { $gte: startDate, $lte: endDate }
          }).sort({ createdAt: 1 });
          
          
          const ticketIds = tickets.map(ticket => ticket._id);
          const [aiTickets, utilTickets] = await Promise.all([
            AITicket.find({ ticketId: { $in: ticketIds } }),
            UtilTicket.find({ ticketId: { $in: ticketIds } })
          ]);
          
          
          const aiTicketsMap = new Map(aiTickets.map(ticket => [ticket.ticketId.toString(), ticket]));
          const utilTicketsMap = new Map(utilTickets.map(ticket => [ticket.ticketId.toString(), ticket]));

          
          const performanceOverviewLabels = [];
          const ticketsResolvedData: number[] = [];
          const responseTimeData: number[] = [];

          
          const dateGroups = new Map();
          const msPerDay = 24 * 60 * 60 * 1000;
          
          
          const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay));
          for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateStr = date.toLocaleDateString();
            performanceOverviewLabels.push(dateStr);
            dateGroups.set(dateStr, { resolved: 0, responseTimes: [] });
          }

          
          let totalResolutionTime = 0;
          let totalResolutionCount = 0;
          let totalFirstResponseTime = 0;
          let totalFirstResponseCount = 0;
          let ticketsResolvedCount = 0;
          let totalSatisfactionScore = 0;
          let totalSatisfactionCount = 0;
          
          
          tickets.forEach(ticket => {
            const ticketId = ticket._id.toString();
            const aiTicket = aiTicketsMap.get(ticketId);
            const utilTicket = utilTicketsMap.get(ticketId);
            
            const dateStr = new Date(ticket.createdAt).toLocaleDateString();
            const dateGroup = dateGroups.get(dateStr) || { resolved: 0, responseTimes: [] };
            
            
            if (ticket.status === 'closed') {
              dateGroup.resolved++;
              ticketsResolvedCount++;
              
              
              if (utilTicket && utilTicket.resolved_time) {
                const resolutionTime = utilTicket.resolved_time.getTime() - ticket.createdAt.getTime();
                totalResolutionTime += resolutionTime / (1000 * 60); 
                totalResolutionCount++;
              }
            }
            
            
            if (ticket.messages && ticket.messages.length > 1) {
              
              const firstAgentMessage = ticket.messages.find(m => m.isAgent === true);
              if (firstAgentMessage) {
                const responseTime = new Date(firstAgentMessage.createdAt).getTime() - ticket.createdAt.getTime();
                dateGroup.responseTimes.push(responseTime / (1000 * 60)); 
                
                totalFirstResponseTime += responseTime / (1000 * 60);
                totalFirstResponseCount++;
              }
            }
            
            
            if (utilTicket && utilTicket.customer_review_rating) {
              totalSatisfactionScore += utilTicket.customer_review_rating;
              totalSatisfactionCount++;
            }
            
            dateGroups.set(dateStr, dateGroup);
          });
          
          
          performanceOverviewLabels.forEach(dateStr => {
            const data = dateGroups.get(dateStr);
            ticketsResolvedData.push(data.resolved);
            
            
            const avgResponseTime = data.responseTimes.length > 0 
              ? data.responseTimes.reduce((sum: number, time: number) => sum + time, 0) / data.responseTimes.length 
              : 0;
            responseTimeData.push(Math.round(avgResponseTime));
          });
          
          
          const avgResolutionTime = totalResolutionCount > 0 
            ? Math.round(totalResolutionTime / totalResolutionCount) 
            : 0;
          
          const avgFirstResponseTime = totalFirstResponseCount > 0 
            ? Math.round(totalFirstResponseTime / totalFirstResponseCount) 
            : 0;
          
          const ticketsResolvedRate = tickets.length > 0 
            ? Math.round((ticketsResolvedCount / tickets.length) * 100) 
            : 0;
          
          const avgCustomerSatisfaction = totalSatisfactionCount > 0 
            ? (totalSatisfactionScore / totalSatisfactionCount).toFixed(1) 
            : 0;
          
          
          const statusDistribution = {
            open: tickets.filter(t => t.status === 'open').length,
            in_progress: tickets.filter(t => t.status === 'in_progress').length,
            closed: tickets.filter(t => t.status === 'closed').length
          };
          
          
          const categories = ['Account', 'Billing', 'Technical', 'General', 'Product'];
          const resolutionTimeByCategory = categories.map(category => {
            const categoryTickets = tickets.filter(t => 
              t.status === 'closed' && 
              t.title.toLowerCase().includes(category.toLowerCase())
            );
            
            if (categoryTickets.length === 0) return Math.floor(Math.random() * 40) + 30; 
            
            let totalTime = 0;
            let count = 0;
            
            categoryTickets.forEach(ticket => {
              const ticketId = ticket._id.toString();
              const utilTicket = utilTicketsMap.get(ticketId);
              
              if (utilTicket && utilTicket.resolved_time) {
                const resolutionTime = utilTicket.resolved_time.getTime() - ticket.createdAt.getTime();
                totalTime += resolutionTime / (1000 * 60); 
                count++;
              }
            });
            
            return count > 0 ? Math.round(totalTime / count) : Math.floor(Math.random() * 40) + 30; 
          });
          
          
          const formatTimeMinutes = (minutes: number): string => {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          };

          return {
            success: true,
            performanceOverview: {
              labels: performanceOverviewLabels,
              datasets: [
                {
                  label: 'Tickets Resolved',
                  data: ticketsResolvedData
                },
                {
                  label: 'Response Time (min)',
                  data: responseTimeData
                }
              ]
            },
            resolutionTimeByCategory: {
              labels: categories,
              data: resolutionTimeByCategory
            },
            ticketDistribution: {
              labels: ['Open', 'In Progress', 'Resolved'],
              data: [
                statusDistribution.open,
                statusDistribution.in_progress,
                statusDistribution.closed
              ]
            },
            satisfactionTrend: {
              labels: performanceOverviewLabels,
              data: Array(performanceOverviewLabels.length).fill(null).map(() => {
                
                return totalSatisfactionCount > 0 
                  ? Number((Math.random() * 0.5 + (totalSatisfactionScore / totalSatisfactionCount) - 0.25).toFixed(1))
                  : Math.floor(Math.random() * 10 + 35) / 10;
              })
            },
            responseTimeline: {
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              data: responseTimeData.slice(-7).length === 7 
                ? responseTimeData.slice(-7) 
                : Array(7).fill(null).map((_, i) => responseTimeData[i] || Math.floor(Math.random() * 20) + 10)
            },
            metrics: {
              avgResolutionTime: formatTimeMinutes(avgResolutionTime),
              firstResponseTime: formatTimeMinutes(avgFirstResponseTime),
              ticketsResolvedRate: `${ticketsResolvedRate}%`,
              customerSatisfaction: `${avgCustomerSatisfaction}/5`
            },
            ticketsTotal: tickets.length,
            ticketsResolved: ticketsResolvedCount
          };
        } catch (error) {
          console.error('Error fetching agent analytics:', error);
          throw new Error(error.message || "Failed to fetch agent analytics");
        }
      }),

    
    getAgentStats: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          
          const [allTickets, todayTickets, yesterdayTickets] = await Promise.all([
            Ticket.find({ agentId: new Types.ObjectId(input.agentId) }),
            Ticket.find({ 
              agentId: new Types.ObjectId(input.agentId),
              createdAt: { $gte: today }
            }),
            Ticket.find({ 
              agentId: new Types.ObjectId(input.agentId),
              createdAt: { $gte: yesterday, $lt: today }
            })
          ]);

          
          const openTickets = allTickets.filter(ticket => ticket.status === 'open').length;
          const yesterdayOpenTickets = yesterdayTickets.filter(ticket => ticket.status === 'open').length;
          const openTicketsTrend = yesterdayOpenTickets > 0 
            ? Math.round(((openTickets - yesterdayOpenTickets) / yesterdayOpenTickets) * 100)
            : 0;

          
          const resolvedToday = allTickets.filter(ticket => 
            ticket.status === 'closed' && 
            new Date(ticket.updatedAt).getTime() >= today.getTime()
          ).length;
          const resolvedYesterday = yesterdayTickets.filter(ticket => ticket.status === 'closed').length;
          const resolvedTodayTrend = resolvedYesterday > 0 
            ? Math.round(((resolvedToday - resolvedYesterday) / resolvedYesterday) * 100)
            : 0;

          
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          
          const recentTickets = allTickets.filter(ticket => 
            new Date(ticket.createdAt).getTime() >= lastWeek.getTime()
          );

          let totalResponseTime = 0;
          let responseCount = 0;

          for (const ticket of recentTickets) {
            if (ticket.messages && ticket.messages.length > 1) {
              const firstAgentMessageIndex = ticket.messages.findIndex(m => m.isAgent === true);
              
              if (firstAgentMessageIndex > 0) {
                const customerMessageTime = new Date(ticket.messages[0].createdAt).getTime();
                const agentResponseTime = new Date(ticket.messages[firstAgentMessageIndex].createdAt).getTime();
                totalResponseTime += (agentResponseTime - customerMessageTime) / (1000 * 60); 
                responseCount++;
              }
            }
          }

          const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
          
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          
          const previousWeekTickets = allTickets.filter(ticket => 
            new Date(ticket.createdAt).getTime() >= twoWeeksAgo.getTime() &&
            new Date(ticket.createdAt).getTime() < lastWeek.getTime()
          );

          let previousWeekResponseTime = 0;
          let previousWeekCount = 0;

          for (const ticket of previousWeekTickets) {
            if (ticket.messages && ticket.messages.length > 1) {
              const firstAgentMessageIndex = ticket.messages.findIndex(m => m.isAgent === true);
              
              if (firstAgentMessageIndex > 0) {
                const customerMessageTime = new Date(ticket.messages[0].createdAt).getTime();
                const agentResponseTime = new Date(ticket.messages[firstAgentMessageIndex].createdAt).getTime();
                previousWeekResponseTime += (agentResponseTime - customerMessageTime) / (1000 * 60);
                previousWeekCount++;
              }
            }
          }

          const prevAvgResponseTime = previousWeekCount > 0 ? Math.round(previousWeekResponseTime / previousWeekCount) : avgResponseTime;
          const avgResponseTimeTrend = prevAvgResponseTime > 0 
            ? Math.round(((avgResponseTime - prevAvgResponseTime) / prevAvgResponseTime) * 100) 
            : 0;

          
          const lastMonth = new Date();
          lastMonth.setDate(lastMonth.getDate() - 30);
          
          const ticketIds = allTickets
            .filter(ticket => new Date(ticket.createdAt).getTime() >= lastMonth.getTime())
            .map(ticket => ticket._id);

          const utilTickets = await UtilTicket.find({ 
            ticketId: { $in: ticketIds },
            customer_review_rating: { $exists: true }
          });

          const totalRating = utilTickets.reduce((sum, ticket) => sum + ticket.customer_review_rating, 0);
          const customerSatisfaction = utilTickets.length > 0 ? Math.round((totalRating / utilTickets.length) * 20) : 90; 
          
          
          const twoMonthsAgo = new Date();
          twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
          
          const previousMonthTicketIds = allTickets
            .filter(ticket => 
              new Date(ticket.createdAt).getTime() >= twoMonthsAgo.getTime() &&
              new Date(ticket.createdAt).getTime() < lastMonth.getTime()
            )
            .map(ticket => ticket._id);

          const previousMonthUtilTickets = await UtilTicket.find({ 
            ticketId: { $in: previousMonthTicketIds },
            customer_review_rating: { $exists: true }
          });

          const previousTotalRating = previousMonthUtilTickets.reduce((sum, ticket) => sum + ticket.customer_review_rating, 0);
          const prevCustomerSatisfaction = previousMonthUtilTickets.length > 0 
            ? Math.round((previousTotalRating / previousMonthUtilTickets.length) * 20)
            : customerSatisfaction;

          const customerSatisfactionTrend = prevCustomerSatisfaction > 0 
            ? Math.round(((customerSatisfaction - prevCustomerSatisfaction) / prevCustomerSatisfaction) * 100)
            : 0;

          return {
            success: true,
            openTickets,
            resolvedToday,
            avgResponseTime,
            customerSatisfaction,
            openTicketsTrend,
            resolvedTodayTrend,
            avgResponseTimeTrend,
            customerSatisfactionTrend
          };
        } catch (error) {
          console.error('Error fetching agent stats:', error);
          throw new Error(error.message || "Failed to fetch agent statistics");
        }
      }),

    
    getAgentTickets: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string(),
        status: this.trpc.z.enum(['open', 'in_progress', 'closed']).optional(),
        search: this.trpc.z.string().optional(),
        page: this.trpc.z.number().default(1),
        limit: this.trpc.z.number().default(10),
        sortBy: this.trpc.z.enum(['createdAt', 'updatedAt', 'priority_rate']).default('createdAt'),
        sortOrder: this.trpc.z.enum(['asc', 'desc']).default('desc'),
      }))
      .query(async ({ input }) => {
        try {
          const filter: any = {
            agentId: new Types.ObjectId(input.agentId)
          };
          
          
          if (input.status) {
            filter.status = input.status;
          }
          
          
          const skip = (input.page - 1) * input.limit;
          
          
          const sort: any = {};
          sort[input.sortBy] = input.sortOrder === 'asc' ? 1 : -1;
          
          
          let ticketsQuery = Ticket.find(filter);
          
          
          if (input.search && input.search.trim() !== '') {
            const searchRegex = new RegExp(input.search.trim(), 'i');
            ticketsQuery = ticketsQuery.or([
              { title: { $regex: searchRegex } },
              { content: { $regex: searchRegex } }
            ]);
          }
          
          
          const totalCount = await ticketsQuery.clone().countDocuments();
          
          
          const tickets = await ticketsQuery
            .sort(sort)
            .skip(skip)
            .limit(input.limit)
            .populate('customerId', 'name email image')
            .lean();
          
          
          const ticketIds = tickets.map((ticket: any) => ticket._id);
          const aiTickets = await AITicket.find({ 
            ticketId: { $in: ticketIds } 
          }).lean();
          
          const aiTicketsMap = new Map(
            aiTickets.map((aiTicket: any) => [aiTicket.ticketId.toString(), aiTicket])
          );
          
          
          const enhancedTickets = tickets.map((ticket: any) => {
            const ticketId = ticket._id.toString();
            const aiTicket = aiTicketsMap.get(ticketId) || null;
            
            return {
              ...ticket,
              aiTicket
            };
          });
          
          
          const totalPages = Math.ceil(totalCount / input.limit);
          
          return {
            success: true,
            tickets: enhancedTickets,
            pagination: {
              total: totalCount,
              pages: totalPages,
              page: input.page,
              limit: input.limit
            }
          };
        } catch (error) {
          console.error('Error fetching agent tickets:', error);
          throw new Error(error.message || "Failed to fetch agent tickets");
        }
      }),

    
    getTicketDetails: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const ticket = await Ticket.findById(input.ticketId)
            .populate('customerId', 'name email image')
            .populate('agentId', 'name email image')
            .populate('companyId', 'name');

          if (!ticket) {
            throw new Error('Ticket not found');
          }

          const [aiTicket, utilTicket] = await Promise.all([
            AITicket.findOne({ ticketId: ticket._id }),
            UtilTicket.findOne({ ticketId: ticket._id })
          ]);

          return {
            success: true,
            ticket: {
              ...ticket.toObject(),
              aiTicket: aiTicket ? aiTicket.toObject() : null,
              utilTicket: utilTicket ? utilTicket.toObject() : null
            }
          };
        } catch (error) {
          console.error('Error fetching ticket details:', error);
          throw new Error(error.message || "Failed to fetch ticket details");
        }      }),

    
    getAIResponse: this.trpc.procedure
      .input(this.trpc.z.object({
        query: this.trpc.z.string(),
        agentId: this.trpc.z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          
          const response = await this.pythonAIService.respondToAgent(
            input.query,
            input.agentId,
          );

          return {
            success: true,
            answer: response.answer,
            sources: response.sources || []
          };
        } catch (error) {
          console.error('Error getting AI response:', error);
          return {
            success: false,
            answer: 'Sorry, I encountered an error. Please try again later.',
            sources: []
          };
        }
      }),

    
    getTicketAIResponse: this.trpc.procedure
      .input(this.trpc.z.object({
        query: this.trpc.z.string(),
        ticketId: this.trpc.z.string(),
        agentId: this.trpc.z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          
          const ticket = await Ticket.findById(input.ticketId)
            .populate('customerId', 'name email')
            .populate('companyId', 'name');

          if (!ticket) {
            throw new Error('Ticket not found');
          }

          const aiTicket = await AITicket.findOne({ ticketId: ticket._id });

          
          const response = await this.pythonAIService.respondToAgentWithTicketContext(
            input.query,
            input.ticketId,
            input.agentId,
            ticket.toObject(),
            aiTicket ? aiTicket.toObject() : undefined
          );

          return {
            success: true,
            answer: response.answer,
            sources: response.sources || []
          };
        } catch (error) {
          console.error('Error getting ticket AI response:', error);
          return {
            success: false,
            answer: 'Sorry, I encountered an error processing this ticket information. Please try again later.',
            sources: []
          };
        }
      }),
      
    
    getCustomerHistory: this.trpc.procedure
      .input(this.trpc.z.object({
        customerId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const customer = await Customer.findById(input.customerId);
          
          if (!customer) {
            throw new Error('Customer not found');
          }
          
          
          const ticketHistory = await Ticket.find({
            customerId: new Types.ObjectId(input.customerId),
          })
          .select('_id title status createdAt updatedAt content')
          .sort({ createdAt: -1 })
          .limit(15);
          
          return {
            success: true,
            customer: {
              _id: customer._id,
              name: customer.name,
              email: customer.email
            },
            ticketHistory
          };
        } catch (error) {
          console.error('Error getting customer history:', error);
          throw new Error(error.message || 'Failed to fetch customer history');
        }
      }),
      
    
    getSimilarTickets: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const aiTicket = await AITicket.findOne({ 
            ticketId: new Types.ObjectId(input.ticketId) 
          });
          
          if (!aiTicket || !aiTicket.similar_ticketids || aiTicket.similar_ticketids.length === 0) {
            return {
              success: true,
              tickets: []
            };
          }
          
          
          const tickets = await Ticket.find({
            _id: { $in: aiTicket.similar_ticketids }
          })
          .select('_id title content status solution createdAt')
          .limit(10);
          
          return {
            success: true,
            tickets
          };        } catch (error) {
          console.error('Error getting similar tickets:', error);
          throw new Error(error.message || 'Failed to fetch similar tickets');
        }
      }),

    
    analyzeTicket: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string(),
        companyId: this.trpc.z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await this.pythonAIService.analyzeTicket(input.ticketId, input.companyId);
          
          return {
            success: true,
            analysis: result
          };
        } catch (error) {
          console.error('Error analyzing ticket:', error);
          return {
            success: false,
            error: error.message || 'Failed to analyze ticket'
          };
        }
      }),

    
    getTicketAnalysis: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const analysis = await this.pythonAIService.getTicketAnalysis(input.ticketId);
          
          return {
            success: true,
            analysis
          };
        } catch (error) {
          console.error('Error getting ticket analysis:', error);
          return {
            success: false,
            analysis: null,
            error: error.message || 'Failed to get ticket analysis'
          };
        }
      }),

    
     runPythonServiceDiagnostic: this.trpc.procedure
      .query(async () => {
        try {
          const diagnosticResults = await this.healthMonitorService.runDiagnosticCheck();
          return diagnosticResults;
        } catch (error) {
          return {
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date(),
            diagnosticDetails: {
              message: 'Diagnostic check failed',
              dbStatsAvailable: false
            }
          };
        }
      }),
      
    getPythonServicePerformance: this.trpc.procedure
      .input(this.trpc.z.object({
        minutes: this.trpc.z.number().min(1).max(1440).optional() 
      }))
      .query(({ input }) => {
        return this.healthMonitorService.getPerformanceMetrics(input?.minutes);
      }),
      
    getHistoricalHealthMetrics: this.trpc.procedure
      .input(this.trpc.z.object({
        days: this.trpc.z.number().min(1).max(30).optional() 
      }))
      .query(({ input }) => {
        return this.healthMonitorService.getHistoricalMetrics(input?.days);
      }),
      
    
    getDefaultAgent: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          
          const agent = await Agent.findOne({
            companyId: new Types.ObjectId(input.companyId)
          });
          
          if (!agent) {
            throw new Error("No agents found for company");
          }
          
          return {
            success: true,
            agent: {
              _id: agent._id,
              name: agent.name,
              email: agent.email
            }
          };
        } catch (error) {
          console.error('Error finding default agent:', error);
          throw new Error(error.message || "Failed to find a default agent");
        }
      }),
  });
}



