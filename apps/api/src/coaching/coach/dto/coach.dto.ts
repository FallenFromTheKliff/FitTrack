import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CoachScheduleType } from '@prisma/client';

import { TrimString } from '../../../common/validators';
import { PaginationDTO } from '../../../user/dto/user-dto';

export class UpdateCoachProfileDTO {
  @ApiPropertyOptional({ example: 'Coach Mara Santos' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'display_name must be a string' })
  @MaxLength(160, {
    message: 'display_name must not exceed 160 characters',
  })
  display_name?: string;

  @ApiPropertyOptional({ example: 'coach.mara@fittrack.com' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'contact_email must be a string' })
  @MaxLength(255, {
    message: 'contact_email must not exceed 255 characters',
  })
  contact_email?: string | null;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'contact_phone must be a string' })
  @MaxLength(40, {
    message: 'contact_phone must not exceed 40 characters',
  })
  contact_phone?: string | null;

  @ApiPropertyOptional({ example: 'Strength and conditioning' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'specialization must be a string' })
  @MaxLength(255, {
    message: 'specialization must not exceed 255 characters',
  })
  specialization?: string;

  @ApiPropertyOptional({
    example: 'NASM-certified coach focused on athletic performance.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'bio must be a string' })
  @MaxLength(2000, { message: 'bio must not exceed 2000 characters' })
  bio?: string;

  @ApiPropertyOptional({ example: 'NASM-CPT' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'certification must be a string' })
  @MaxLength(255, {
    message: 'certification must not exceed 255 characters',
  })
  certification?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'hourly_rate must be a number' })
  @Min(0, { message: 'hourly_rate must be at least 0' })
  hourly_rate?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'gym_commission_pct must be a number' })
  @Min(0, { message: 'gym_commission_pct must be at least 0' })
  @Max(100, { message: 'gym_commission_pct must not exceed 100' })
  gym_commission_pct?: number;

  @ApiPropertyOptional({
    enum: CoachScheduleType,
    example: CoachScheduleType.part_time,
  })
  @IsOptional()
  @IsEnum(CoachScheduleType, {
    message: `schedule_type must be one of: ${Object.values(CoachScheduleType).join(', ')}`,
  })
  schedule_type?: CoachScheduleType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({
    message: 'is_available_for_booking must be a boolean value',
  })
  is_available_for_booking?: boolean;
}

export class CreateStandaloneCoachDTO {
  @ApiProperty({ example: 'Coach Mara Santos' })
  @TrimString()
  @IsString({ message: 'display_name must be a string' })
  @MaxLength(160, {
    message: 'display_name must not exceed 160 characters',
  })
  display_name: string;

  @ApiPropertyOptional({ example: 'coach.mara@fittrack.com' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'contact_email must be a string' })
  @MaxLength(255, {
    message: 'contact_email must not exceed 255 characters',
  })
  contact_email?: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'contact_phone must be a string' })
  @MaxLength(40, {
    message: 'contact_phone must not exceed 40 characters',
  })
  contact_phone?: string;

  @ApiPropertyOptional({ example: 'Strength and conditioning' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'specialization must be a string' })
  @MaxLength(255, {
    message: 'specialization must not exceed 255 characters',
  })
  specialization?: string;

  @ApiPropertyOptional({
    example: 'NASM-certified coach focused on athletic performance.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'bio must be a string' })
  @MaxLength(2000, { message: 'bio must not exceed 2000 characters' })
  bio?: string;

  @ApiPropertyOptional({ example: 'NASM-CPT' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'certification must be a string' })
  @MaxLength(255, {
    message: 'certification must not exceed 255 characters',
  })
  certification?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'hourly_rate must be a number' })
  @Min(0, { message: 'hourly_rate must be at least 0' })
  hourly_rate?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'gym_commission_pct must be a number' })
  @Min(0, { message: 'gym_commission_pct must be at least 0' })
  @Max(100, { message: 'gym_commission_pct must not exceed 100' })
  gym_commission_pct?: number;

  @ApiPropertyOptional({
    enum: CoachScheduleType,
    example: CoachScheduleType.part_time,
  })
  @IsOptional()
  @IsEnum(CoachScheduleType, {
    message: `schedule_type must be one of: ${Object.values(CoachScheduleType).join(', ')}`,
  })
  schedule_type?: CoachScheduleType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({
    message: 'is_available_for_booking must be a boolean value',
  })
  is_available_for_booking?: boolean;
}

