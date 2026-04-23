import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  ActiveTdeeResponseDTO,
  NutritionLogResponseDTO,
} from '../nutrition/dto/nutrition.dto';
import {
  TrainingPlanDetailResponseDTO,
  TrainingPlanExerciseResponseDTO,
  TrainingPlanScheduleDayResponseDTO,
} from '../fitness/training-plan/dto/training-plan.dto';
import { PaginationDTO } from '../user/dto/user-dto';
import { AiService } from './ai.service';
import { AIChatDTO, AIChatResponseDTO } from './dto/chat.dto';
import {
  AiChatMessageResponseDTO,
  AiChatSessionResponseDTO,
} from './dto/chat-session.dto';
import { GeneratePlanDTO } from './dto/generate-plan.dto';

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
  };
}

const paginationMetaSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', example: 1 },
    limit: { type: 'number', example: 20 },
    total: { type: 'number', example: 1 },
    total_pages: { type: 'number', example: 1 },
  },
  required: ['page', 'limit', 'total', 'total_pages'],
};

function paginatedEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: schemaRef },
      },
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('AI')
@ApiExtraModels(
  TrainingPlanDetailResponseDTO,
  TrainingPlanScheduleDayResponseDTO,
  TrainingPlanExerciseResponseDTO,
  ActiveTdeeResponseDTO,
  NutritionLogResponseDTO,
  AIChatResponseDTO,
  AiChatSessionResponseDTO,
  AiChatMessageResponseDTO,
)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: AIChatDTO })
  @ApiOperation({
    summary:
      'Send a message to the AI assistant and persist the chat exchange.',
  })
  @ApiResponse({
    status: 201,
    description: 'AI chat reply returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AIChatResponseDTO)),
  })
  @ApiResponse({
    status: 410,
    description: 'The requested chat session was archived after inactivity.',
  })
  @ApiResponse({
    status: 502,
    description: 'AI chat returned an invalid payload.',
  })
  @ApiResponse({
    status: 503,
    description: 'AI chat is unavailable.',
  })
  chat(@CurrentUser() user: JwtPayload, @Body() dto: AIChatDTO) {
    return this.aiService.chat(user.sub, dto);
  }

  @Get('chat/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the authenticated user's AI chat sessions.",
  })
  @ApiResponse({
    status: 200,
    description: 'AI chat sessions returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(AiChatSessionResponseDTO)),
  })
  getMyChatSessions(
    @CurrentUser() user: JwtPayload,
    @Query() dto: PaginationDTO,
  ) {
    return this.aiService.getMyChatSessions(user.sub, dto);
  }

  @Get('chat/sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a single owned AI chat session.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI chat session returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AiChatSessionResponseDTO)),
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned AI chat session id.',
  })
  @ApiResponse({ status: 404, description: 'AI chat session not found.' })
  getChatSessionById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aiService.getChatSessionById(user.sub, id);
  }

  @Get('chat/sessions/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List owned message history for an AI chat session.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI chat messages returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(AiChatMessageResponseDTO)),
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned AI chat session id.',
  })
  @ApiResponse({ status: 404, description: 'AI chat session not found.' })
  getChatMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query() dto: PaginationDTO,
  ) {
    return this.aiService.getChatMessages(user.sub, id, dto);
  }

  @Delete('chat/sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Soft delete an owned AI chat session.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned AI chat session id.',
  })
  @ApiResponse({ status: 200, description: 'AI chat session deleted.' })
  @ApiResponse({ status: 404, description: 'AI chat session not found.' })
  async archiveSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.aiService.archiveSession(user.sub, id);
    return { message: 'AI chat session deleted.' };
  }

  @Patch('chat/sessions/:id/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Restore a soft-deleted owned AI chat session.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned AI chat session id.',
  })
  @ApiResponse({ status: 200, description: 'AI chat session restored.' })
  @ApiResponse({ status: 404, description: 'AI chat session not found.' })
  async restoreSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.aiService.restoreSession(user.sub, id);
    return { message: 'AI chat session restored.' };
  }

  @Post('generate-plan')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: GeneratePlanDTO })
  @ApiOperation({
    summary: 'Generate and persist an AI-authored training plan.',
  })
  @ApiResponse({
    status: 201,
    description: 'AI-generated training plan created.',
    schema: apiEnvelopeSchema(getSchemaPath(TrainingPlanDetailResponseDTO)),
  })
  @ApiResponse({
    status: 422,
    description: 'Profile context or generated exercises are invalid.',
  })
  @ApiResponse({
    status: 502,
    description: 'AI plan generation returned an invalid payload.',
  })
  @ApiResponse({
    status: 503,
    description: 'AI plan generation is unavailable.',
  })
  generatePlan(@CurrentUser() user: JwtPayload, @Body() dto: GeneratePlanDTO) {
    return this.aiService.generatePlan(user.sub, dto);
  }
}
