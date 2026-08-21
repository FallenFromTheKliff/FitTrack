import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Gender,
  ActivityLevel,
  FitnessGoal,
  UserRole,
  UserStatus,
} from '@prisma/client';
import {
  IsOnOrAfter,
  IsPersonName,
  IsPhilippineMobileNumber,
  TrimString,
} from '../../common/validators';

export class PaginationDTO {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit?: number = 20;
}

export class DateRangeDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'start_date must be a valid ISO 8601 date string' })
  start_date?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsISO8601({}, { message: 'end_date must be a valid ISO 8601 date string' })
  @IsOnOrAfter('start_date', 'start_date', {
    message: 'end_date must be on or after start_date',
  })
  end_date?: string;
}

export class UpdateProfileDTO {
  @ApiPropertyOptional({ example: 'Juan' })
  @ValidateIf((_, value) => value !== undefined)
  @IsPersonName('first_name')
  first_name?: string;

  @ApiPropertyOptional({ example: 'Dela Cruz' })
  @ValidateIf((_, value) => value !== undefined)
  @IsPersonName('last_name')
  last_name?: string;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'Canonical date-only value in YYYY-MM-DD format.',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @ValidateIf((_, value) => value !== undefined)
  @TrimString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date_of_birth must be a valid date in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'date_of_birth must be a valid date in YYYY-MM-DD format' },
  )
  date_of_birth?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/avatars/user.png',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ require_tld: false }, { message: 'avatar_url must be a valid URL' })
  avatar_url?: string;

  @ApiPropertyOptional({ enum: Gender })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(Gender, {
    message: `gender must be one of: ${Object.values(Gender).join(', ')}`,
  })
  gender?: Gender;

  @ApiPropertyOptional({ example: 75.5, maximum: 700 })
  @ValidateIf((_, value) => value !== undefined)
  @IsPositive({ message: 'weight_kg must be a positive number' })
  @Max(700, { message: 'weight_kg must not exceed 700' })
  weight_kg?: number;

  @ApiPropertyOptional({ example: 175, maximum: 300 })
  @ValidateIf((_, value) => value !== undefined)
  @IsPositive({ message: 'height_cm must be a positive number' })
  @Max(300, { message: 'height_cm must not exceed 300' })
  height_cm?: number;

  @ApiPropertyOptional({
    enum: ActivityLevel,
    description:
      'Manual overrides are accepted, but this value is overwritten on the next activity-level recalculation.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ActivityLevel, {
    message: `activity_level must be one of: ${Object.values(ActivityLevel).join(', ')}`,
  })
  activity_level?: ActivityLevel;

  @ApiPropertyOptional({ enum: FitnessGoal })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(FitnessGoal, {
    message: `fitness_goal must be one of: ${Object.values(FitnessGoal).join(', ')}`,
  })
  fitness_goal?: FitnessGoal;
}

export class UpdatePhoneDTO {
  @ApiProperty({ example: '+639171234567' })
  @IsPhilippineMobileNumber('phone_number')
  phone_number: string;
}

export class CreateAppFeedbackDTO {
  @ApiPropertyOptional({
    enum: ['bug_report', 'feature_request', 'general_feedback'],
    example: 'general_feedback',
  })
  @IsOptional()
  @IsIn(['bug_report', 'feature_request', 'general_feedback'], {
    message:
      'category must be one of: bug_report, feature_request, general_feedback',
  })
  category?: 'bug_report' | 'feature_request' | 'general_feedback';

  @ApiProperty({
    example:
      'The booking timeline feels clear, but the venue search can be faster.',
  })
  @TrimString()
  @IsString({ message: 'message must be a string' })
  @IsNotEmpty({ message: 'message is required' })
  @MaxLength(1500, { message: 'message must not exceed 1500 characters' })
  message: string;
}

export class LogProgressDTO {
  @ApiPropertyOptional({ example: 74.5 })
  @IsOptional()
  @IsPositive({ message: 'weight_kg must be a positive number' })
  @Max(500, { message: 'weight_kg must not exceed 500' })
  weight_kg?: number;

  @ApiPropertyOptional({ example: 175 })
  @IsOptional()
  @IsPositive({ message: 'height_cm must be a positive number' })
  @Max(300, { message: 'height_cm must not exceed 300' })
  height_cm?: number;

