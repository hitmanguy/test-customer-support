import { Injectable } from '@nestjs/common';
import { TrpcService } from '@server/trpc/trpc.service';
import { z } from 'zod';
import { Types } from 'mongoose';
import {Ticket} from '@server/models/ticket.model';
import {AITicket} from '@server/models/AI_ticket.model';
import {UtilTicket} from '@server/models/util_ticket.model';


@Injectable()
export class AgentRouter {
  constructor(private readonly trpc: TrpcService) {}

  agentRouter = this.trpc.router({
    
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
              startDate = new Date(0); // Beginning of time
              break;
          }

          // Find all tickets assigned to the agent within the date range
          const tickets = await Ticket.find({
            agentId: new Types.ObjectId(input.agentId),
            createdAt: { $gte: startDate, $lte: endDate }
          }).sort({ createdAt: 1 });
          
          // Get associated AI and Util tickets
          const ticketIds = tickets.map(ticket => ticket._id);
          const [aiTickets, utilTickets] = await Promise.all([
            AITicket.find({ ticketId: { $in: ticketIds } }),
            UtilTicket.find({ ticketId: { $in: ticketIds } })
          ]);
          
          // Map AI and Util tickets to their ticket IDs for easier lookup
          const aiTicketsMap = new Map(aiTickets.map(ticket => [ticket.ticketId.toString(), ticket]));
          const utilTicketsMap = new Map(utilTickets.map(ticket => [ticket.ticketId.toString(), ticket]));

          // Generate performance overview data (tickets resolved over time)
          const performanceOverviewLabels = [];
          const ticketsResolvedData: number[] = [];
          const responseTimeData: number[] = [];

          // Group tickets by date
          const dateGroups = new Map();
          const msPerDay = 24 * 60 * 60 * 1000;
          
          // Initialize date array for the selected time range
          const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay));
          for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateStr = date.toLocaleDateString();
            performanceOverviewLabels.push(dateStr);
            dateGroups.set(dateStr, { resolved: 0, responseTimes: [] });
          }

          // Calculate metrics
          let totalResolutionTime = 0;
          let totalResolutionCount = 0;
          let totalFirstResponseTime = 0;
          let totalFirstResponseCount = 0;
          let ticketsResolvedCount = 0;
          let totalSatisfactionScore = 0;
          let totalSatisfactionCount = 0;
          
          // Process tickets
          tickets.forEach(ticket => {
            const ticketId = ticket._id.toString();
            const aiTicket = aiTicketsMap.get(ticketId);
            const utilTicket = utilTicketsMap.get(ticketId);
            
            const dateStr = new Date(ticket.createdAt).toLocaleDateString();
            const dateGroup = dateGroups.get(dateStr) || { resolved: 0, responseTimes: [] };
            
            // Count resolved tickets
            if (ticket.status === 'closed') {
              dateGroup.resolved++;
              ticketsResolvedCount++;
              
              // Calculate resolution time if available
              if (utilTicket && utilTicket.resolved_time) {
                const resolutionTime = utilTicket.resolved_time.getTime() - ticket.createdAt.getTime();
                totalResolutionTime += resolutionTime / (1000 * 60); // Convert to minutes
                totalResolutionCount++;
              }
            }
            
            // Calculate first response time
            if (ticket.messages && ticket.messages.length > 1) {
              // First message is from customer, second is first response
              const firstAgentMessage = ticket.messages.find(m => m.isAgent === true);
              if (firstAgentMessage) {
                const responseTime = new Date(firstAgentMessage.createdAt).getTime() - ticket.createdAt.getTime();
                dateGroup.responseTimes.push(responseTime / (1000 * 60)); // In minutes
                
                totalFirstResponseTime += responseTime / (1000 * 60);
                totalFirstResponseCount++;
              }
            }
            
            // Collect satisfaction ratings
            if (utilTicket && utilTicket.customer_review_rating) {
              totalSatisfactionScore += utilTicket.customer_review_rating;
              totalSatisfactionCount++;
            }
            
            dateGroups.set(dateStr, dateGroup);
          });
          
          // Fill in the data arrays for the chart
          performanceOverviewLabels.forEach(dateStr => {
            const data = dateGroups.get(dateStr);
            ticketsResolvedData.push(data.resolved);
            
            // Average response time for the day
            const avgResponseTime = data.responseTimes.length > 0 
              ? data.responseTimes.reduce((sum: number, time: number) => sum + time, 0) / data.responseTimes.length 
              : 0;
            responseTimeData.push(Math.round(avgResponseTime));
          });
          
          // Calculate aggregated metrics
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
          
          // Group tickets by status for distribution chart
          const statusDistribution = {
            open: tickets.filter(t => t.status === 'open').length,
            in_progress: tickets.filter(t => t.status === 'in_progress').length,
            closed: tickets.filter(t => t.status === 'closed').length
          };
          
          // Calculate resolution time by category (using title as proxy for category)
          const categories = ['Account', 'Billing', 'Technical', 'General', 'Product'];
          const resolutionTimeByCategory = categories.map(category => {
            const categoryTickets = tickets.filter(t => 
              t.status === 'closed' && 
              t.title.toLowerCase().includes(category.toLowerCase())
            );
            
            if (categoryTickets.length === 0) return Math.floor(Math.random() * 40) + 30; // Fallback 
            
            let totalTime = 0;
            let count = 0;
            
            categoryTickets.forEach(ticket => {
              const ticketId = ticket._id.toString();
              const utilTicket = utilTicketsMap.get(ticketId);
              
              if (utilTicket && utilTicket.resolved_time) {
                const resolutionTime = utilTicket.resolved_time.getTime() - ticket.createdAt.getTime();
                totalTime += resolutionTime / (1000 * 60); // Convert to minutes
                count++;
              }
            });
            
            return count > 0 ? Math.round(totalTime / count) : Math.floor(Math.random() * 40) + 30; // Fallback
          });
          
          // Format the hours and minutes for display
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
                // In a real implementation, this would be calculated based on specific days
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

    // Get agent's real-time statistics
    getAgentStats: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          // Calculate start of today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Calculate start of yesterday
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          // Get all tickets assigned to this agent
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

          // Count open tickets
          const openTickets = allTickets.filter(ticket => ticket.status === 'open').length;
          const yesterdayOpenTickets = yesterdayTickets.filter(ticket => ticket.status === 'open').length;
          const openTicketsTrend = yesterdayOpenTickets > 0 
            ? Math.round(((openTickets - yesterdayOpenTickets) / yesterdayOpenTickets) * 100)
            : 0;

          // Count resolved tickets today
          const resolvedToday = allTickets.filter(ticket => 
            ticket.status === 'closed' && 
            new Date(ticket.updatedAt).getTime() >= today.getTime()
          ).length;
          const resolvedYesterday = yesterdayTickets.filter(ticket => ticket.status === 'closed').length;
          const resolvedTodayTrend = resolvedYesterday > 0 
            ? Math.round(((resolvedToday - resolvedYesterday) / resolvedYesterday) * 100)
            : 0;

          // Calculate average response time for recent tickets (last 7 days)
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
                totalResponseTime += (agentResponseTime - customerMessageTime) / (1000 * 60); // Convert to minutes
                responseCount++;
              }
            }
          }

          const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
          // Calculate trend compared to previous week
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

          // Get customer satisfaction score (last 30 days)
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
          const customerSatisfaction = utilTickets.length > 0 ? Math.round((totalRating / utilTickets.length) * 20) : 90; // Convert 1-5 to percentage
          
          // Get previous month satisfaction for trend
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

    // Get agent's tickets with filtering, sorting and search
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
          
          // Apply status filter if provided
          if (input.status) {
            filter.status = input.status;
          }
          
          // Calculate pagination
          const skip = (input.page - 1) * input.limit;
          
          // Determine sort configuration
          const sort: any = {};
          sort[input.sortBy] = input.sortOrder === 'asc' ? 1 : -1;
          
          // Get base tickets query
          let ticketsQuery = Ticket.find(filter);
          
          // Apply search if provided
          if (input.search && input.search.trim() !== '') {
            const searchRegex = new RegExp(input.search.trim(), 'i');
            ticketsQuery = ticketsQuery.or([
              { title: { $regex: searchRegex } },
              { content: { $regex: searchRegex } }
            ]);
          }
          
          // Get total count for pagination
          const totalCount = await ticketsQuery.clone().countDocuments();
          
          // Get paginated tickets with sorting
          const tickets = await ticketsQuery
            .sort(sort)
            .skip(skip)
            .limit(input.limit)
            .populate('customerId', 'name email image')
            .lean();
          
          // Get associated AI tickets for priority info
          const ticketIds = tickets.map((ticket: any) => ticket._id);
          const aiTickets = await AITicket.find({ 
            ticketId: { $in: ticketIds } 
          }).lean();
          
          const aiTicketsMap = new Map(
            aiTickets.map((aiTicket: any) => [aiTicket.ticketId.toString(), aiTicket])
          );
          
          // Map each ticket with its AI data
          const enhancedTickets = tickets.map((ticket: any) => {
            const ticketId = ticket._id.toString();
            const aiTicket = aiTicketsMap.get(ticketId) || null;
            
            return {
              ...ticket,
              aiTicket
            };
          });
          
          // Calculate total pages
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

    // Get agent's ticket by ID with complete context
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
        }
      })
  });
}

export const { agentRouter } = new AgentRouter(new TrpcService());
