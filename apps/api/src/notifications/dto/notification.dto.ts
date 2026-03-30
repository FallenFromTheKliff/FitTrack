import { Transform, type TransformFnParams, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';

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

export class NotificationFilterDTO {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    default: false,
    description: 'Only return unread in-app notifications.',
  })
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'unread_only must be a boolean value' })
  unread_only?: boolean = false;
}

export class NotificationResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.subscription_expiring,
  })
  type: NotificationType;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.in_app,
  })
  channel: NotificationChannel;

  @ApiProperty({ example: 'Subscription expiring soon' })
  title: string;

  @ApiProperty({ example: 'Your membership expires in 3 days.' })
  body: string;

  @ApiPropertyOptional({
    nullable: true,
    example: { subscription_id: 'sub-1', days_remaining: 3 },
  })
  data: Prisma.JsonValue | null;

  @ApiProperty({
    enum: NotificationStatus,
    example: NotificationStatus.pending,
  })
  status: NotificationStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-03-28T03:00:00.000Z',
  })
  sent_at: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-03-28T05:00:00.000Z',
  })
  read_at: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Provider delivery failed.',
  })
  error: string | null;

  @ApiProperty({ example: '2026-03-28T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-28T05:00:00.000Z' })
  updated_at: string;
}

export class UnreadCountResponseDTO {
  @ApiProperty({ example: 4 })
  count: number;
}

export class MarkAllReadResponseDTO {
  @ApiProperty({ example: 3 })
  updated_count: number;
}

export class DeleteNotificationResponseDTO {
  @ApiProperty({ example: 'Notification deleted.' })
  message: string;
}
