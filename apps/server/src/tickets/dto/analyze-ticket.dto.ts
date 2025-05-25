import { IsString, IsArray } from 'class-validator';

export class AnalyzeTicketDto {
  @IsString() title: string;
  @IsString() description: string;
  @IsArray() chat_history: string[];
}
