import { createRouter } from "@server/trpc/trpc.service";
import { ChatMessage } from "../models/chatMessage.model";

export const chatRouter = createRouter((trpc) =>
  trpc.router({
    sendMessage: trpc.procedure
      .input(trpc.z.object({
        ticketId: trpc.z.string(),
        senderId: trpc.z.string(),
        message: trpc.z.string(),
        senderRole: trpc.z.enum(['customer', 'agent', 'bot']),
      }))
      .mutation(async ({ input }) => {
        const chatMsg = await ChatMessage.create({
          ticketId: input.ticketId,
          senderId: input.senderId,
          message: input.message,
          senderRole: input.senderRole,
        });
        return { success: true, messageId: chatMsg._id.toString() };
      }),
    getMessages: trpc.procedure
      .input(trpc.z.object({ ticketId: trpc.z.string() }))
      .query(async ({ input }) => {
        const messages = await ChatMessage.find({ ticketId: input.ticketId }).sort({ createdAt: 1 });
        return { messages };
      }),
  })
);