export class CoachSelfUpdateProfileDTO {
  @ApiPropertyOptional({ example: 'Strength and conditioning' })
  specialization?: string;

  @ApiPropertyOptional({
    example: 'NASM-certified coach focused on athletic performance.',
  })
  bio?: string;

  @ApiPropertyOptional({ example: 'NASM-CPT' })
  certification?: string;

  @ApiPropertyOptional({ example: true })
  is_available_for_booking?: boolean;
}

export class CoachFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'boxing' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'specialization must be a string' })
  @MaxLength(255, {
    message: 'specialization must not exceed 255 characters',
  })
  specialization?: string;

  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'min_rating must be a number' })
  @Min(0, { message: 'min_rating must be at least 0' })
  @Max(5, { message: 'min_rating must not exceed 5' })
  min_rating?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'max_rate must be a number' })
  @Min(0, { message: 'max_rate must be at least 0' })
  max_rate?: number;
}

export class CoachUserProfileResponseDTO {
  @ApiPropertyOptional({ example: 'Maria', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Santos', nullable: true })
  last_name: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/avatars/maria-santos.png',
    nullable: true,
  })
  avatar_url: string | null;
}

export class CoachSelfUserResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  id: string;

  @ApiProperty({ type: CoachUserProfileResponseDTO })
  profile: CoachUserProfileResponseDTO;
}

export class CoachAvailabilitySlotResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 1 })
  day_of_week: number;

  @ApiProperty({ example: '08:00' })
  start_time: string;

  @ApiProperty({ example: '10:00' })
  end_time: string;
}

export class CoachPublicReviewResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({
    example: 'Clear cues and a good pace for a beginner session.',
    nullable: true,
  })
  comment: string | null;

  @ApiProperty({ example: 'Casey R.' })
  reviewer_name: string;

  @ApiProperty({ example: '2026-05-17T08:30:00.000Z' })
  created_at: string;
}

export class CoachListItemResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  id: string;

  @ApiPropertyOptional({ example: 'Coach Mara Santos', nullable: true })
  display_name: string | null;

  @ApiPropertyOptional({ example: 'coach.mara@fittrack.com', nullable: true })
  contact_email: string | null;

  @ApiPropertyOptional({ example: '+639171234567', nullable: true })
  contact_phone: string | null;

  @ApiPropertyOptional({ example: 'Strength and conditioning', nullable: true })
  specialization: string | null;

  @ApiPropertyOptional({
    example: 'NASM-certified coach focused on athletic performance.',
    nullable: true,
  })
  bio: string | null;

  @ApiPropertyOptional({ example: 'NASM-CPT', nullable: true })
  certification: string | null;

  @ApiProperty({ example: '1200' })
  hourly_rate: string;

  @ApiProperty({
    enum: CoachScheduleType,
    example: CoachScheduleType.part_time,
  })
  schedule_type: CoachScheduleType;

  @ApiPropertyOptional({ example: '4.75', nullable: true })
  average_rating: string | null;

  @ApiProperty({ example: 24 })
  rating_count: number;

  @ApiProperty({
    type: CoachPublicReviewResponseDTO,
    isArray: true,
  })
  recent_reviews: CoachPublicReviewResponseDTO[];

  @ApiProperty({ example: true })
  is_available_for_booking: boolean;

  @ApiProperty({ type: CoachUserProfileResponseDTO })
  profile: CoachUserProfileResponseDTO;

  @ApiProperty({
    type: CoachAvailabilitySlotResponseDTO,
    isArray: true,
  })
  availability_slots: CoachAvailabilitySlotResponseDTO[];

  @ApiProperty({
    description:
      'Gym-local date keys where this coach already has an active booking or appointment.',
    example: ['2026-05-04'],
    isArray: true,
    type: String,
  })
  booked_dates: string[];
}

export class CoachDetailResponseDTO extends CoachListItemResponseDTO {}

export class CoachSelfDetailResponseDTO extends CoachDetailResponseDTO {
  @ApiProperty({ type: CoachSelfUserResponseDTO })
  user: CoachSelfUserResponseDTO;
}

export class AdminCoachDetailResponseDTO extends CoachDetailResponseDTO {
  @ApiProperty({ example: '20' })
  gym_commission_pct: string;
}
