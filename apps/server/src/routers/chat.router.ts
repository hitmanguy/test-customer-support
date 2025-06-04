import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Chat } from '../models/Chat.model';
import { Company } from '../models/Company.model';
import { Ticket } from '../models/ticket.model';
import { Agent } from '../models/Agent.model';
import { PythonAIService } from '../services/python-ai.service';
import { AIResponse } from '../types/ai-types';
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
  constructor(
    private readonly trpc: TrpcService,
    private readonly pythonAIService: PythonAIService
  ) {}

  chatRouter = this.trpc.router({
    // Initialize a new chat session
    startChat: this.trpc.procedure
      .input(this.trpc.z.object({
        customerId: this.trpc.z.string(),
        companyId: this.trpc.z.string(),

      }))
      .mutation(async ({ input }) => {
        try {
        const chat = await Chat.findOne({
          customerId: new Types.ObjectId(input.customerId),
          companyId: new Types.ObjectId(input.companyId),
        })
        .sort({ updatedAt: -1 })
        .populate('customerId', 'name email');

        if(!chat){
          const chat = await Chat.create({
            customerId: new Types.ObjectId(input.customerId),
            companyId: new Types.ObjectId(input.companyId),
          });

          return {
            success: true,
            chat
          };
        }

        return {
          success: true,
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
          // Check if chatId is empty
          if (!input.chatId || input.chatId.trim() === '') {
            throw new Error("Chat ID is required");
          }

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
      }),// AI-powered chat message with intelligent responses
    addAIMessage: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string().optional(),
        customerId: this.trpc.z.string(),
        companyId: this.trpc.z.string(),
        message: this.trpc.z.string().min(1),
        attachment: this.trpc.z.string().optional()
      }))
      .mutation(async ({ input }) => {
        try {
          console.log(`[AI MESSAGE] Processing AI message request for customer ${input.customerId}, company ${input.companyId}`);
          console.log(`[AI MESSAGE] Chat ID provided: ${input.chatId || 'none'}`);
          
          // Validate ObjectId format to prevent MongoDB errors
          if (input.chatId && !Types.ObjectId.isValid(input.chatId)) {
            throw new Error("Invalid chat ID format");
          }
          if (!Types.ObjectId.isValid(input.customerId)) {
            throw new Error("Invalid customer ID format");
          }
          if (!Types.ObjectId.isValid(input.companyId)) {
            throw new Error("Invalid company ID format");
          }
          // Get company details for context
          const company = await Company.findById(input.companyId);
          const companyName = company?.name || 'our company';

          let chat;

          // If no chatId or empty chatId, find existing chat or create new one
          if (!input.chatId || input.chatId.trim() === '') {
            // Try to find existing chat
            chat = await Chat.findOne({
              customerId: new Types.ObjectId(input.customerId),
              companyId: new Types.ObjectId(input.companyId),
            }).sort({ updatedAt: -1 });

            // If no existing chat, create new one
            if (!chat) {
              chat = await Chat.create({
                customerId: new Types.ObjectId(input.customerId),
                companyId: new Types.ObjectId(input.companyId),
                contents: []
              });
            }
          } else {
            // Use provided chatId
            chat = await Chat.findById(input.chatId);
            if (!chat) {
              throw new Error("Chat not found");
            }
          }

          // Add customer message to chat
          const chatWithCustomerMessage = await Chat.findByIdAndUpdate(
            chat._id,
            {
              $push: {
                contents: {
                  role: 'customer',
                  content: input.message,
                  attachment: input.attachment,
                  createdAt: new Date()
                }
              }
            },
            { new: true }
          ).populate('customerId', 'name email');

          if (!chatWithCustomerMessage) {
            throw new Error("Failed to add customer message");
          }          // Generate AI response
          const sessionId = `${input.customerId}-${input.companyId}`;
          const aiResponse = await this.pythonAIService.respondToCustomer(
            input.message,
            sessionId,
            input.companyId,
            companyName
          );
            let ticketId = aiResponse.ticketId;
            // Create a ticket if AI suggests it, no ticketId exists yet, and we have a valid chat
          if (aiResponse.shouldCreateTicket && !ticketId && chat._id) {
            try {
              console.log(`[TICKET CREATION] AI suggested creating a ticket for chat ${chat._id}`);
              console.log(`[TICKET CREATION] Current ticketId value: ${ticketId}`);
              console.log(`[TICKET CREATION] aiResponse.shouldCreateTicket: ${aiResponse.shouldCreateTicket}`);
              
              // First check if a ticket already exists for this chat to prevent duplicates
              const existingTicket = await Ticket.findOne({ chatId: chat._id });
              
              if (existingTicket) {
                // Use the existing ticket instead of creating a new one
                console.log(`[TICKET CREATION] Found existing ticket ${existingTicket._id} for chat ${chat._id}`);
                console.log(`[TICKET CREATION] Using existing ticket instead of creating a new one`);
                ticketId = existingTicket._id.toString();
              } else {
                // Find a default agent for this company
                console.log(`[TICKET CREATION] No existing ticket found for chat ${chat._id}, creating new ticket`);
                const agent = await Agent.findOne({
                  companyId: new Types.ObjectId(input.companyId)
                });
                
                if (agent) {
                  console.log(`[TICKET CREATION] Found agent ${agent._id} for company ${input.companyId}`);
                  // Create a ticket linked to this chat
                  const ticketData = {
                    title: aiResponse.ticketTitle || `Support ticket from chat`,
                    content: aiResponse.ticketContent || input.message,
                    customerId: new Types.ObjectId(input.customerId),
                    agentId: agent._id,
                    companyId: new Types.ObjectId(input.companyId),
                    chatId: chat._id, // MongoDB reference
                    sender_role: 'customer',
                    status: 'open'
                  };
                  
                  console.log(`[TICKET CREATION] Creating ticket with data:`, JSON.stringify(ticketData, null, 2));
                  const ticket = await Ticket.create(ticketData);
                  
                  if (ticket) {
                    ticketId = ticket._id.toString();
                    console.log(`[TICKET CREATION] Successfully created ticket ${ticketId} from chat ${chat._id}`);
                  } else {
                    console.log(`[TICKET CREATION] Failed to create ticket, returned null/undefined`);
                  }
                } else {
                  console.log(`[TICKET CREATION] No agent found for company ${input.companyId}`);
                }
              }
            } catch (error) {
              console.error('[TICKET CREATION] Failed to create ticket from chat:', error);
            }
          } else {
            console.log(`[TICKET CREATION] Skipping ticket creation:`, {
              shouldCreateTicket: aiResponse.shouldCreateTicket,
              hasTicketId: !!ticketId,
              hasChatId: !!chat._id
            });
          }
            // Prepare structured metadata for the AI response
          const responseMetadata = {
            sources: Array.isArray(aiResponse.sources) ? aiResponse.sources : [],
            shouldCreateTicket: !!aiResponse.shouldCreateTicket,
            ticketId: ticketId || null
          };
          
          console.log(`[AI RESPONSE] Adding AI response to chat with metadata:`, JSON.stringify(responseMetadata, null, 2));
          
          // Add AI response to chat
          const finalChat = await Chat.findByIdAndUpdate(
            chat._id,
            {
              $push: {
                contents: {
                  role: 'bot',
                  content: aiResponse.answer,
                  metadata: responseMetadata,
                  createdAt: new Date()
                }
              }
            },
            { new: true }
          ).populate('customerId', 'name email');
          
          console.log(`[AI RESPONSE] AI response added to chat ${chat._id}`);
          
          return {
            success: true,
            chat: finalChat,
            aiResponse: {
              answer: aiResponse.answer,
              sources: aiResponse.sources || [],
              shouldCreateTicket: !!aiResponse.shouldCreateTicket,
              ticketId: ticketId // Use our potentially updated ticketId
            }
          };
        } catch (error) {
          console.error('AI Chat Error:', error);
          throw new Error(error.message || "Failed to process AI message");
        }      }),

    // Test AI functionality - can be removed in production 
       testAI: this.trpc.procedure
      .input(this.trpc.z.object({
        query: this.trpc.z.string().min(1),
        companyId: this.trpc.z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const sessionId = `test-${Date.now()}`;
          const response = await this.pythonAIService.respondToCustomer(
            input.query,
            sessionId,
            input.companyId,
            'Test Company'
          );

          return {
            success: true,
            response
          };
        } catch (error) {
          console.error('AI Test Error:', error);
          throw new Error(error.message || "Failed to test AI");
        }      }),    
        // Get chat history for a specific chat
    getChatHistory: this.trpc.procedure
      .input(this.trpc.z.object({
        chatId: this.trpc.z.string()
      }))
      .query(async ({ input }) => {
        try {
          console.log(`[CHAT HISTORY] Fetching chat history for chatId: "${input.chatId}"`);
          
          // Check for empty chatId or invalid ObjectId format
          if (!input.chatId || input.chatId.trim() === '') {
            console.log('[CHAT HISTORY] Empty chatId provided');
            return {
              success: false,
              error: "Chat ID is required",
              chat: null
            };
          }
          
          // Validate ObjectId format to avoid Mongoose errors
          if (!Types.ObjectId.isValid(input.chatId)) {
            console.log(`[CHAT HISTORY] Invalid ObjectId format: "${input.chatId}"`);
            return {
              success: false,
              error: `Invalid chat ID format: "${input.chatId}"`,
              chat: null
            };
          }
          
          console.log(`[CHAT HISTORY] Fetching chat with ID: ${input.chatId}`);
          const chat = await Chat.findById(input.chatId)
            .populate('customerId', 'name email');

          if (!chat) {
            console.log(`[CHAT HISTORY] Chat not found for ID: ${input.chatId}`);
            return {
              success: false,
              error: `Chat not found for ID: ${input.chatId}`,
              chat: null
            };
          }
          
          // Validate chat contents structure
          if (!Array.isArray(chat.contents)) {
            console.error(`[CHAT HISTORY] Invalid contents structure for chat ${input.chatId}`);
            return {
              success: false,
              error: "Chat data structure is invalid",
              chat: null
            };
          }
          
          console.log(`[CHAT HISTORY] Successfully found chat with ${chat.contents?.length || 0} messages`);
          
          // Ensure consistent data structure even if some messages are malformed
          const sanitizedChat = {
            ...chat.toObject(),
            contents: chat.contents.map(msg => ({
              role: msg.role || 'unknown',
              content: msg.content || '',
              createdAt: msg.createdAt || new Date(),
              attachment: msg.attachment || undefined,
              metadata: msg.metadata || undefined
            }))
          };
          
          return {
            success: true,
            chat: sanitizedChat
          };
        } catch (error) {
          console.error("Error fetching chat history:", error);
          return {
            success: false,
            error: error.message || "Failed to fetch chat history",
            chat: null
          };
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
      }),  });
}

// Export the class for dependency injection
// The router instance will be injected and created by NestJS