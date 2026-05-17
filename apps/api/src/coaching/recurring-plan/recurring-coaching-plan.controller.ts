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
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  BulkUpdateRecurringPlanSessionsDTO,
  CancelRecurringCoachingPlanDTO,
  CreateRecurringCoachingPlanDTO,
  InitiateRecurringBillingCyclePaymentDTO,
  PreviewRecurringCoachingPlanDTO,
  RecurringBillingCycleCheckoutResponseDTO,
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
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

  @Post(':id/billing-cycles/:cycleId/pay')
  @ApiOperation({
    summary:
      'Start cash verification or PayMongo checkout for a recurring coaching monthly billing cycle.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'cycleId', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Recurring coaching billing cycle payment initialized.',
    type: RecurringBillingCycleCheckoutResponseDTO,
  })
  initiateBillingCyclePayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: InitiateRecurringBillingCyclePaymentDTO,
  ) {
    return this.recurringPlanService.initiateBillingCyclePayment(
      user,
      id,
      cycleId,
      dto,
    );
  }

  @Patch(':id/sessions/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
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
