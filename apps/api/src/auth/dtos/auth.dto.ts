import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyCurrentPasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;
}

export class ChangePasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(64, { message: 'Password must not exceed 64 characters' })
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
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class VerifyEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}

export class VerifyPhoneDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.replace(/[\s-]/g, ''))
  @Matches(/^(09\d{9}|\+639\d{9})$/, {
    message: 'Phone number must be a valid Philippine mobile number',
  })
  phone_no: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

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
  newPassword: string;
}

export class RequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class AddPhoneDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.replace(/[\s-]/g, ''))
  @Matches(/^(09\d{9}|\+639\d{9})$/, {
    message: 'Phone number must be a valid Philippine mobile number',
  })
  phone_no: string;
}
