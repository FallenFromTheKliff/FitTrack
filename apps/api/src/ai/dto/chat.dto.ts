import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { ChatContext } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { TrimString } from '../../common/validators';
import { TrainingPlanDetailResponseDTO } from '../../fitness/training-plan/dto/training-plan.dto';
import {
  ActiveTdeeResponseDTO,
  NutritionLogResponseDTO,
} from '../../nutrition/dto/nutrition.dto';

export class AIChatDTO {
  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned chat session id to continue.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'session_id must be a valid UUID' })
  session_id?: string;

  @ApiProperty({
    example: 'Can you help me adjust my macros for today?',
  })
  @TrimString()
  @IsNotEmpty({ message: 'message is required' })
  @MaxLength(2000, { message: 'message must not exceed 2000 characters' })
  message: string;

  @ApiPropertyOptional({
    enum: ChatContext,
    example: ChatContext.general,
    description: 'Used when creating or resuming a context-scoped session.',
  })
  @IsOptional()
  @IsEnum(ChatContext, {
    message: `context_type must be one of: ${Object.values(ChatContext).join(', ')}`,
  })
  context_type?: ChatContext;

  @ApiPropertyOptional({
    example: true,
    description:
      'When true and no session_id is provided, archive the current active context session and start a fresh conversation.',
  })
  @IsOptional()
  @IsBoolean({ message: 'start_new_session must be a boolean' })
  start_new_session?: boolean;
}

export class AIChatResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  session_id: string;

  @ApiProperty({ example: 'I can help with that. Tell me what changed today.' })
  reply: string;

  @ApiPropertyOptional({
    type: String,
    example: 'LOG_NUTRITION',
    nullable: true,
  })
  action_triggered: string | null;

  @ApiPropertyOptional({
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(ActiveTdeeResponseDTO) },
      { $ref: getSchemaPath(TrainingPlanDetailResponseDTO) },
      { $ref: getSchemaPath(NutritionLogResponseDTO) },
    ],
  })
  action_result:
    | ActiveTdeeResponseDTO
    | TrainingPlanDetailResponseDTO
    | NutritionLogResponseDTO
    | null;
}