  @ApiPropertyOptional({ example: 18.5 })
  @IsOptional()
  @Min(0, { message: 'body_fat_pct must be at least 0' })
  @Max(60, { message: 'body_fat_pct must not exceed 60' })
  body_fat_pct?: number;

  @ApiPropertyOptional({ example: 45.2 })
  @IsOptional()
  @IsPositive({ message: 'muscle_mass_kg must be a positive number' })
  @Max(500, { message: 'muscle_mass_kg must not exceed 500' })
  muscle_mass_kg?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsPositive({ message: 'waist_cm must be a positive number' })
  @Max(500, { message: 'waist_cm must not exceed 500' })
  waist_cm?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsPositive({ message: 'chest_cm must be a positive number' })
  @Max(500, { message: 'chest_cm must not exceed 500' })
  chest_cm?: number;

  @ApiPropertyOptional({ example: 'Feeling great after cutting phase.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(1000, { message: 'notes must not exceed 1000 characters' })
  notes?: string;

  @ApiPropertyOptional({
    example: '2025-01-15T08:00:00Z',
    description: 'Allows backdating.',
  })
  @IsOptional()
  @IsISO8601(
    {},
    { message: 'recorded_at must be a valid ISO 8601 date string' },
  )
  recorded_at?: string;
}

export class UserFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, {
    message: `role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: `status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 'Juan',
    description: 'Searches first name, last name, and email.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;
}

export class UpdateUserStatusDTO {
  @ApiProperty({
    enum: ['active', 'suspended', 'banned'],
    example: 'suspended',
  })
  @IsString({ message: 'status must be a string' })
  @IsNotEmpty({ message: 'status is required' })
  @IsIn(['active', 'suspended', 'banned'], {
    message: 'status must be one of: active, suspended, banned',
  })
  status: 'active' | 'suspended' | 'banned';

  @ApiPropertyOptional({ example: 'Repeated policy violations.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class ScanQrDTO {
  @ApiPropertyOptional({
    example:
      'fittrack-attendance:9f6f7d18-1ed3-4d35-8f13-6b3770f0f5f8:1902360:abc123...',
    description:
      'Preferred camelCase attendance QR value shown on the member mobile profile.',
  })
  @ValidateIf((object: ScanQrDTO) => !object.qr_value && !object.qr_code_token)
  @TrimString()
  @IsString({ message: 'qrValue must be a string' })
  @IsNotEmpty({ message: 'qrValue is required' })
  @MaxLength(255, { message: 'qrValue must not exceed 255 characters' })
  qrValue?: string;

  @ApiPropertyOptional({
    example:
      'fittrack-attendance:9f6f7d18-1ed3-4d35-8f13-6b3770f0f5f8:1902360:abc123...',
    description:
      'Snake_case attendance QR value kept for compatibility during the scanner transition.',
  })
  @ValidateIf((object: ScanQrDTO) => !object.qrValue && !object.qr_code_token)
  @TrimString()
  @IsString({ message: 'qr_value must be a string' })
  @IsNotEmpty({ message: 'qr_value is required' })
  @MaxLength(255, { message: 'qr_value must not exceed 255 characters' })
  qr_value?: string;

  @ApiPropertyOptional({
    example: 'Xt8n2k...',
    description: 'Legacy raw QR token accepted during the scanner transition.',
  })
  @ValidateIf((object: ScanQrDTO) => !object.qrValue && !object.qr_value)
  @TrimString()
  @IsString({ message: 'qr_code_token must be a string' })
  @IsNotEmpty({ message: 'qr_code_token is required' })
  @MaxLength(64, { message: 'qr_code_token must not exceed 64 characters' })
  qr_code_token?: string;
}

export class ManualAttendanceCheckInDTO {
  @ApiProperty({ example: '2d1fb357-3ffd-4e5e-9f74-4546e408d0a2' })
  @IsUUID('all', { message: 'user_id must be a valid UUID' })
  user_id: string;
}

export class AttendanceFilterDTO extends DateRangeDTO {
  @ApiPropertyOptional({ description: 'Filter by a specific user UUID.' })
  @IsOptional()
  @IsUUID('all', { message: 'user_id must be a valid UUID' })
  user_id?: string;
}
