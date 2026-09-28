import {
  IsDateString,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  coachId: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(30)
  duration: number; // in minutes

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAppointmentStatusDto {
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class ConfirmAppointmentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
