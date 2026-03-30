import { HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PayableType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SalePaymentMethod,
  SaleStatus,
} from '@prisma/client';

import { PaymongoCheckoutService } from '../../membership/payment/paymongo-checkout.service';
import { PaymentRepository } from '../../membership/payment/payment.repository';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;

  const repo = {
    createCashSale: jest.fn(),
    createPendingPaymongoSale: jest.fn(),
    completePendingPaymongoSale: jest.fn(),
    listSales: jest.fn(),
    findSaleByIdOrThrow: jest.fn(),
  };

  const paymentRepository = {
    findPaymentByIdempotencyKey: jest.fn(),
    updatePayment: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const makeSummarySale = (overrides: Record<string, unknown> = {}) => ({
    id: 'sale-1',
    customer_name: 'Walk-in Customer',
    customer_user_id: null,
    total_amount: new Prisma.Decimal('2998.00'),
    payment_method: SalePaymentMethod.cash,
    payment_id: null,
    processed_by: 'staff-1',
    status: SaleStatus.completed,
    staff: {
      id: 'staff-1',
      profile: {
        first_name: 'Morgan',
        last_name: 'Reyes',
      },
    },
    _count: {
      items: 2,
    },
    created_at: new Date('2026-03-27T05:00:00.000Z'),
    updated_at: new Date('2026-03-27T05:05:00.000Z'),
    ...overrides,
  });

  const makeDetailSale = (overrides: Record<string, unknown> = {}) => ({
    ...makeSummarySale(),
    items: [
      {
        id: 'item-1',
        product_id: 'product-1',
        quantity: 2,
        unit_price: new Prisma.Decimal('1499.00'),
        subtotal: new Prisma.Decimal('2998.00'),
        product: {
          id: 'product-1',
          name: 'Whey Protein Isolate',
          image_url: 'https://cdn.fittrack.test/images/whey.png',
        },
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: SalesRepository, useValue: repo },
        { provide: PaymentRepository, useValue: paymentRepository },
        {
          provide: PaymongoCheckoutService,
          useValue: paymongoCheckoutService,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
  });

  it('creates a cash sale through the repository contract', async () => {
    repo.createCashSale.mockResolvedValue(makeDetailSale());

    await expect(
      service.createSale(
        'staff-1',
        {
          customer_name: 'Walk-in Customer',
          payment_method: SalePaymentMethod.cash,
          items: [{ product_id: 'product-1', quantity: 2 }],
        },
        undefined,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'sale-1',
        total_amount: '2998.00',
        items: [
          expect.objectContaining({
            id: 'item-1',
            subtotal: '2998.00',
          }),
        ],
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'inventory.product.stock-changed',
      {
        productIds: ['product-1'],
      },
    );
  });

  it('requires a customer user id for paymongo sales', async () => {
    await expect(
      service.createSale(
        'staff-1',
        {
          payment_method: SalePaymentMethod.paymongo,
          items: [{ product_id: 'product-1', quantity: 1 }],
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(repo.createPendingPaymongoSale).not.toHaveBeenCalled();
  });

  it('starts a paymongo checkout for a customer-owned sale', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    repo.createPendingPaymongoSale.mockResolvedValue({
      sale: makeDetailSale({
        customer_user_id: 'customer-1',
        payment_method: SalePaymentMethod.paymongo,
        payment_id: 'payment-1',
        status: SaleStatus.pending,
      }),
      payment: {
        id: 'payment-1',
        payable_id: 'sale-1',
        payable_type: PayableType.product,
        provider: PaymentProvider.paymongo,
        status: PaymentStatus.pending,
        amount: new Prisma.Decimal('2998.00'),
        idempotency_key: '11111111-1111-4111-8111-111111111111',
      },
    });
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'checkout-1',
      checkoutUrl: 'https://checkout.paymongo.test/sale-1',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.test/sale-1',
      },
    });
    paymentRepository.updatePayment.mockResolvedValue({
      id: 'payment-1',
      status: PaymentStatus.processing,
    });

    await expect(
      service.createSale(
        'staff-1',
        {
          customer_user_id: 'customer-1',
          payment_method: SalePaymentMethod.paymongo,
          items: [{ product_id: 'product-1', quantity: 2 }],
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    ).resolves.toEqual({
      sale_id: 'sale-1',
      payment_id: 'payment-1',
      status: SaleStatus.pending,
      payment_status: PaymentStatus.processing,
      checkout_url: 'https://checkout.paymongo.test/sale-1',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'inventory.product.stock-changed',
      {
        productIds: ['product-1'],
      },
    );
  });

  it('resumes an existing paymongo checkout for the same sale attempt', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue({
      id: 'payment-1',
      payable_id: 'sale-1',
      payable_type: PayableType.product,
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.processing,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.test/sale-1',
      },
    });
    repo.findSaleByIdOrThrow.mockResolvedValue(
      makeDetailSale({
        customer_user_id: 'customer-1',
        payment_method: SalePaymentMethod.paymongo,
        payment_id: 'payment-1',
        status: SaleStatus.pending,
      }),
    );

    await expect(
      service.createSale(
        'staff-1',
        {
          customer_user_id: 'customer-1',
          payment_method: SalePaymentMethod.paymongo,
          items: [{ product_id: 'product-1', quantity: 2 }],
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    ).resolves.toEqual({
      sale_id: 'sale-1',
      payment_id: 'payment-1',
      status: SaleStatus.pending,
      payment_status: PaymentStatus.processing,
      checkout_url: 'https://checkout.paymongo.test/sale-1',
    });

    expect(repo.createPendingPaymongoSale).not.toHaveBeenCalled();
  });

  it('maps paginated sales into summary responses', async () => {
    repo.listSales.mockResolvedValue({
      data: [makeSummarySale()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listSales({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'sale-1',
          items_count: 2,
          total_amount: '2998.00',
          staff: {
            id: 'staff-1',
            first_name: 'Morgan',
            last_name: 'Reyes',
          },
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('loads a single sale by id', async () => {
    repo.findSaleByIdOrThrow.mockResolvedValue(makeDetailSale());

    await expect(service.getSaleById('sale-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'sale-1',
        items: [
          expect.objectContaining({
            product: {
              id: 'product-1',
              name: 'Whey Protein Isolate',
              image_url: 'https://cdn.fittrack.test/images/whey.png',
            },
          }),
        ],
      }),
    );
  });

  it('finalizes product sales on payment.completed events', async () => {
    repo.completePendingPaymongoSale.mockResolvedValue(makeDetailSale());

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'customer-1',
      payableType: PayableType.product,
      payableId: 'sale-1',
      amount: '2998.00',
    });

    expect(repo.completePendingPaymongoSale).toHaveBeenCalledWith(
      'sale-1',
      'payment-1',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('treats duplicate payment completion events as a no-op', async () => {
    repo.completePendingPaymongoSale.mockResolvedValue(null);

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'customer-1',
      payableType: PayableType.product,
      payableId: 'sale-1',
      amount: '2998.00',
    });

    expect(repo.completePendingPaymongoSale).toHaveBeenCalledWith(
      'sale-1',
      'payment-1',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
