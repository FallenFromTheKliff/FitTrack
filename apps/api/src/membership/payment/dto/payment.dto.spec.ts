import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  ManualPaymentDTO,
  PaymentFilterDTO,
  VerifyPaymentDTO,
} from './payment.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Payment DTO validation', () => {
  it('requires a rejection reason when rejecting a payment', async () => {
    const dto = plainToInstance(VerifyPaymentDTO, {
      action: 'reject',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'rejection_reason is required when action is reject',
    );
  });

  it('rejects invalid screenshot URLs for manual payments', async () => {
    const dto = plainToInstance(ManualPaymentDTO, {
      payable_type: 'subscription',
      payable_id: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1',
      payment_stage: 'full',
      amount: 1499,
      screenshot_url: 'not-a-url',
      reference_no: 'OR-123',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'screenshot_url must be a valid URL',
    );
  });

  it('accepts valid enum filters for the admin payments queue', async () => {
    const dto = plainToInstance(PaymentFilterDTO, {
      status: 'awaiting_verification',
      payable_type: 'subscription',
      page: 1,
      limit: 20,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
