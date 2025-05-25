import { IsString, IsOptional, IsDateString, IsArray } from 'class-validator';

export class PerformanceRequestDto {
  @IsOptional() @IsString() agent_id?: string;
  @IsString() company_id: string;
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
}
