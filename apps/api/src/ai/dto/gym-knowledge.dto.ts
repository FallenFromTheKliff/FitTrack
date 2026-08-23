import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsInt,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GymFaqCategory } from '@prisma/client';

import {
  IsOnOrAfter,
  IsPhilippineMobileNumber,
  TrimString,
} from '../../common/validators';

export class UpsertGymOperatingHoursDTO {
  @ApiProperty({ example: 1, description: '0 = Sunday, 6 = Saturday.' })
  @Type(() => Number)
  @IsInt({ message: 'day_of_week must be an integer' })
  @Min(0, { message: 'day_of_week must be at least 0' })
  @Max(6, { message: 'day_of_week must not exceed 6' })
  day_of_week: number;

  @ApiProperty({ example: '06:00' })
  @IsMilitaryTime({ message: 'opens_at must be a valid military time' })
  opens_at: string;

  @ApiProperty({ example: '22:00' })
  @IsMilitaryTime({ message: 'closes_at must be a valid military time' })
  closes_at: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean({ message: 'is_closed must be a boolean value' })
  is_closed?: boolean;

  @ApiPropertyOptional({
    example: 'Weekday hours',
    nullable: true,
    maxLength: 100,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'label must be a string' })
  @MaxLength(100, { message: 'label must not exceed 100 characters' })
  label?: string;
}

export class CreateGymSpecialScheduleDTO {
  @ApiProperty({ example: '2026-12-24' })
  @IsISO8601({}, { message: 'starts_on must be a valid ISO 8601 date string' })
  starts_on: string;

  @ApiProperty({ example: '2026-12-25' })
  @IsISO8601({}, { message: 'ends_on must be a valid ISO 8601 date string' })
  @IsOnOrAfter('starts_on', 'starts_on', {
    message: 'ends_on must be on or after starts_on',
  })
  ends_on: string;

  @ApiPropertyOptional({ example: '08:00', nullable: true })
  @IsOptional()
  @IsMilitaryTime({ message: 'opens_at must be a valid military time' })
  opens_at?: string;

  @ApiPropertyOptional({ example: '18:00', nullable: true })
  @IsOptional()
  @IsMilitaryTime({ message: 'closes_at must be a valid military time' })
  closes_at?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean({ message: 'is_closed must be a boolean value' })
  is_closed?: boolean;

  @ApiProperty({ example: 'Christmas schedule' })
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(255, { message: 'reason must not exceed 255 characters' })
  reason: string;

