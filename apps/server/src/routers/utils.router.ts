import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Customer } from '../models/Customer.model';
import { Agent } from '../models/Agent.model';
import { Company } from '../models/Company.model';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Ticket } from '@server/models/ticket.model';
import { UtilTicket } from '@server/models/util_ticket.model';

// Common validation schemas
const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

@Injectable()
export class UtilsRouter {
  constructor(private readonly trpc: TrpcService) {}

  private async paginateQuery(model: any, query: any, options: z.infer<typeof paginationSchema>) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;
    const sortOptions = sortBy ? { [sortBy]: sortOrder === 'desc' ? -1 : 1 } : { createdAt: -1 };

    const [items, total] = await Promise.all([
      model.find(query).sort(sortOptions).skip(skip).limit(limit),
      model.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    };
  }

  utilsRouter = this.trpc.router({
    // Customer Operations
    getCustomer: this.trpc.procedure
      .input(this.trpc.z.object({
        customerId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const customer = await Customer.findById(input.customerId);
          if (!customer) throw new Error("Customer not found");
          
          return { success: true, customer };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch customer");
        }
      }),

    getAllCustomers: this.trpc.procedure
      .input(this.trpc.z.object({
        ...paginationSchema.shape,
        verified: this.trpc.z.boolean().optional(),
        authType: this.trpc.z.enum(['local', 'google']).optional(),
      }))
      .query(async ({ input }) => {
        try {
          const query: any = {};
          if (typeof input.verified === 'boolean') query.verified = input.verified;
          if (input.authType) query.authType = input.authType;

          const result = await this.paginateQuery(Customer, query, input);
          return { success: true, ...result };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch customers");
        }
      }),

    // Agent Operations
    getAgent: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const agent = await Agent.findById(input.agentId)
            .populate('companyId', 'name email');
          if (!agent) throw new Error("Agent not found");
          
          return { success: true, agent };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch agent");
        }
      }),

    getCompanyAgents: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string(),
        ...paginationSchema.shape,
        verified: this.trpc.z.boolean().optional()
      }))
      .query(async ({ input }) => {
        try {
          const query: any = { companyId: new Types.ObjectId(input.companyId) };
          if (typeof input.verified === 'boolean') query.verified = input.verified;

          const result = await this.paginateQuery(Agent, query, input);
          return { success: true, ...result };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch company agents");
        }
      }),

    // Company Operations
    getCompany: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const company = await Company.findById(input.companyId);
          if (!company) throw new Error("Company not found");
          
          return { success: true, company };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch company");
        }
      }),

    getAllCompanies: this.trpc.procedure
      .input(this.trpc.z.object({
        ...paginationSchema.shape,
        verified: this.trpc.z.boolean().optional()
      }))
      .query(async ({ input }) => {
        try {
          const query: any = {};
          if (typeof input.verified === 'boolean') query.verified = input.verified;

          const result = await this.paginateQuery(Company, query, input);
          return { success: true, ...result };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch companies");
        }
      }),

    // Statistics Operations
    getCompanyStats: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const companyId = new Types.ObjectId(input.companyId);
          const [
            totalAgents,
            verifiedAgents,
            totalTickets,
            openTickets,
            resolvedTickets,
            avgRating
          ] = await Promise.all([
            Agent.countDocuments({ companyId }),
            Agent.countDocuments({ companyId, verified: true }),
            Ticket.countDocuments({ companyId }),
            Ticket.countDocuments({ companyId, status: 'open' }),
            Ticket.countDocuments({ companyId, status: 'closed' }),
            UtilTicket.aggregate([
              { $match: { companyId } },
              { $group: { 
                _id: null, 
                avgRating: { $avg: '$customer_review_rating' } 
              }}
            ])
          ]);

          return {
            success: true,
            stats: {
              agents: {
                total: totalAgents,
                verified: verifiedAgents
              },
              tickets: {
                total: totalTickets,
                open: openTickets,
                resolved: resolvedTickets
              },
              rating: avgRating[0]?.avgRating || 0
            }
          };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch company statistics");
        }
      }),

    // Search Operations
    searchUsers: this.trpc.procedure
      .input(this.trpc.z.object({
        query: this.trpc.z.string().min(2),
        type: this.trpc.z.enum(['customer', 'agent', 'company']),
        companyId: this.trpc.z.string().optional()
      }))
      .query(async ({ input }) => {
        try {
          const searchQuery: Record<string, any> = { 
            $or: [
              { name: { $regex: input.query, $options: 'i' } },
              { email: { $regex: input.query, $options: 'i' } }
            ] 
          };

          if (input.type === 'agent' && input.companyId) {
            searchQuery['companyId'] = new Types.ObjectId(input.companyId);
          }

          const Model = {
            customer: Customer,
            agent: Agent,
            company: Company
          }[input.type] as typeof Customer;

          const results = await Model.find(searchQuery).limit(10);
          return { success: true, results };
        } catch (error) {
          throw new Error(error.message || "Search failed");
        }
      })
  });
}

export const { utilsRouter } = new UtilsRouter(new TrpcService());