import { Controller, Post, Body } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AgentAssistService, MemoryEntry } from './agent-assist.service';
import { AgentQueryDto } from './dto/agent-query.dto';

@Controller('agent-assist')
export class AgentAssistController {
  constructor(private readonly svc: AgentAssistService) {}

  @Post('chat')
  async chat(@Body() dto: AgentQueryDto) {
    const sessionId = dto.sessionId?.trim() || uuidv4();
    const res = await this.svc.assist(dto.query, sessionId);
    return res;
  }

  @Post('clear-session')
  clear(@Body('sessionId') sid: string) {
    const ok = this.svc.clearSession(sid);
    return { success: ok };
  }

  @Post('get-conversation')
  summary(@Body('sessionId') sid: string): { sessionId: string; totalExchanges: number; conversation: MemoryEntry[] } {
    return this.svc.getSessionSummary(sid);
  }
}
