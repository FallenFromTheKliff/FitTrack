import { IsNumber, IsString, IsOptional, IsArray, IsBoolean, IsNotEmpty, Min, Max } from 'class-validator';

export class UpdateCoachProfileDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    specialties?: string[];

    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    certifications?: string[];

    @IsOptional()
    @IsNumber()
    yearsExperience?: number;

    @IsOptional()
    @IsNumber()
    hourlyRate?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class SetCoachAvailabilityDto {
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    @Max(6)
    dayOfWeek: number; // 0 = Sunday, 6 = Saturday

    @IsString()
    @IsNotEmpty()
    startTime: string; // "09:00"

    @IsString()
    @IsNotEmpty()
    endTime: string; // "17:00"
}

export class UpdateCoachAvailabilityDto {
    @IsOptional()
    @IsString()
    startTime?: string;

    @IsOptional()
    @IsString()
    endTime?: string;

    @IsOptional()
    @IsBoolean()
    isAvailable?: boolean;
}