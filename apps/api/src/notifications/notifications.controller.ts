import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
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

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  DeleteAllNotificationsResponseDTO,
  DeleteNotificationResponseDTO,
  MarkAllReadResponseDTO,
  NotificationFilterDTO,
  NotificationResponseDTO,
  UnreadCountResponseDTO,
} from './dto/notification.dto';
import {
  NotificationPreferencesResponseDTO,
  UpdateNotificationPreferencesDTO,
} from './dto/notification-preferences.dto';
import { NotificationsService } from './notifications.service';

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

function paginatedEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: { $ref: itemSchemaRef } },
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Notifications')
@ApiExtraModels(
  NotificationResponseDTO,
  UnreadCountResponseDTO,
  MarkAllReadResponseDTO,
  DeleteAllNotificationsResponseDTO,
  DeleteNotificationResponseDTO,
  NotificationPreferencesResponseDTO,
)
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({
    summary: 'Get the authenticated user notification preferences.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences returned.',
    schema: apiEnvelopeSchema(
      getSchemaPath(NotificationPreferencesResponseDTO),
    ),
  })
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Patch('preferences')
  @ApiOperation({
    summary: 'Update the authenticated user notification preferences.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated.',
    schema: apiEnvelopeSchema(
      getSchemaPath(NotificationPreferencesResponseDTO),
    ),
  })
  updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferencesDTO,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get the authenticated user inbox.' })
  @ApiResponse({
    status: 200,
    description: 'Notification inbox returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(NotificationResponseDTO)),
  })
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  getMyNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() dto: NotificationFilterDTO,
  ) {
    return this.notificationsService.getMyNotifications(user.sub, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the authenticated user unread inbox count.' })
  @ApiResponse({
    status: 200,
    description: 'Unread count returned.',
    schema: apiEnvelopeSchema(getSchemaPath(UnreadCountResponseDTO)),
  })
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all in-app notifications as read.' })
  @ApiResponse({
    status: 200,
    description: 'All unread notifications marked as read.',
    schema: apiEnvelopeSchema(getSchemaPath(MarkAllReadResponseDTO)),
  })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one owned in-app notification as read.' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned in-app notification id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read.',
    schema: apiEnvelopeSchema(getSchemaPath(NotificationResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markRead(user.sub, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all owned in-app notifications.' })
  @ApiResponse({
    status: 200,
    description: 'All owned in-app notifications deleted.',
    schema: apiEnvelopeSchema(getSchemaPath(DeleteAllNotificationsResponseDTO)),
  })
  deleteAllNotifications(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.deleteAllNotifications(user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one owned in-app notification.' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '77777777-7777-4777-8777-777777777777',
    description: 'Owned in-app notification id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted.',
    schema: apiEnvelopeSchema(getSchemaPath(DeleteNotificationResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.notificationsService.deleteNotification(user.sub, id);
    return { message: 'Notification deleted.' };
  }
}
