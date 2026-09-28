import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatContext, ChatRole } from '@prisma/client';

export class AiChatSessionResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ enum: ChatContext, example: ChatContext.general })
  context_type: ChatContext;

  @ApiPropertyOptional({
    type: String,
    example: 'Macros and meal logging',
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

export class AiChatMessageResponseDTO {
  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  id: string;

  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  session_id: string;

  @ApiProperty({ enum: ChatRole, example: ChatRole.assistant })
  role: ChatRole;

  @ApiProperty({ example: 'I can help you log that lunch.' })
  content: string;

  @ApiPropertyOptional({
    type: String,
    example: 'LOG_NUTRITION',
    nullable: true,
  })
  action_triggered: string | null;

  @ApiProperty({ example: '2026-03-27T06:01:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T06:01:00.000Z' })
  updated_at: string;
}
