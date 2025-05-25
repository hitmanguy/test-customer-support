import { IsString, IsArray } from 'class-validator';

export class AgentComparisonDto {
  @IsString() company_id: string;
  @IsArray() agent_ids: string[];
}
