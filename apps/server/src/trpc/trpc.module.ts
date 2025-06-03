import { Module } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { TrpcRouter } from "./trpc.router";
import { ChatRouter } from "../routers/chat.router";
import { PythonAIModule } from "../modules/python-ai.module";

@Module({
    imports: [PythonAIModule],
    providers: [TrpcService, TrpcRouter, ChatRouter],
})

export class TrpcModule {}