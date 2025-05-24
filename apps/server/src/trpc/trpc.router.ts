import { INestApplication, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '@server/trpc/trpc.service';
import * as trpcExpress from '@trpc/server/adapters/express';

import {authRouter} from '@server/routers/auth.router';
import { chatRouter } from '@server/routers/chat.router';
import { kbRouter } from '@server/routers/kb.router';
import { ticketRouter } from '@server/routers/ticket.router';
import { utilsRouter } from '@server/routers/utils.router';
import { a_chatRouter } from '@server/routers/a_chat.router';

@Injectable()
export class TrpcRouter {
  constructor(private readonly trpc: TrpcService) {}

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
      }),
      auth: authRouter,
      chat: chatRouter,
      kb: kbRouter,
      ticket: ticketRouter,
      utils: utilsRouter,
      a_chat: a_chatRouter,
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

