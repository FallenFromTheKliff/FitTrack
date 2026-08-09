import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoachScheduleType } from '@prisma/client';
import {
  IsAllowedEmail,
  IsOtpCode,
  IsPersonName,
  IsPhilippineMobileNumber,
  IsStrongPasswordField,
  TrimString,
} from '../../common/validators';

// =============================================================================
// S2 - Auth DTOs
// =============================================================================

export class RegisterDTO {
  @ApiProperty({
    example: true,
    description:
      'Explicit acceptance of the active FitTrack Terms of Service and Data Privacy Notice.',
  })
  @IsIn([true], {
    message: 'accepted_terms must be true to create an account',
  })
  accepted_terms: true;

  @ApiProperty({
    example: '2026-07-28',
    description: 'Legal policy version reviewed during registration.',
  })
  @IsString({ message: 'legal_version must be a string' })
  @IsIn(['2026-07-28'], {
    message: 'legal_version must match the active policy version',
  })
  legal_version: string;

  @ApiProperty({
    example: 'juan@gmail.com',
    description:
      'Must use an allowed provider domain such as Gmail, Yahoo, Outlook, iCloud, or fittrack.com.',
  })
  @IsAllowedEmail('email')
  email: string;

  @ApiProperty({
    example: 'Password1!',
    description:
      'Minimum 8 characters with at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.',
  })
  @IsStrongPasswordField('password')
  password: string;

  @ApiProperty({ example: 'Juan' })
  @IsPersonName('first_name')
  first_name: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsPersonName('last_name')
  last_name: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsPhilippineMobileNumber('phone')
  phone?: string;
}

