import {
  IsDateString,
  IsNumber,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsNumber()
  @IsNotEmpty()
  venueId: number;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  durationHours: number;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsNumber()
  participants?: number;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
