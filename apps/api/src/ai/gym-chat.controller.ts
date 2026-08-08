import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDTO } from '../user/dto/user-dto';
import { BrodigyAccessGuard } from './brodigy-access.guard';
import {
  GymChatMessageResponseDTO,
  GymChatReplyResponseDTO,
  GymChatSessionFilterDTO,
  GymChatSessionResponseDTO,
  SendGymChatMessageDTO,
} from './dto/gym-chat-session.dto';
import { GymChatService } from './gym-chat.service';

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

function dataEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
  };
}

@ApiTags('Gym Chat')
@ApiExtraModels(
  GymChatSessionResponseDTO,
  GymChatMessageResponseDTO,
  GymChatReplyResponseDTO,
)
@Controller('gym-chat')
export class GymChatController {
  constructor(private readonly gymChatService: GymChatService) {}

  @Post('messages')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard, BrodigyAccessGuard)
  @Roles(UserRole.admin, UserRole.coach, UserRole.staff, UserRole.member)
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 403,
    description:
      'BrodigyAI requires an active member account or an admin, coach, or staff account.',
  })
  @ApiOperation({
    summary: 'Send a grounded gym chat message.',
  })
  @ApiResponse({
    status: 200,
    description: 'Grounded gym chat reply returned.',
    schema: dataEnvelopeSchema(getSchemaPath(GymChatReplyResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Gym chat session not found.' })
  @ApiResponse({ status: 410, description: 'Gym chat session archived.' })
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendGymChatMessageDTO,
  ) {
    return this.gymChatService.sendMessage(user.sub, dto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard, BrodigyAccessGuard)
  @Roles(UserRole.admin, UserRole.coach, UserRole.staff, UserRole.member)
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 403,
    description:
      'BrodigyAI requires an active member account or an admin, coach, or staff account.',
  })
  @ApiOperation({
    summary: "List the authenticated user's gym chat sessions.",
  })
  @ApiResponse({
    status: 200,
    description: 'Gym chat sessions returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(GymChatSessionResponseDTO)),
  })
  getMySessions(
    @CurrentUser() user: JwtPayload,
    @Query() dto: GymChatSessionFilterDTO,
  ) {
    return this.gymChatService.getMySessions(user.sub, dto);
  }

  @Get('sessions/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard, BrodigyAccessGuard)
  @Roles(UserRole.admin, UserRole.coach, UserRole.staff, UserRole.member)
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 403,
    description:
      'BrodigyAI requires an active member account or an admin, coach, or staff account.',
  })
  @ApiOperation({
    summary: 'List owned message history for a gym chat session.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym chat messages returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(GymChatMessageResponseDTO)),
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned gym chat session id.',
  })
  @ApiResponse({ status: 404, description: 'Gym chat session not found.' })
  getSessionMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query() dto: PaginationDTO,
  ) {
    return this.gymChatService.getSessionMessages(user.sub, id, dto);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, BrodigyAccessGuard)
  @Roles(UserRole.admin, UserRole.coach, UserRole.staff, UserRole.member)
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 403,
    description:
      'BrodigyAI requires an active member account or an admin, coach, or staff account.',
  })
  @ApiOperation({
    summary: 'Archive an owned gym chat session.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned gym chat session id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym chat session archived.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Gym chat session archived.',
            },
          },
          required: ['message'],
        },
      },
      required: ['data'],
    },
  })
  @ApiResponse({ status: 404, description: 'Gym chat session not found.' })
  async archiveSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.gymChatService.archiveSession(user.sub, id);
    return { message: 'Gym chat session archived.' };
  }
}
