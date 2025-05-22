import { createRouter } from "@server/trpc/trpc.service";
import { Ticket } from "../models/ticket.model";
import { Comment } from "../models/comment.model";

export const ticketRouter = createRouter((trpc) =>
  trpc.router({
    getTicket: trpc.procedure
      .input(trpc.z.object({ ticketId: trpc.z.string() }))
      .query(async ({ input }) => {
        const ticket = await Ticket.findById(input.ticketId).populate('comments');
        if (!ticket) throw new Error("Ticket not found");
        return { ticket };
      }),
    addComment: trpc.procedure
      .input(trpc.z.object({
        ticketId: trpc.z.string(),
        authorId: trpc.z.string(),
        content: trpc.z.string(),
      }))
      .mutation(async ({ input }) => {
        const comment = await Comment.create({
          ticketId: input.ticketId,
          authorId: input.authorId,
          content: input.content,
        });
        await Ticket.findByIdAndUpdate(input.ticketId, {
          $push: { comments: comment._id },
        });
        return { success: true, commentId: comment._id.toString() };
      }),
    listTickets: trpc.procedure
      .input(trpc.z.object({ companyId: trpc.z.string() }))
      .query(async ({ input }) => {
        const tickets = await Ticket.find({ companyId: input.companyId });
        return { tickets };
      }),
  })
);