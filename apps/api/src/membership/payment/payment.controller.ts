import {
  Body,
  Controller,
  Get,
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
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CommerceCheckoutHoldStatusResponseDTO } from '../../coaching/commerce/dto/coaching-commerce.dto';
import {
  ManualPaymentDTO,
  PaymentDetailsResponseDTO,
  PaymentFilterDTO,
  PaymentHistoryDTO,
  PaymentResponseDTO,
  VerifyPaymentDTO,
} from './dto/payment.dto';
import { PaymentService } from './payment.service';

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

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
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
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Payments')
@ApiExtraModels(
  PaymentResponseDTO,
  PaymentDetailsResponseDTO,
  CommerceCheckoutHoldStatusResponseDTO,
)
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get own payment history.' })
  @ApiResponse({
    status: 200,
    description: 'Payment history returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(PaymentResponseDTO)),
  })
  getMyPayments(
    @CurrentUser() user: JwtPayload,
    @Query() dto: PaymentHistoryDTO,
  ) {
    return this.paymentService.getMyPayments(user.sub, dto);
  }

  @Get('checkout-holds/:holdId')
  @ApiOperation({
    summary:
      'Get the authenticated owner status of an internal checkout hold. Expired holds are normalized before the response.',
  })
  @ApiResponse({
    status: 200,
    description: 'Checkout hold status returned.',
    schema: apiEnvelopeSchema(getSchemaPath(CommerceCheckoutHoldStatusResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Checkout hold not found.' })
  getCheckoutHoldStatus(
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.getCheckoutHoldStatus(
      holdId,
      user.sub,
      user.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a single payment. Members can only access their own payments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment returned.',
    schema: apiEnvelopeSchema(getSchemaPath(PaymentDetailsResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  getPaymentById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.getPaymentById(id, user.sub, user.role);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'Get all payments. Admin/Staff only.' })
  @ApiResponse({
    status: 200,
    description: 'Payments returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(PaymentDetailsResponseDTO)),
  })
  getAllPayments(@Query() dto: PaymentFilterDTO) {
    return this.paymentService.getAllPayments(dto);
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Submit a manual payment using an existing screenshot URL.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment submitted for verification.',
  })
  @ApiResponse({
    status: 410,
    description:
      'Member cash membership-card payment requests are retired; use the authorized admin/staff grant flow.',
  })
  submitManualPayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ManualPaymentDTO,
  ) {
    return this.paymentService.submitManualPayment(user.sub, user.role, dto);
  }

  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary:
      'Approve or reject a non-membership-card manual payment. Admin/Staff only.',
  })
  @ApiResponse({ status: 200, description: 'Payment verification recorded.' })
  @ApiResponse({
    status: 410,
    description:
      'Membership-card payment verification is retired; use the authorized admin/staff grant flow.',
  })
  verifyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDTO,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.verifyPayment(id, dto, user.sub);
  }
}
