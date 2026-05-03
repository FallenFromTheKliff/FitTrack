import {
  Body,
  Controller,
  GoneException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DateRangeDTO } from '../../user/dto/user-dto';
import { AppointmentService } from './appointment.service';
import {
  AppointmentBalanceDTO,
  AppointmentCheckoutResponseDTO,
  AppointmentResponseDTO,
  CancelAppointmentDTO,
  CoachScheduleAppointmentResponseDTO,
  CompleteAppointmentDTO,
  CreateAppointmentDTO,
  InitiateAppointmentPaymentDTO,
  RespondAppointmentDTO,
} from './dto/appointment.dto';

function apiEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: ref },
    },
    required: ['data'],
  };
}

function nullableEnvelopeSchema() {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'null',
        nullable: true,
        example: null,
      },
    },
    required: ['data'],
  };
}

function messageEnvelopeSchema(message: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        properties: {
          message: { type: 'string', example: message },
        },
        required: ['message'],
      },
    },
    required: ['data'],
  };
}

function paginatedEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: itemSchemaRef },
      },
      meta: {
        type: 'object',
        properties: {
          page: { type: 'number', example: 1 },
          limit: { type: 'number', example: 20 },
          total: { type: 'number', example: 1 },
          total_pages: { type: 'number', example: 1 },
        },
      },
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Coaching')
@ApiExtraModels(
  AppointmentResponseDTO,
  AppointmentCheckoutResponseDTO,
  CoachScheduleAppointmentResponseDTO,
)
@Controller('coaching')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post('coaches/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Replace the authenticated coach weekly availability.',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability updated.',
    schema: nullableEnvelopeSchema(),
  })
  setAvailability() {
    throw new GoneException(
      'Coach user availability endpoints are no longer supported. Use /staff/coaches/:id/availability.',
    );
  }

  @Post('appointments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a pending coaching appointment request.' })
  @ApiResponse({
    status: 201,
    description: 'Appointment request created.',
    schema: apiEnvelopeSchema(getSchemaPath(AppointmentResponseDTO)),
  })
  createAppointment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAppointmentDTO,
  ) {
    return this.appointmentService.createAppointment(user.sub, dto);
  }

  @Get('appointments/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the authenticated members appointment history.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(AppointmentResponseDTO)),
  })
  getMyAppointments(
    @CurrentUser() user: JwtPayload,
    @Query() dto: DateRangeDTO,
  ) {
    return this.appointmentService.getMyAppointments(user.sub, dto);
  }

  @Get('appointments/coach')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the authenticated coach appointment schedule.',
  })
  @ApiResponse({
    status: 200,
    description: 'Coach schedule returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(CoachScheduleAppointmentResponseDTO),
    ),
  })
  getCoachAppointments() {
    throw new GoneException(
      'Coach user schedule endpoints are no longer supported. Use /staff/appointments.',
    );
  }

  @Patch('appointments/:id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Accept or reject a pending appointment request as staff or admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment response recorded.',
    schema: apiEnvelopeSchema(getSchemaPath(AppointmentResponseDTO)),
  })
  respondToAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RespondAppointmentDTO,
  ) {
    return this.appointmentService.respondToAppointmentAsStaff(
      user.sub,
      id,
      dto,
    );
  }

  @Patch('appointments/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cancel an appointment. Paid downpayments remain non-refundable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment cancelled.',
    schema: messageEnvelopeSchema(
      'Appointment cancelled. Paid downpayments are non-refundable.',
    ),
  })
  async cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelAppointmentDTO,
  ) {
    await this.appointmentService.cancelAppointment(
      user.sub,
      user.role,
      id,
      dto,
    );
    return {
      message: 'Appointment cancelled. Paid downpayments are non-refundable.',
    };
  }

  @Post('appointments/:id/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 generated by the client and reused on retries.',
  })
  @ApiOperation({
    summary: 'Start the appointment downpayment checkout flow.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment downpayment flow started.',
    schema: apiEnvelopeSchema(getSchemaPath(AppointmentCheckoutResponseDTO)),
  })
  initiateDownpayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: InitiateAppointmentPaymentDTO,
  ) {
    return this.appointmentService.initiateDownpayment(
      user.sub,
      user.role,
      id,
      dto,
      idempotencyKey,
    );
  }

  @Post('appointments/:id/balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Collect the remaining appointment balance as staff.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment balance flow started.',
    schema: apiEnvelopeSchema(getSchemaPath(AppointmentCheckoutResponseDTO)),
  })
  processBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AppointmentBalanceDTO,
  ) {
    return this.appointmentService.processBalance(user.sub, id, dto);
  }

  @Patch('appointments/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mark a confirmed coaching appointment complete as staff.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment marked complete.',
    schema: apiEnvelopeSchema(getSchemaPath(AppointmentResponseDTO)),
  })
  completeAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteAppointmentDTO,
  ) {
    return this.appointmentService.completeAppointmentAsStaff(
      user.sub,
      id,
      dto,
    );
  }
}
