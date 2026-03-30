import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateSaleDTO, CreateSaleItemDTO } from './sales.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Sales DTO validation', () => {
  it('requires at least one sale item', async () => {
    const dto = plainToInstance(CreateSaleDTO, {
      payment_method: 'cash',
      items: [],
    });

    expect(extractMessages(await validate(dto))).toContain(
      'items must contain at least 1 item',
    );
  });

  it('rejects unsupported sale payment methods', async () => {
    const dto = plainToInstance(CreateSaleDTO, {
      payment_method: 'card',
      items: [
        { product_id: '11111111-1111-4111-8111-111111111111', quantity: 1 },
      ],
    });

    expect(extractMessages(await validate(dto))).toContain(
      'payment_method must be one of: cash, paymongo',
    );
  });

  it('validates nested sale item quantities', async () => {
    const dto = plainToInstance(CreateSaleItemDTO, {
      product_id: '11111111-1111-4111-8111-111111111111',
      quantity: 0,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'quantity must be at least 1',
    );
  });

  it('accepts a valid cash sale payload', async () => {
    const dto = plainToInstance(CreateSaleDTO, {
      customer_name: 'Walk-in Customer',
      customer_user_id: '22222222-2222-4222-8222-222222222222',
      payment_method: 'cash',
      items: [
        { product_id: '11111111-1111-4111-8111-111111111111', quantity: 2 },
      ],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('validates customer_user_id when provided', async () => {
    const dto = plainToInstance(CreateSaleDTO, {
      payment_method: 'paymongo',
      customer_user_id: 'not-a-uuid',
      items: [
        { product_id: '11111111-1111-4111-8111-111111111111', quantity: 1 },
      ],
    });

    expect(extractMessages(await validate(dto))).toContain(
      'customer_user_id must be a valid UUID',
    );
  });
});
