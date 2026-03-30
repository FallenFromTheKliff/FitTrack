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

export class PhoneLoginRequestDTO {
  @ApiProperty({ example: '+639171234567' })
  @IsPhilippineMobileNumber('phone')
  phone: string;
}

export class PhoneLoginVerifyDTO {
  @ApiProperty({ example: '+639171234567' })
  @IsPhilippineMobileNumber('phone')
  phone: string;

  @ApiProperty({ example: '748201' })
  @IsOtpCode('code')
  code: string;
}

export class ForgotPasswordDTO {
  @ApiProperty({ example: 'juan@gmail.com' })
  @IsAllowedEmail('email')
  email: string;
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

export class VerifyPhoneDTO {
  @ApiProperty({ example: '748201' })
  @IsOtpCode('code')
  code: string;
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

  @ApiProperty({ enum: ['admin', 'staff', 'coach'], example: 'coach' })
  @IsString({ message: 'role must be a string' })
  @IsNotEmpty({ message: 'role is required' })
  @IsIn(['admin', 'staff', 'coach'], {
    message: 'role must be one of: admin, staff, coach',
  })
  role: 'admin' | 'staff' | 'coach';

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
