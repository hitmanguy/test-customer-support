import { createRouter } from "@server/trpc/trpc.service";
import { User } from "../models/user.model";
import { Ticket } from "../models/ticket.model";

export const agentRouter = createRouter((trpc) =>
  trpc.router({
    getAgentProfile: trpc.procedure
      .input(trpc.z.object({ agentId: trpc.z.string() }))
      .query(async ({ input }) => {
        const agent = await User.findById(input.agentId);
        if (!agent) throw new Error("Agent not found");
        return { agent };
      }),
    listAssignedTickets: trpc.procedure
      .input(trpc.z.object({ agentId: trpc.z.string() }))
      .query(async ({ input }) => {
        const tickets = await Ticket.find({ agentId: input.agentId });
        return { tickets };
      }),
    updateTicketStatus: trpc.procedure
      .input(trpc.z.object({
        ticketId: trpc.z.string(),
        status: trpc.z.enum(['open', 'pending', 'closed']),
      }))
      .mutation(async ({ input }) => {
        const ticket = await Ticket.findByIdAndUpdate(
          input.ticketId,
          { status: input.status },
          { new: true }
        );
        if (!ticket) throw new Error("Ticket not found");
        return { success: true };
      }),
  })
);