export class VerifyEmailDTO {
  @ApiProperty({ example: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1' })
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  user_id: string;

  @ApiProperty({ example: '482910' })
  @IsOtpCode('code')
  code: string;
}

export class LoginDTO {
  @ApiProperty({
    example: 'juan@gmail.com',
    description: 'Must use an allowed provider domain.',
  })
  @IsAllowedEmail('email')
  email: string;

  @ApiProperty({ example: 'Password1!' })
  @TrimString()
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password is required' })
  @MaxLength(255, { message: 'password must not exceed 255 characters' })
  password: string;

  @ApiPropertyOptional({
    enum: ['team', 'member'],
    example: 'team',
    description:
      'Optional login portal context used to enforce role-based access at authentication time.',
  })
  @IsOptional()
  @IsIn(['team', 'member'], {
    message: 'portal must be one of: team, member',
  })
  portal?: 'team' | 'member';
}

export class ForgotPasswordDTO {
  @ApiProperty({ example: 'juan@gmail.com' })
  @IsAllowedEmail('email')
  email: string;

  @ApiPropertyOptional({
    enum: ['team', 'member'],
    description:
      'Portal context for password reset. Team resets are limited to admin, staff, and coach accounts; member resets are limited to member accounts.',
  })
  @IsOptional()
  @IsIn(['team', 'member'], {
    message: 'portal must be one of: team, member',
  })
  portal?: 'team' | 'member';
}

export class VerifyCurrentPasswordDTO {
  @ApiProperty({ example: 'Password1!' })
  @TrimString()
  @IsString({ message: 'current_password must be a string' })
  @IsNotEmpty({ message: 'current_password is required' })
  @MaxLength(255, {
    message: 'current_password must not exceed 255 characters',
  })
  current_password: string;
}

export class VerifyResetOtpDTO {
  @ApiProperty({ example: 'juan@gmail.com' })
  @IsAllowedEmail('email')
  email: string;

  @ApiProperty({ example: '193847' })
  @IsOtpCode('code')
  code: string;

  @ApiPropertyOptional({
    enum: ['team', 'member'],
    description: 'Portal context that issued the reset OTP.',
  })
  @IsOptional()
  @IsIn(['team', 'member'], {
    message: 'portal must be one of: team, member',
  })
  portal?: 'team' | 'member';
}

export class ResetPasswordDTO {
  @ApiProperty({ example: 'juan@gmail.com' })
  @IsAllowedEmail('email')
  email: string;

  @ApiProperty({ example: '193847' })
  @IsOtpCode('code')
  code: string;

  @ApiProperty({
    example: 'NewPassword1!',
    description:
      'Minimum 8 characters with at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.',
  })
  @IsStrongPasswordField('new_password')
  new_password: string;

  @ApiPropertyOptional({
    enum: ['team', 'member'],
    description: 'Portal context that issued the reset OTP.',
  })
  @IsOptional()
  @IsIn(['team', 'member'], {
    message: 'portal must be one of: team, member',
  })
  portal?: 'team' | 'member';
}

export class ChangePasswordDTO {
  @ApiProperty({ example: 'Password1!' })
  @TrimString()
  @IsString({ message: 'current_password must be a string' })
  @IsNotEmpty({ message: 'current_password is required' })
  @MaxLength(255, {
    message: 'current_password must not exceed 255 characters',
  })
  current_password: string;

  @ApiProperty({
    example: 'NewPassword1!',
    description:
      'Minimum 8 characters with at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.',
  })
  @IsStrongPasswordField('new_password')
  new_password: string;
}

export class AdminCreateCoachProfileDTO {
  @ApiPropertyOptional({ example: 'Coach Maria Santos' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'display_name must be a string' })
  @MaxLength(160, {
    message: 'display_name must not exceed 160 characters',
  })
  display_name?: string;

  @ApiPropertyOptional({ example: 'coach.maria@fittrack.com' })
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

  @ApiPropertyOptional({ example: 'Strength, Mobility' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'specialization must be a string' })
  @MaxLength(255, {
    message: 'specialization must not exceed 255 characters',
  })
  specialization?: string;

  @ApiPropertyOptional({ example: 'NASM-certified strength coach.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'bio must be a string' })
  @MaxLength(2000, { message: 'bio must not exceed 2000 characters' })
  bio?: string;

  @ApiPropertyOptional({ example: 'NASM-CPT, CPR' })
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

export class AdminCreateUserDTO {
  @ApiProperty({
    example: 'coach@fittrack.com',
    description:
      'Must use an allowed provider domain such as Gmail, Yahoo, Outlook, iCloud, or fittrack.com.',
  })
  @IsAllowedEmail('email')
  email: string;

  @ApiProperty({
    example: 'Password1!',
    description:
      'Minimum 8 characters with at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.',
  })
  @IsStrongPasswordField('password')
  password: string;

  @ApiProperty({ example: 'Maria' })
  @IsPersonName('first_name')
  first_name: string;

  @ApiProperty({ example: 'Santos' })
  @IsPersonName('last_name')
  last_name: string;

  @ApiProperty({ enum: ['admin', 'staff', 'member', 'coach'], example: 'member' })
  @IsString({ message: 'role must be a string' })
  @IsNotEmpty({ message: 'role is required' })
  @IsIn(['admin', 'staff', 'member', 'coach'], {
    message: 'role must be one of: admin, staff, member, coach',
  })
  role: 'admin' | 'staff' | 'member' | 'coach';

  @ApiPropertyOptional({ example: '+639171234567' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsOptional()
  @IsPhilippineMobileNumber('phone')
  phone?: string;

  @ApiPropertyOptional({ type: AdminCreateCoachProfileDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminCreateCoachProfileDTO)
  coach_profile?: AdminCreateCoachProfileDTO;
}

export class ResendOtpDTO {
  @ApiProperty({ example: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1' })
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  user_id: string;
}

export class AuthPortalSummaryDTO {
  @ApiProperty({
    example: 4,
    description:
      'Current active member count based on non-revoked active membership cards.',
  })
  active_members: number;

  @ApiProperty({
    example: 0,
    description:
      'Member attendance check-ins recorded today in UTC from the live database.',
  })
  sessions_today: number;

  @ApiProperty({
    example: '52701.00',
    description:
      'All-time recorded business revenue using completed membership, booking, retail, and coaching gym-share records.',
  })
  total_revenue: string;
}
