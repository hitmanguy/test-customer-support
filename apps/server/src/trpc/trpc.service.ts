import { Injectable } from "@nestjs/common";
import {z} from 'zod';
import { initTRPC } from "@trpc/server";

@Injectable()
export class TrpcService {
    trpc = initTRPC.create();
    procedure = this.trpc.procedure;
    router = this.trpc.router;
    mergeRouters = this.trpc.mergeRouters;
    z = z;
}

export function createRouter(
  builder: (trpc: TrpcService) => ReturnType<TrpcService['router']>
) {
  const trpc = new TrpcService(); 
  return builder(trpc);
}