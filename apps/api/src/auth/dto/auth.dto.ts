import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
}

export class ForgotPasswordDTO {
  @ApiProperty({ example: 'juan@gmail.com' })
  @IsAllowedEmail('email')
  email: string;
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
  @IsOptional()
  @IsPhilippineMobileNumber('phone')
  phone?: string;
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
