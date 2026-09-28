import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController checkout reconciliation', () => {
  it('is member-only and forwards the authenticated owner identity', async () => {
    const paymentService = {
      reconcileCheckoutHold: jest.fn().mockResolvedValue({
        hold_id: '11111111-1111-4111-8111-111111111111',
        state: 'succeeded',
      }),
    };
    const controller = new PaymentController(
      paymentService as unknown as PaymentService,
    );
    const handler = Object.getOwnPropertyDescriptor(
      PaymentController.prototype,
      'reconcileCheckoutHold',
    )?.value as object;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.member]);
    await expect(
      controller.reconcileCheckoutHold('11111111-1111-4111-8111-111111111111', {
        sub: '22222222-2222-4222-8222-222222222222',
        role: UserRole.member,
      } as never),
    ).resolves.toMatchObject({ state: 'succeeded' });
    expect(paymentService.reconcileCheckoutHold).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      UserRole.member,
    );
  });

  it('is member-only and forwards the cancel checkout contract', async () => {
    const paymentService = {
      cancelCheckoutHold: jest.fn().mockResolvedValue({
        hold_id: '11111111-1111-4111-8111-111111111111',
        state: 'failed',
      }),
    };
    const controller = new PaymentController(
      paymentService as unknown as PaymentService,
    );
    const handler = Object.getOwnPropertyDescriptor(
      PaymentController.prototype,
      'cancelCheckoutHold',
    )?.value as object;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.member]);
    await expect(
      controller.cancelCheckoutHold('11111111-1111-4111-8111-111111111111', {
        sub: '22222222-2222-4222-8222-222222222222',
        role: UserRole.member,
      } as never),
    ).resolves.toMatchObject({ state: 'failed' });
    expect(paymentService.cancelCheckoutHold).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      UserRole.member,
    );
  });});
