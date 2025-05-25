import { Controller, Post, Body, Get } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AnalyzeTicketDto } from './dto/analyze-ticket.dto';
import { ResolvedTicketDto } from './dto/resolved-ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private svc: TicketsService) {}

  @Post('analyze')
  analyze(@Body() dto: AnalyzeTicketDto) {
    return this.svc.analyze(dto);
  }

  @Post('resolved')
  resolved(@Body() dto: ResolvedTicketDto) {
    return this.svc.addResolved(dto);
  }

  @Get('stats')
  stats() {
    return this.svc.stats();
  }
}
