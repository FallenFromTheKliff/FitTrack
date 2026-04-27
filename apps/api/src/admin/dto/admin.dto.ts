import { Transform } from 'class-transformer';
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
} from 'class-validator';

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
  @IsString()
  @IsIn(['grant', 'revoke'], {
    message: 'action must be one of: grant, revoke',
  })
  action: 'grant' | 'revoke';

  @IsOptional()
  @IsString()
  @IsIn(['admin_grant', 'admin_repair'], {
    message: 'source must be one of: admin_grant, admin_repair',
  })
  source?: 'admin_grant' | 'admin_repair';

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
