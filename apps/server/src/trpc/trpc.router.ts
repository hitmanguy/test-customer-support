import { INestApplication, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '@server/trpc/trpc.service';
import * as trpcExpress from '@trpc/server/adapters/express';

import { authRouter } from '@server/routers/auth.router';
import { ChatRouter } from '@server/routers/chat.router';
import { ticketRouter } from '@server/routers/ticket.router';
import { utilsRouter } from '@server/routers/utils.router';
import { a_chatRouter } from '@server/routers/a_chat.router';
import { AgentRouter } from '@server/routers/agent.router';
import { debugRouter } from '@server/routers/debug.router';
import { CompanyDashboardRouter } from '@server/routers/company-dashboard.router';

@Injectable()
export class TrpcRouter {  constructor(
    private readonly trpc: TrpcService,
    private readonly chatRouter: ChatRouter,
    private readonly agentRouter: AgentRouter,
    private readonly companyDashboardRouter: CompanyDashboardRouter
  ) {}

  appRouter = this.trpc.mergeRouters(
  this.trpc
  .router({
    hello: this.trpc.procedure
      .input(
        z.object({
          name: z.string().optional(),
        }),
      )
      .query(({ input }) => {
        const { name } = input;
        return {
          greeting: `Hello ${name ? name : `Bilbo`}`,
        };
      }),      auth: authRouter,
      chat: this.chatRouter.chatRouter,
      ticket: ticketRouter,
      utils: utilsRouter,
      a_chat: a_chatRouter,
      agent: this.agentRouter.agentRouter,
      debug: debugRouter,
      companyDashboard: this.companyDashboardRouter.companyDashboardRouter,
  }));

  async applyMiddleware(app: INestApplication) {
    app.use(
      `/trpc`,
      trpcExpress.createExpressMiddleware({
        router: this.appRouter,
      }),
    );
  }
}

export type AppRouter = TrpcRouter[`appRouter`];

