import { IsString } from 'class-validator';

export class QualityAssessmentDto {
  @IsString() ticket_id: string;
}