  @ApiPropertyOptional({
    example: 'Holiday class passes remain valid.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'pricing_note must be a string' })
  pricing_note?: string;
}

export class CreateGymPromotionDTO {
  @ApiProperty({ example: 'Summer Starter Pack' })
  @TrimString()
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  @MaxLength(255, { message: 'title must not exceed 255 characters' })
  title: string;

  @ApiProperty({ example: 'Get two weeks free on annual plans.' })
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  description: string;

  @ApiPropertyOptional({ example: 'SUMMER26', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'promo_code must be a string' })
  @MaxLength(100, { message: 'promo_code must not exceed 100 characters' })
  promo_code?: string;

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z' })
  @IsISO8601({}, { message: 'starts_at must be a valid ISO 8601 date string' })
  starts_at: string;

  @ApiProperty({ example: '2026-05-31T23:59:59.000Z' })
  @IsISO8601({}, { message: 'ends_at must be a valid ISO 8601 date string' })
  @IsOnOrAfter('starts_at', 'starts_at', {
    message: 'ends_at must be on or after starts_at',
  })
  ends_at: string;

  @ApiPropertyOptional({
    example: 'Applies only to new signups.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'pricing_note must be a string' })
  pricing_note?: string;
}

export class CreateGymFaqEntryDTO {
  @ApiProperty({ enum: GymFaqCategory, example: GymFaqCategory.membership })
  @IsEnum(GymFaqCategory, {
    message: `category must be one of: ${Object.values(GymFaqCategory).join(', ')}`,
  })
  category: GymFaqCategory;

  @ApiProperty({ example: 'Do you offer walk-in rates?' })
  @TrimString()
  @IsString({ message: 'question must be a string' })
  @IsNotEmpty({ message: 'question is required' })
  @MaxLength(255, { message: 'question must not exceed 255 characters' })
  question: string;

  @ApiProperty({ example: 'Yes, day passes are available at the front desk.' })
  @TrimString()
  @IsString({ message: 'answer must be a string' })
  @IsNotEmpty({ message: 'answer is required' })
  answer: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['walk-in', 'day pass'],
    nullable: true,
  })
  @IsOptional()
  @IsArray({ message: 'keywords must be an array' })
  @IsString({ each: true, message: 'each value in keywords must be a string' })
  keywords?: string[];

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sort_order must be an integer' })
  @Min(0, { message: 'sort_order must be at least 0' })
  sort_order?: number;
}

export class UpdateGymProfileDTO {
  @ApiProperty({ example: 'SERTFIT Gym' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name: string;

  @ApiProperty({ example: '+639281234567' })
  @IsPhilippineMobileNumber('phone')
  phone: string;

  @ApiProperty({ example: 'Pasay City, Metro Manila, Philippines' })
  @TrimString()
  @IsString({ message: 'location must be a string' })
  @IsNotEmpty({ message: 'location is required' })
  @MaxLength(255, { message: 'location must not exceed 255 characters' })
  location: string;

  @ApiProperty({ example: 'contact@sertfit.com' })
  @TrimString()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @ApiProperty({ example: '06:00' })
  @IsMilitaryTime({ message: 'opening_time must be a valid military time' })
  opening_time: string;

  @ApiProperty({ example: '22:00' })
  @IsMilitaryTime({ message: 'closing_time must be a valid military time' })
  closing_time: string;
}

export class GymProfileResponseDTO {
  @ApiProperty({ example: 'SERTFIT Gym' })
  name: string;

  @ApiProperty({ example: '+639281234567' })
  phone: string;

  @ApiProperty({ example: 'Pasay City, Metro Manila, Philippines' })
  location: string;

  @ApiProperty({ example: 'contact@sertfit.com' })
  email: string;

  @ApiProperty({ example: '06:00' })
  opening_time: string;

  @ApiProperty({ example: '22:00' })
  closing_time: string;
}

export class GymOperatingHourResponseDTO {
  @ApiProperty({ example: '99999999-9999-4999-8999-999999999999' })
  id: string;

  @ApiProperty({ example: 1 })
  day_of_week: number;

  @ApiProperty({ example: '06:00' })
  opens_at: string;

  @ApiProperty({ example: '22:00' })
  closes_at: string;

  @ApiProperty({ example: false })
  is_closed: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Weekday hours',
  })
  label: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-29T09:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-29T10:00:00.000Z' })
  updated_at: string;
}

export class GymSpecialScheduleResponseDTO {
  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  id: string;

  @ApiProperty({ example: '2026-12-24' })
  starts_on: string;

  @ApiProperty({ example: '2026-12-25' })
  ends_on: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '08:00' })
  opens_at: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '18:00' })
  closes_at: string | null;

  @ApiProperty({ example: false })
  is_closed: boolean;

  @ApiProperty({ example: 'Christmas schedule' })
  reason: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Holiday class passes remain valid.',
  })
  pricing_note: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-29T09:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-29T10:00:00.000Z' })
  updated_at: string;
}

export class GymPromotionResponseDTO {
  @ApiProperty({ example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
  id: string;

  @ApiProperty({ example: 'Summer Starter Pack' })
  title: string;

  @ApiProperty({ example: 'Get two weeks free on annual plans.' })
  description: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'SUMMER26',
  })
  promo_code: string | null;

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z' })
  starts_at: string;

  @ApiProperty({ example: '2026-05-31T23:59:59.000Z' })
  ends_at: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Applies only to new signups.',
  })
  pricing_note: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-29T09:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-29T10:00:00.000Z' })
  updated_at: string;
}

export class GymFaqEntryResponseDTO {
  @ApiProperty({ example: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
  id: string;

  @ApiProperty({ enum: GymFaqCategory, example: GymFaqCategory.membership })
  category: GymFaqCategory;

  @ApiProperty({ example: 'Do you offer walk-in rates?' })
  question: string;

  @ApiProperty({ example: 'Yes, day passes are available at the front desk.' })
  answer: string;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['walk-in', 'day pass'],
  })
  keywords: string[] | null;

  @ApiProperty({ example: 10 })
  sort_order: number;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-29T09:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-29T10:00:00.000Z' })
  updated_at: string;
}
