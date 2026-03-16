import { IsEmail, IsString, IsOptional, IsDateString, IsNumber, IsEnum, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @IsOptional()
    @Transform(({ value }) => value?.replace(/[\s-]/g, ''))
    @Matches(/^(09\d{9}|\+639\d{9})$/, {
        message: 'Phone number must be a valid Philippine mobile number'
    })
    phone_no?: string;
}

export class CreateProfileDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    firstName: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    lastName: string;

    @IsDateString()
    @IsNotEmpty()
    dateOfBirth: string;

    // @IsEnum(['male', 'female', 'other'])
    @IsNotEmpty()
    gender: string;

    @IsNumber()
    @IsNotEmpty()
    currentWeightKg: number;

    @IsNumber()
    @IsNotEmpty()
    heightCm: number;

    @IsString()
    @IsNotEmpty()
    fitnessGoal: string;
}

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    lastName?: string;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @IsOptional()
    // @IsEnum(['male', 'female', 'other'])
    gender?: string;

    @IsOptional()
    @IsNumber()
    currentWeightKg?: number;

    @IsOptional()
    @IsNumber()
    heightCm?: number;

    @IsOptional()
    @IsString()
    fitnessGoal?: string;

    @IsOptional()
    // @IsEnum(['member', 'premium', 'vip'])
    membershipType?: string;
}