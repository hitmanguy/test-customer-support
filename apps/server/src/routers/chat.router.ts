import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Chat } from '../models/Chat.model';
import { Types } from 'mongoose';
import { z } from 'zod';

// Validation schemas
const messageSchema = z.object({
  role: z.enum(['customer', 'bot']),
  content: z.string().min(1),
  attachment: z.string().optional()
});

@Injectable()
export class ChatRouter {
  constructor(private readonly trpc: TrpcService) {}

  chatRouter = this.trpc.router({
    // Initialize a new chat session
    startChat: this.trpc.procedure
      .input(this.trpc.z.object({
        customerId: this.trpc.z.string(),
        companyId: this.trpc.z.string(),
        initialMessage: messageSchema
      }))
      .mutation(async ({ input }) => {
        try {
          const chat = await Chat.create({
            customerId: new Types.ObjectId(input.customerId),
            companyId: new Types.ObjectId(input.companyId),
            contents: [{
              ...input.initialMessage,
              createdAt: new Date()
            }]
          });

          return {
            success: true,
            chatId: chat._id,
            chat
          };
        } catch (error) {
          throw new Error(error.message || "Failed to start chat");
        }
      }),

        getLatestCompanyChat: this.trpc.procedure
    .input(this.trpc.z.object({
      customerId: this.trpc.z.string(),
      companyId: this.trpc.z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const chat = await Chat.findOne({
          customerId: new Types.ObjectId(input.customerId),
          companyId: new Types.ObjectId(input.companyId),
        })
        .sort({ updatedAt: -1 })
        .populate('customerId', 'name email');

        return {
          success: true,
          chat
        };
      } catch (error) {
        throw new Error(error.message || "Failed to fetch latest chat");
      }
    }),

    suggestTicketCreation: this.trpc.procedure
    .input(this.trpc.z.object({
      chatId: this.trpc.z.string(),
      title: this.trpc.z.string(),
      content: this.trpc.z.string(),
      customerId: this.trpc.z.string(),
      companyId: this.trpc.z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Add bot message suggesting ticket creation
        await Chat.findByIdAndUpdate(input.chatId, {
          $push: {
            contents: {
              role: 'bot',
              content: 'I suggest creating a support ticket for this issue. Would you like me to do that?',
              metadata: {
                type: 'ticket_suggestion',
                ticketData: {
                  title: input.title,
                  content: input.content,
                  customerId: input.customerId,
                  companyId: input.companyId,
                }
              },
              createdAt: new Date()
            }
              }
        });

        return { success: true };
      } catch (error) {
        throw new Error(error.message || "Failed to suggest ticket creation");
      }
    }),
    

    // Add a message to existing chat
    addMessage: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string(),
        message: messageSchema
      }))
      .mutation(async ({ input }) => {
        try {
          const chat = await Chat.findByIdAndUpdate(
            input.chatId,
            {
              $push: {
                contents: {
                  ...input.message,
                  createdAt: new Date()
                }
              }
            },
            { new: true }
          ).populate('customerId', 'name email');

          if (!chat) {
            throw new Error("Chat not found");
          }

          return {
            success: true,
            chat
          };
        } catch (error) {
          throw new Error(error.message || "Failed to add message");
        }
      }),

    // Get chat history for a specific chat
    getChatHistory: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const chat = await Chat.findById(input.chatId)
            .populate('customerId', 'name email');

          if (!chat) {
            throw new Error("Chat not found");
          }

          return {
            success: true,
            chat
          };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch chat history");
        }
      }),

    // Get all chats for a customer
    getCustomerChats: this.trpc.procedure
      .input(this.trpc.z.object({
        customerId: this.trpc.z.string(),
        limit: this.trpc.z.number().min(1).max(50).default(10),
        page: this.trpc.z.number().min(1).default(1)
      }))
      .query(async ({ input }) => {
        try {
          const skip = (input.page - 1) * input.limit;

          const [chats, total] = await Promise.all([
            Chat.find({ customerId: new Types.ObjectId(input.customerId) })
              .sort({ updatedAt: -1 })
              .skip(skip)
              .limit(input.limit)
              .populate('customerId', 'name email'),
            Chat.countDocuments({ customerId: new Types.ObjectId(input.customerId) })
          ]);

          return {
            success: true,
            chats,
            pagination: {
              total,
              pages: Math.ceil(total / input.limit),
              currentPage: input.page,
              perPage: input.limit
            }
          };
        } catch (error) {
          throw new Error(error.message || "Failed to fetch customer chats");
        }
      }),

    // Search within chat messages
    searchChats: this.trpc.procedure
      .input(this.trpc.z.object({
        customerId: this.trpc.z.string(),
        query: this.trpc.z.string().min(1)
      }))
      .query(async ({ input }) => {
        try {
          const chats = await Chat.find({
            customerId: new Types.ObjectId(input.customerId),
            'contents.content': { 
              $regex: input.query, 
              $options: 'i' 
            }
          }).populate('customerId', 'name email');

          return {
            success: true,
            chats: chats.map(chat => ({
              ...chat.toObject(),
              contents: chat.contents.filter(msg =>
                msg.content.toLowerCase().includes(input.query.toLowerCase())
              )
            }))
          };
        } catch (error) {
          throw new Error(error.message || "Failed to search chats");
        }
      }),

    // Delete a chat (soft delete option)
    deleteChat: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          const chat = await Chat.findByIdAndDelete(input.chatId);

          if (!chat) {
            throw new Error("Chat not found");
          }

          return {
            success: true,
            message: "Chat deleted successfully"
          };
        } catch (error) {
          throw new Error(error.message || "Failed to delete chat");
        }
      })
  });
}

export const { chatRouter } = new ChatRouter(new TrpcService());