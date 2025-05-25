import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Ticket } from '../models/ticket.model';
import { AITicket } from '../models/AI_ticket.model';
import { UtilTicket } from '../models/util_ticket.model';
import { z } from 'zod';
import { Types } from 'mongoose';

const ticketStatus = z.enum(['open', 'in_progress', 'closed']);

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

  private async generateAISuggestions(content: string): Promise<string[]> {
    // This is a mock function - in production, you would call your AI service
    return [
      `Let me help you with that issue: ${content.slice(0, 50)}...`,
      'I understand your concern. Here\'s what we can do...',
      'Based on similar cases, I recommend...'
    ];
  }

  ticketRouter = this.trpc.router({
    createTicket: this.trpc.procedure
      .input(this.trpc.z.object({
        title: this.trpc.z.string(),
        content: this.trpc.z.string().min(1),
        attachment: this.trpc.z.string().optional(),
        sender_role: this.trpc.z.enum(['customer', 'bot']),
        customerId: this.trpc.z.string(),
        agentId: this.trpc.z.string(),
        companyId: this.trpc.z.string(),
        chatId: this.trpc.z.string().optional(),
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

  createAITicket: this.trpc.procedure
    .input(this.trpc.z.object({
      ticketId: this.trpc.z.string(),
      companyId: this.trpc.z.string(),
      priority_rate: this.trpc.z.number().min(1).max(5),
      predicted_solution: this.trpc.z.string(),
      predicted_solution_attachment: this.trpc.z.string().optional(),
      summarized_content: this.trpc.z.string(),
      similar_ticketids: this.trpc.z.array(this.trpc.z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Check if ticket exists
        const ticket = await Ticket.findById(input.ticketId);
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        // Create or update AI ticket
        const aiTicket = await AITicket.findOneAndUpdate(
          { ticketId: new Types.ObjectId(input.ticketId) },
          {
            $set: {
              companyId: new Types.ObjectId(input.companyId),
              priority_rate: input.priority_rate,
              predicted_solution: input.predicted_solution,
              predicted_solution_attachment: input.predicted_solution_attachment,
              summarized_content: input.summarized_content,
              similar_ticketids: input.similar_ticketids?.map(id => new Types.ObjectId(id)) || [],
            }
          },
          {
            new: true,
            upsert: true,
          }
        );

        return {
          success: true,
          aiTicket
        };
      } catch (error) {
        throw new Error(error.message || 'Failed to create AI ticket');
      }
    }),

  createUtilTicket: this.trpc.procedure
    .input(this.trpc.z.object({
      ticketId: this.trpc.z.string(),
      companyId: this.trpc.z.string(),
      seen_time: this.trpc.z.date().optional(),
      resolved_time: this.trpc.z.date().optional(),
      customer_review: this.trpc.z.string().optional(),
      customer_review_rating: this.trpc.z.number().min(1).max(5).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Check if ticket exists
        const ticket = await Ticket.findById(input.ticketId);
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        // Create or update util ticket
        const utilTicket = await UtilTicket.findOneAndUpdate(
          { ticketId: new Types.ObjectId(input.ticketId) },
          {
            $set: {
              companyId: new Types.ObjectId(input.companyId),
              seen_time: input.seen_time || null,
              resolved_time: input.resolved_time || null,
              customer_review: input.customer_review || null,
              customer_review_rating: input.customer_review_rating || null,
            }
          },
          {
            new: true,
            upsert: true,
          }
        );

        return {
          success: true,
          utilTicket
        };
      } catch (error) {
        throw new Error(error.message || 'Failed to create util ticket');
      }
    }),

  // Helper endpoint to update ticket status and times
  updateTicketStatus: this.trpc.procedure
    .input(this.trpc.z.object({
      ticketId: this.trpc.z.string(),
      status: ticketStatus,
    }))
    .mutation(async ({ input }) => {
      try {
        const ticket = await Ticket.findByIdAndUpdate(
          input.ticketId,
          { $set: { status: input.status } },
          { new: true }
        )
        .populate('customerId', 'name email image')
        .populate('agentId', 'name email image')
        .populate('chatId');

        if (!ticket) {
          throw new Error('Ticket not found');
        }

        // Update util ticket times if they exist
        if (input.status === 'in_progress') {
          await UtilTicket.findOneAndUpdate(
            { ticketId: new Types.ObjectId(input.ticketId) },
            { $set: { seen_time: new Date() } },
            { upsert: true }
          );
        } else if (input.status === 'closed') {
          await UtilTicket.findOneAndUpdate(
            { ticketId: new Types.ObjectId(input.ticketId) },
            { $set: { resolved_time: new Date() } },
            { upsert: true }
          );
        }

        return {
          success: true,
          ticket
        };
      } catch (error) {
        throw new Error(error.message || 'Failed to update ticket status');
      }
    }),

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

    submitReview: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string(),
        review: this.trpc.z.string().optional(),
        rating: this.trpc.z.number().min(1).max(5),
      }))
      .mutation(async ({ input }) => {
        try {
          const ticket = await Ticket.findById(input.ticketId);
          if (!ticket) {
            throw new Error('Ticket not found');
          }

          if (ticket.status !== 'closed') {
            throw new Error('Can only review closed tickets');
          }

          // Update or create UtilTicket
          const utilTicket = await UtilTicket.findOneAndUpdate(
            { ticketId: new Types.ObjectId(input.ticketId) },
            {
              $set: {
                customer_review: input.review || null,
                customer_review_rating: input.rating,
                companyId: ticket.companyId,
              }
            },
            {
              new: true,
              upsert: true,
            }
          );

          return {
            success: true,
            utilTicket
          };
        } catch (error) {
          throw new Error(error.message || 'Failed to submit review');
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
      }),

    addMessage: this.trpc.procedure
      .input(this.trpc.z.object({
        ticketId: this.trpc.z.string(),
        content: this.trpc.z.string(),
        attachment: this.trpc.z.string().optional(),
        isAgent: this.trpc.z.boolean(),
      }))
      .mutation(async ({ input }) => {
        try {
          const ticket = await Ticket.findByIdAndUpdate(
            input.ticketId,
            {
              $push: {
                messages: {
                  content: input.content,
                  attachment: input.attachment,
                  isAgent: input.isAgent,
                  createdAt: new Date(),
                }
              }
            },
            { new: true }
          )
          .populate('customerId', 'name email image')
          .populate('agentId', 'name email image')
          .populate('chatId');

          if (!ticket) {
            throw new Error('Ticket not found');
          }

          return {
            success: true,
            ticket
          };
        } catch (error) {
          throw new Error(error.message || 'Failed to add message');
        }
      }),

    getTicketById: this.trpc.procedure
      .input(this.trpc.z.object({
        id: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const [ticket, aiTicket, utilTicket] = await Promise.all([
            Ticket.findById(input.id)
              .populate('customerId', 'name email image')
              .populate('agentId', 'name email image')
              .populate('chatId'),
            AITicket.findOne({ ticketId: input.id }),
            UtilTicket.findOne({ ticketId: input.id })
          ]);

          if (!ticket) throw new Error("Ticket not found");

          const aiSuggestions = ticket.content
            ? await this.generateAISuggestions(ticket.content)
            : [];

          return {
            success: true,
            ticket: {
              ...ticket.toObject(),
              aiTicket: aiTicket?.toObject() || null,
              utilTicket: utilTicket?.toObject() || null,
              aiSuggestions
            }
          };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch ticket details");
        }
      }),

    })
 
}

export const { ticketRouter } = new TicketRouter(new TrpcService());