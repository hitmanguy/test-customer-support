import { Module } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { TrpcRouter } from "./trpc.router";
import { ChatRouter } from "../routers/chat.router";
import { PythonAIModule } from "../modules/python-ai.module";
import { AgentRouter } from "../routers/agent.router";
import { HealthMonitorModule } from "../modules/health-monitor.module";
import { CompanyDashboardRouter } from "../routers/company-dashboard.router";
import { KnowledgeBaseService } from "../services/knowledge-base.service";
import { CompanyAnalyticsService } from "../services/company-analytics.service";

@Module({
    imports: [PythonAIModule, HealthMonitorModule],
    providers: [TrpcService, TrpcRouter, ChatRouter, AgentRouter, CompanyDashboardRouter, KnowledgeBaseService, CompanyAnalyticsService],
})

export class TrpcModule {}