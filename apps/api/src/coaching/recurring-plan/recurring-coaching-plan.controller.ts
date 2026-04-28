import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  BulkUpdateRecurringPlanSessionsDTO,
  CancelRecurringCoachingPlanDTO,
  CreateRecurringCoachingPlanDTO,
  PreviewRecurringCoachingPlanDTO,
  UpdateRecurringPlanSessionDTO,
} from './dto/recurring-coaching-plan.dto';
import { RecurringCoachingPlanService } from './recurring-coaching-plan.service';

@ApiTags('Recurring Coaching Plans')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('bookings/recurring-coaching-plans')
export class RecurringCoachingPlanController {
  constructor(
    private readonly recurringPlanService: RecurringCoachingPlanService,
  ) {}

  @Post('preview')
  @ApiOperation({
    summary:
      'Preview generated recurring coaching sessions and conflicts without persisting rows.',
  })
  @ApiResponse({ status: 201, description: 'Recurring plan preview returned.' })
  previewPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PreviewRecurringCoachingPlanDTO,
  ) {
    return this.recurringPlanService.previewPlan(user, dto);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a recurring coaching plan and persist generated child appointments.',
  })
  @ApiResponse({ status: 201, description: 'Recurring coaching plan created.' })
  createPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRecurringCoachingPlanDTO,
  ) {
    return this.recurringPlanService.createPlan(user, dto);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'List sessions for a recurring coaching plan.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getPlanSessions(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringPlanService.getPlanSessions(user, id);
  }

  @Patch(':id/sessions/bulk')
  @ApiOperation({
    summary:
      'Update future non-completed sessions from a selected recurring session forward.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  bulkUpdateFutureSessions(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpdateRecurringPlanSessionsDTO,
  ) {
    return this.recurringPlanService.bulkUpdateFutureSessions(user, id, dto);
  }

  @Patch(':id/sessions/:sessionId')
  @ApiOperation({
    summary:
      'Reschedule or skip one session without changing the parent recurrence template.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  updateSingleSession(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateRecurringPlanSessionDTO,
  ) {
    return this.recurringPlanService.updateSingleSession(
      user,
      id,
      sessionId,
      dto,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary:
      'Cancel a recurring coaching plan and future non-completed sessions only.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancelPlan(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRecurringCoachingPlanDTO,
  ) {
    return this.recurringPlanService.cancelPlan(user, id, dto);
  }
}
