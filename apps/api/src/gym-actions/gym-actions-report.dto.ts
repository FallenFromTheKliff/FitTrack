import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const GYM_ACTION_REPORT_SECTIONS = [
  'recent',
  'transactions',
  'audit',
  'attendance',
] as const;

export type GymActionReportSection =
  (typeof GYM_ACTION_REPORT_SECTIONS)[number];

export class GymActionsReportRowDTO {
  @ApiProperty({ example: 'Maria Santos' })
  @IsString({ message: 'primary must be a string' })
  @MaxLength(240, { message: 'primary must not exceed 240 characters' })
  primary!: string;

  @ApiPropertyOptional({ example: 'QR check-in' })
  @IsOptional()
  @IsString({ message: 'secondary must be a string' })
  @MaxLength(240, { message: 'secondary must not exceed 240 characters' })
  secondary?: string;

  @ApiPropertyOptional({ example: 'Staff A' })
  @IsOptional()
  @IsString({ message: 'actor must be a string' })
  @MaxLength(160, { message: 'actor must not exceed 160 characters' })
  actor?: string;

  @ApiPropertyOptional({ example: 'Completed' })
  @IsOptional()
  @IsString({ message: 'status must be a string' })
  @MaxLength(80, { message: 'status must not exceed 80 characters' })
  status?: string;

  @ApiPropertyOptional({ example: 900 })
  @IsOptional()
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 },
    { message: 'amount must be a finite number with at most 2 decimals' },
  )
  @Min(-1000000000000, { message: 'amount is too small' })
  @Max(1000000000000, { message: 'amount is too large' })
  amount?: number;

  @ApiPropertyOptional({ example: '2026-08-28T10:00:00.000Z' })
  @IsOptional()
  @IsString({ message: 'occurred_at must be a string' })
  @MaxLength(80, { message: 'occurred_at must not exceed 80 characters' })
  occurred_at?: string;
}

export class GymActionsReportDTO {
  @ApiProperty({ enum: GYM_ACTION_REPORT_SECTIONS, example: 'attendance' })
  @IsIn(GYM_ACTION_REPORT_SECTIONS, {
    message: `section must be one of: ${GYM_ACTION_REPORT_SECTIONS.join(', ')}`,
  })
  section!: GymActionReportSection;

  @ApiProperty({ example: 'Attendance' })
  @IsString({ message: 'section_label must be a string' })
  @MaxLength(120, {
    message: 'section_label must not exceed 120 characters',
  })
  section_label!: string;

  @ApiProperty({ example: 'Gym Actions Report' })
  @IsString({ message: 'title must be a string' })
  @MaxLength(160, { message: 'title must not exceed 160 characters' })
  title!: string;

  @ApiPropertyOptional({
    example: ['Aug 1, 2026 - Aug 28, 2026', 'All check-in methods'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'filter_summaries must be an array' })
  @ArrayMaxSize(20, { message: 'filter_summaries must not exceed 20 items' })
  @IsString({ each: true, message: 'filter_summaries entries must be strings' })
  @MaxLength(200, {
    each: true,
    message: 'filter_summaries entries must not exceed 200 characters',
  })
  filter_summaries?: string[];

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt({ message: 'total_records must be an integer' })
  @Min(0, { message: 'total_records must not be negative' })
  @Max(1000000, { message: 'total_records must not exceed 1000000' })
  total_records!: number;

  @ApiProperty({ type: () => [GymActionsReportRowDTO] })
  @IsArray({ message: 'rows must be an array' })
  @ArrayMaxSize(5000, { message: 'rows must not exceed 5000 items' })
  @ValidateNested({ each: true })
  @Type(() => GymActionsReportRowDTO)
  rows!: GymActionsReportRowDTO[];
}
