import { IsString, IsBoolean } from 'class-validator';

export class ResolvedTicketDto {
  @IsString() problem: string;
  @IsString() solution: string;
  @IsBoolean() agent_involvement: boolean;
}
