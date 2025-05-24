import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { KB } from '../models/kb.model';
import { Types } from 'mongoose';
import { z } from 'zod';

// Validation schemas
const attachmentSchema = z.object({
  filename: z.string().min(1),
  url: z.string().url()
});

const kbEntrySchema = z.object({
  title: z.string().min(1),
  attachments: z.array(attachmentSchema)
});

@Injectable()
export class KBRouter {
  constructor(private readonly trpc: TrpcService) {}

  kbRouter = this.trpc.router({
    // Create initial KB for company
    createKB: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string(),
        knowledgeBases: this.trpc.z.array(kbEntrySchema)
      }))
      .mutation(async ({ input }) => {
        try {
          const existing = await KB.findOne({ 
            companyId: new Types.ObjectId(input.companyId) 
          });

          if (existing) {
            throw new Error("Knowledge base already exists for this company");
          }

          const kb = await KB.create({
            companyId: new Types.ObjectId(input.companyId),
            knowledgeBases: input.knowledgeBases
          });

          return { 
            success: true, 
            kb 
          };
        } catch (error) {
          throw new Error(error.message || "Failed to create knowledge base");
        }
      }),

    addKBEntry: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string(),
        entry: kbEntrySchema
      }))
      .mutation(async ({ input }) => {
        try {
          const kb = await KB.findOneAndUpdate(
            { companyId: new Types.ObjectId(input.companyId) },
            { $push: { knowledgeBases: input.entry } },
            { new: true }
          );

          if (!kb) {
            throw new Error("Knowledge base not found");
          }

          return { 
            success: true, 
            kb 
          };
        } catch (error) {
          throw new Error(error.message || "Failed to add knowledge base entry");
        }
      }),

    // Delete KB entry
    deleteKBEntry: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string(),
        entryId: this.trpc.z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          const kb = await KB.findOneAndUpdate(
            { companyId: new Types.ObjectId(input.companyId) },
            { $pull: { knowledgeBases: { _id: new Types.ObjectId(input.entryId) } } },
            { new: true }
          );

          if (!kb) {
            throw new Error("Knowledge base not found");
          }

          return { 
            success: true, 
            kb 
          };
        } catch (error) {
          throw new Error(error.message || "Failed to delete knowledge base entry");
        }
      }),

    // Get company's KB
    getKB: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const kb = await KB.findOne({ 
            companyId: new Types.ObjectId(input.companyId) 
          });

          if (!kb) {
            throw new Error("Knowledge base not found");
          }

          return { 
            success: true, 
            kb 
          };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch knowledge base");
        }
      }),

    // Search KB entries
    searchKB: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string(),
        query: this.trpc.z.string().min(1)
      }))
      .query(async ({ input }) => {
        try {
          const kb = await KB.findOne({
            companyId: new Types.ObjectId(input.companyId),
            'knowledgeBases.title': { 
              $regex: input.query, 
              $options: 'i' 
            }
          });

          if (!kb) {
            return { 
              success: true, 
              results: [] 
            };
          }

          const filteredEntries = kb.knowledgeBases.filter(entry =>
            entry.title.toLowerCase().includes(input.query.toLowerCase())
          );

          return { 
            success: true, 
            results: filteredEntries 
          };
        } catch (error) {
          throw new Error(error.message || "Failed to search knowledge base");
        }
      })
  });
}

export const { kbRouter } = new KBRouter(new TrpcService());