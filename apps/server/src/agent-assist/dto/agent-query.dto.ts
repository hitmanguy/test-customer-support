import { IsString, IsOptional } from 'class-validator';

export class AgentQueryDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
