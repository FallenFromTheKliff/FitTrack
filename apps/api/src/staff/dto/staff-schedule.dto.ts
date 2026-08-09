import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { IsOnOrAfter, TrimString } from '../../common/validators';

export enum CreateStaffInitialPaymentStage {
  downpayment = 'downpayment',
  full = 'full',
}

export class CreateStaffVenueBookingDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiProperty({
    example: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
    description:
      'Database venue ID. Standard and deterministic UUID versions are supported.',
  })
  @IsUUID('all', { message: 'amenity_id must be a valid UUID' })
  amenity_id: string;

  @ApiPropertyOptional({
    example: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
  })
  @IsOptional()
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id?: string;

  @ApiProperty({ example: '2026-05-03T10:00:00.000Z' })
  @IsISO8601({}, { message: 'starts_at must be a valid ISO 8601 date string' })
  starts_at: string;

  @ApiProperty({ example: '2026-05-03T11:00:00.000Z' })
  @IsISO8601({}, { message: 'ends_at must be a valid ISO 8601 date string' })
  @IsOnOrAfter('starts_at', 'starts_at', {
    message: 'ends_at must be on or after starts_at',
  })
  ends_at: string;

  @ApiPropertyOptional({ example: 'Front desk manual venue booking.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    enum: CreateStaffInitialPaymentStage,
    example: CreateStaffInitialPaymentStage.full,
    description:
      'Cashier/admin/staff facility bookings record full cash payment. The legacy downpayment value is rejected by the booking service.',
  })
  @IsOptional()
  @IsEnum(CreateStaffInitialPaymentStage, {
    message: `payment_stage must be one of: ${Object.values(CreateStaffInitialPaymentStage).join(', ')}`,
  })
  payment_stage?: CreateStaffInitialPaymentStage;
}

export class CreateStaffCoachBookingDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiProperty({ example: '2026-05-03T10:00:00.000Z' })
  @IsISO8601(
    {},
    { message: 'scheduled_at must be a valid ISO 8601 date string' },
  )
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt({ message: 'duration_minutes must be an integer' })
  @Min(30, { message: 'duration_minutes must be at least 30' })
  @Max(180, { message: 'duration_minutes must not exceed 180' })
  duration_minutes: number;

  @ApiPropertyOptional({ example: 'Front desk manual coach session.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'member_notes must be a string' })
  @MaxLength(500, { message: 'member_notes must not exceed 500 characters' })
  member_notes?: string;

  @ApiPropertyOptional({
    enum: CreateStaffInitialPaymentStage,
    example: CreateStaffInitialPaymentStage.full,
    description:
      'Cash payment stage recorded by staff at creation time. Defaults to full to preserve existing manual-booking behavior.',
  })
  @IsOptional()
  @IsEnum(CreateStaffInitialPaymentStage, {
    message: `payment_stage must be one of: ${Object.values(CreateStaffInitialPaymentStage).join(', ')}`,
  })
  payment_stage?: CreateStaffInitialPaymentStage;
}
