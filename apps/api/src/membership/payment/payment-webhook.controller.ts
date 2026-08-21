import { Controller, Headers, HttpCode, Post, RawBody } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PaymentWebhookAckDTO } from './dto/payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiHeader({
    name: 'Paymongo-Signature',
    required: true,
    description:
      'PayMongo webhook signature containing timestamp and HMAC digests.',
  })
  @ApiOperation({
    summary: 'Receive and process PayMongo payment webhooks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook acknowledged.',
    type: PaymentWebhookAckDTO,
  })
  handleWebhook(
    @RawBody() rawBody: Buffer | undefined,
    @Headers('paymongo-signature') signature: string | undefined,
  ) {
    return this.paymentService.handleWebhook(rawBody, signature);
  }
}
