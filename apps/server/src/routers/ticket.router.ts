import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Ticket } from '../models/ticket.model';
import { AITicket } from '../models/AI_ticket.model';
import { UtilTicket } from '../models/util_ticket.model';
import { z } from 'zod';
import { Types } from 'mongoose';

const ticketFilters = z.object({
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(50).default(10),
  page: z.number().min(1).default(1),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority_rate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeAI: z.boolean().default(true),
  includeUtil: z.boolean().default(true)
});

@Injectable()
export class TicketRouter {
  constructor(private readonly trpc: TrpcService) {}

  private async findTicketsWithMeta(query: any, options: z.infer<typeof ticketFilters>) {
    const { limit, page, sortBy, sortOrder, includeAI, includeUtil, ...filters } = options;
    const skip = (page - 1) * limit;

    // Build date range query
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    // Execute main query with population
    const aggregateQuery: any[] = [
      { $match: query },
      { $sort: { [sortBy]: (sortOrder === 'desc' ? -1 : 1) as 1 | -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $lookup: {
          from: 'agents',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agent'
        }
      },
      {
        $lookup: {
          from: 'chats',
          localField: 'chatId',
          foreignField: '_id',
          as: 'chat'
        }
      }
    ];

    if (includeAI) {
      aggregateQuery.push({
        $lookup: {
          from: 'aitickets',
          localField: '_id',
          foreignField: 'ticketId',
          as: 'aiTicket'
        }
      });
    }

    if (includeUtil) {
      aggregateQuery.push({
        $lookup: {
          from: 'utiltickets',
          localField: '_id',
          foreignField: 'ticketId',
          as: 'utilTicket'
        }
      });
    }

    // Format output
    aggregateQuery.push({
      $project: {
        _id: 1,
        title: 1,
        content: 1,
        status: 1,
        attachment: 1,
        sender_role: 1,
        solution: 1,
        solution_attachment: 1,
        createdAt: 1,
        updatedAt: 1,
        customer: { $arrayElemAt: ['$customer', 0] },
        agent: { $arrayElemAt: ['$agent', 0] },
        chat: { $arrayElemAt: ['$chat', 0] },
        aiTicket: { $arrayElemAt: ['$aiTicket', 0] },
        utilTicket: { $arrayElemAt: ['$utilTicket', 0] }
      }
    });

    const [tickets, total] = await Promise.all([
      Ticket.aggregate(aggregateQuery),
      Ticket.countDocuments(query)
    ]);

    return {
      tickets,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    };
  }

  ticketRouter = this.trpc.router({
    createTicket: this.trpc.procedure
      .input(this.trpc.z.object({
        title: this.trpc.z.string().min(1),
        content: this.trpc.z.string().min(1),
        attachment: this.trpc.z.string().optional(),
        sender_role: this.trpc.z.enum(['customer', 'bot']),
        customerId: this.trpc.z.string(),
        agentId: this.trpc.z.string(),
        companyId: this.trpc.z.string(),
        chatId: this.trpc.z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const ticket = await Ticket.create({
            ...input,
            customerId: new Types.ObjectId(input.customerId),
            agentId: new Types.ObjectId(input.agentId),
            companyId: new Types.ObjectId(input.companyId),
            chatId: new Types.ObjectId(input.chatId)
          });

          return { success: true, ticket };
        } catch (error) {
          throw new Error(error.message || "Failed to create ticket");
        }
      }),

    // ... [Previous mutation endpoints remain the same] ...

    getTicketsByQuery: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string().optional(),
        agentId: this.trpc.z.string().optional(),
        customerId: this.trpc.z.string().optional(),
        ...ticketFilters.shape
      }))
      .query(async ({ input }) => {
        try {
          const query: any = {};
          
          // Build query based on provided IDs
          if (input.companyId) query.companyId = new Types.ObjectId(input.companyId);
          if (input.agentId) query.agentId = new Types.ObjectId(input.agentId);
          if (input.customerId) query.customerId = new Types.ObjectId(input.customerId);

          const result = await this.findTicketsWithMeta(query, input);
          return { success: true, ...result };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch tickets");
        }
      }),

    getTicketDetails: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const [ticket, aiTicket, utilTicket] = await Promise.all([
            Ticket.findById(input.ticketId)
              .populate('customerId', 'name email')
              .populate('agentId', 'name email')
              .populate('chatId'),
            AITicket.findOne({ ticketId: input.ticketId }),
            UtilTicket.findOne({ ticketId: input.ticketId })
          ]);

          if (!ticket) throw new Error("Ticket not found");

          return {
            success: true,
            ticket: {
              ...ticket.toObject(),
              aiTicket: aiTicket?.toObject() || null,
              utilTicket: utilTicket?.toObject() || null
            }
          };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch ticket details");
        }
      })
  });
}

export const { ticketRouter } = new TicketRouter(new TrpcService());