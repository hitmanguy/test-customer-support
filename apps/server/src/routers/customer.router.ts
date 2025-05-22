import { createRouter } from "@server/trpc/trpc.service";
import { User } from "../models/user.model";
import { Ticket } from "../models/ticket.model";

export const customerRouter = createRouter((trpc) =>
  trpc.router({
    getCustomerProfile: trpc.procedure
      .input(trpc.z.object({ customerId: trpc.z.string() }))
      .query(async ({ input }) => {
        const customer = await User.findById(input.customerId);
        if (!customer) throw new Error("Customer not found");
        return { customer };
      }),
    createTicket: trpc.procedure
      .input(trpc.z.object({
        customerId: trpc.z.string(),
        subject: trpc.z.string(),
        description: trpc.z.string(),
        companyId: trpc.z.string(),
      }))
      .mutation(async ({ input }) => {
        const ticket = await Ticket.create({
          customerId: input.customerId,
          subject: input.subject,
          description: input.description,
          companyId: input.companyId,
        });
        return { success: true, ticketId: ticket._id.toString() };
      }),
    listTickets: trpc.procedure
      .input(trpc.z.object({ customerId: trpc.z.string() }))
      .query(async ({ input }) => {
        const tickets = await Ticket.find({ customerId: input.customerId });
        return { tickets };
      }),
  })
);