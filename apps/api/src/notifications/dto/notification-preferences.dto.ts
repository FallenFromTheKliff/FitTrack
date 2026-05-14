import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

function getRawTransformValue({ value, obj, key }: TransformFnParams): unknown {
  if (!obj || typeof key !== 'string') {
    return value;
  }

  const record = obj as Record<string, unknown>;
  return key in record ? record[key] : value;
}

function transformBooleanInput(params: TransformFnParams): unknown {
  const rawValue = getRawTransformValue(params);

  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return rawValue;
}

export class NotificationPreferencesResponseDTO {
  @ApiProperty()
  subscription_expiring_email: boolean;

  @ApiProperty()
  subscription_expired_email: boolean;

  @ApiProperty()
  booking_confirmed_email: boolean;

  @ApiProperty()
  booking_cancelled_email: boolean;

  @ApiProperty()
  venue_booking_reminder_email: boolean;

  @ApiProperty()
  booking_no_show_email: boolean;

  @ApiProperty()
  appointment_confirmed_email: boolean;

  @ApiProperty()
  coach_appointment_reminder_email: boolean;

  @ApiProperty()
  appointment_completed_email: boolean;

  @ApiProperty()
  appointment_cancelled_email: boolean;

  @ApiProperty()
  rank_up_email: boolean;

  @ApiProperty()
  payment_confirmed_email: boolean;

  @ApiProperty()
  payment_failed_email: boolean;

  @ApiProperty()
  ai_session_archived_email: boolean;

  @ApiProperty()
  system_email: boolean;
}

export class UpdateNotificationPreferencesDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'subscription_expiring_email must be a boolean value' })
  subscription_expiring_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'subscription_expired_email must be a boolean value' })
  subscription_expired_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'booking_confirmed_email must be a boolean value' })
  booking_confirmed_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'booking_cancelled_email must be a boolean value' })
  booking_cancelled_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({
    message: 'venue_booking_reminder_email must be a boolean value',
  })
  venue_booking_reminder_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'booking_no_show_email must be a boolean value' })
  booking_no_show_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'appointment_confirmed_email must be a boolean value' })
  appointment_confirmed_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({
    message: 'coach_appointment_reminder_email must be a boolean value',
  })
  coach_appointment_reminder_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'appointment_completed_email must be a boolean value' })
  appointment_completed_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'appointment_cancelled_email must be a boolean value' })
  appointment_cancelled_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'rank_up_email must be a boolean value' })
  rank_up_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'payment_confirmed_email must be a boolean value' })
  payment_confirmed_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'payment_failed_email must be a boolean value' })
  payment_failed_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'ai_session_archived_email must be a boolean value' })
  ai_session_archived_email?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'system_email must be a boolean value' })
  system_email?: boolean;
}
