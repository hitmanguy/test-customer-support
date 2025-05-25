import { Controller, Get, Post, Query, Body, Param } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceRequestDto } from './dto/performance-request.dto';
import { QualityAssessmentDto } from './dto/quality-assessment.dto';

@Controller('performance')
export class PerformanceController {
  constructor(private svc: PerformanceService) {}

  @Get('agent-performance/:agentId')
  agentPerf(
    @Param('agentId') agentId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.svc.getAgentPerformance(agentId, companyId);
  }

  @Post('quality-assessment')
  assess(@Body() dto: QualityAssessmentDto) {
    return this.svc.assessQuality(dto);
  }

  @Post('team-performance')
  team(@Body() dto: PerformanceRequestDto) {
    return this.svc.getTeamPerformance(dto);
  }

  @Post('coaching-insights')
  coach(@Body() dto: PerformanceRequestDto) {
    return this.svc.getCoachingInsights(dto);
  }
}
