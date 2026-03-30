import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GymChatRole } from '@prisma/client';

import { TrimString } from '../../common/validators';
import { PaginationDTO } from '../../user/dto/user-dto';

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

export class SendGymChatMessageDTO {
  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned gym chat session id to continue.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'session_id must be a valid UUID' })
  session_id?: string;

  @ApiProperty({
    example: 'What membership plans and promos are active right now?',
  })
  @TrimString()
  @IsNotEmpty({ message: 'message is required' })
  @MaxLength(2000, { message: 'message must not exceed 2000 characters' })
  message: string;
}

export class GymChatSessionFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}

export class GymChatSessionResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Membership plans and promos',
    nullable: true,
  })
  title: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T06:00:00.000Z' })
  last_activity_at: string;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T06:00:00.000Z' })
  updated_at: string;
}

export class GymChatMessageResponseDTO {
  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  id: string;

  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  session_id: string;

  @ApiProperty({ enum: GymChatRole, example: GymChatRole.assistant })
  role: GymChatRole;

  @ApiProperty({ example: 'Our gym opens at 6:00 AM on weekdays.' })
  content: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['operating_hours', 'membership_plans'],
    nullable: true,
  })
  grounded_sources: string[] | null;

  @ApiProperty({ example: false })
  out_of_scope: boolean;

  @ApiProperty({ example: '2026-03-27T06:01:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T06:01:00.000Z' })
  updated_at: string;
}

export class GymChatReplyResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  session_id: string;

  @ApiProperty({
    example: 'Current promotion: Summer Starter Pack (SUMMER26).',
  })
  reply: string;

  @ApiProperty({
    type: [String],
    example: ['promotions', 'membership_plans'],
  })
  sources: string[];

  @ApiProperty({
    type: [String],
    example: [
      'Ask whether the current promotion applies to new members.',
      'Ask which membership plan fits your visit frequency.',
    ],
  })
  follow_up_suggestions: string[];

  @ApiProperty({ example: false })
  out_of_scope: boolean;
}
