import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { A_Chat } from '@server/models/a_chat.model';
import { Types } from 'mongoose';
import { z } from 'zod';


const messageSchema = z.object({
  role: z.enum(['agent', 'bot']),
  content: z.string().min(1),
  attachment: z.string().optional()
});

@Injectable()
export class A_ChatRouter {
  constructor(private readonly trpc: TrpcService) {}

  a_chatRouter = this.trpc.router({

    startChat: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string(),
        initialMessage: messageSchema
      }))
      .mutation(async ({ input }) => {
        try {
          const chat = await A_Chat.create({
            agentId: new Types.ObjectId(input.agentId),
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

    addMessage: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string(),
        message: messageSchema
      }))
      .mutation(async ({ input }) => {
        try {
          const chat = await A_Chat.findByIdAndUpdate(
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
          ).populate('agentId', 'name email');

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

    getChatHistory: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          const chat = await A_Chat.findById(input.chatId)
            .populate('agentId', 'name email');

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

    getAgentChats: this.trpc.procedure
      .input(this.trpc.z.object({
        agentId: this.trpc.z.string(),
        limit: this.trpc.z.number().min(1).max(50).default(10),
        page: this.trpc.z.number().min(1).default(1)
      }))
      .query(async ({ input }) => {
        try {
          const skip = (input.page - 1) * input.limit;

          const [chats, total] = await Promise.all([
            A_Chat.find({ agentId: new Types.ObjectId(input.agentId) })
              .sort({ updatedAt: -1 })
              .skip(skip)
              .limit(input.limit)
              .populate('agentId', 'name email'),
            A_Chat.countDocuments({ agentId: new Types.ObjectId(input.agentId) })
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

    // searchChats: this.trpc.procedure
    //   .input(this.trpc.z.object({
    //     agentId: this.trpc.z.string(),
    //     query: this.trpc.z.string().min(1)
    //   }))
    //   .query(async ({ input }) => {
    //     try {
    //       const chats = await A_Chat.find({
    //         agentId: new Types.ObjectId(input.agentId),
    //         'contents.content': { 
    //           $regex: input.query, 
    //           $options: 'i' 
    //         }
    //       }).populate('agentId', 'name email');

    //       return {
    //         success: true,
    //         chats: chats.map(chat => ({
    //           ...chat.toObject(),
    //           contents: chat.contents.filter(msg =>
    //             msg.content.toLowerCase().includes(input.query.toLowerCase())
    //           )
    //         }))
    //       };
    //     } catch (error) {
    //       throw new Error(error.message || "Failed to search chats");
    //     }
    //   }),

    deleteChat: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          const chat = await A_Chat.findByIdAndDelete(input.chatId);

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

export const { a_chatRouter } = new A_ChatRouter(new TrpcService());