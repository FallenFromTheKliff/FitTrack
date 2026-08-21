import { Transform } from 'class-transformer';
import { ActivityLevel, UserRole, UserStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';

function transformBooleanInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

export class AdminUserFilterDto {
  @IsOptional()
  @IsEnum(UserRole, {
    message: `role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus, {
    message: `status must be one of: ${Object.values(UserStatus).join(', ')}`,
  })
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @IsIn(
    [
      'active_member',
      'pending_membership',
      'pending_verification',
      'revoked',
      'verified_non_member',
    ],
    {
      message:
        'tier must be one of: active_member, pending_membership, pending_verification, revoked, verified_non_member',
    },
  )
  tier?:
    | 'active_member'
    | 'pending_membership'
    | 'pending_verification'
    | 'revoked'
    | 'verified_non_member';

  @IsOptional()
  @Transform(({ value }) => transformBooleanInput(value))
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ActivityLevel, {
    message: `activityLevel must be one of: ${Object.values(ActivityLevel).join(', ')}`,
  })
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsIn(['active', 'expired'], {
    message: 'membershipStatus must be one of: active, expired',
  })
  membershipStatus?: 'active' | 'expired';

  @IsOptional()
  @IsIn(['has_upcoming', 'no_upcoming'], {
    message: 'sessionStatus must be one of: has_upcoming, no_upcoming',
  })
  sessionStatus?: 'has_upcoming' | 'no_upcoming';
}

export class CreateAdminDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(64)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-{}[\]:;"'|,.<>~`])[A-Za-z\d@$!%*?&#^()_+=\-{}[\]:;"'|,.<>~`]+$/,
    {
      message: 'Password must contain uppercase, lowercase, number, and symbol',
    },
  )
  password: string;
}

export class UpgradeToCoachDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  specialties: string[];

  @IsOptional()
  @IsString()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @IsNumber()
  @IsNotEmpty()
  yearsExperience: number;

  @IsNumber()
  @IsNotEmpty()
  hourlyRate: number;
}

export class UpdateMembershipCardDto {
  @ApiProperty({
    description: 'Membership-card lifecycle operation.',
    enum: ['grant', 'revoke', 'remove'],
    example: 'remove',
  })
  @IsString()
  @IsIn(['grant', 'revoke', 'remove'], {
    message: 'action must be one of: grant, revoke, remove',
  })
  action: 'grant' | 'revoke' | 'remove';

  @ApiPropertyOptional({
    description: 'Source used when granting or restoring membership access.',
    enum: ['admin_grant', 'admin_repair'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['admin_grant', 'admin_repair'], {
    message: 'source must be one of: admin_grant, admin_repair',
  })
  source?: 'admin_grant' | 'admin_repair';

  @ApiPropertyOptional({
    description: 'Optional operator reason recorded in the activity event.',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  capacity: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  minimumHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsNumber()
  gridColumn?: number;

  @IsOptional()
  @IsNumber()
  gridRow?: number;

  @IsOptional()
  @IsNumber()
  gridWidth?: number;

  @IsOptional()
  @IsNumber()
  gridHeight?: number;

  @IsOptional()
  @IsBoolean()
  isReservable?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class UpdateVenueDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  minimumHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsNumber()
  gridColumn?: number;

  @IsOptional()
  @IsNumber()
  gridRow?: number;

  @IsOptional()
  @IsNumber()
  gridWidth?: number;

  @IsOptional()
  @IsNumber()
  gridHeight?: number;

  @IsOptional()
  @IsBoolean()
  isReservable?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateStaffDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(64)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-{}[\]:;"'|,.<>~`])[A-Za-z\d@$!%*?&#^()_+=\-{}[\]:;"'|,.<>~`]+$/,
    {
      message: 'Password must contain uppercase, lowercase, number, and symbol',
    },
  )
  password: string;

  @IsOptional()
  @Transform(({ value }) => value?.replace(/[\s-]/g, ''))
  @Matches(/^(09\d{9}|\+639\d{9})$/, {
    message: 'Phone number must be a valid Philippine mobile number',
  })
  phone_no?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;
}
