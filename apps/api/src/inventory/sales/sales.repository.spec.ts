import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SalesRepository } from './sales.repository';

describe('SalesRepository', () => {
  const saleTransaction = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  };

  const retailProduct = {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };

  const user = {
    findUnique: jest.fn(),
  };

  const tx = {
    payment: {
      create: jest.fn(),
    },
    saleTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    retailProduct: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    saleTransactionItem: {
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const prisma = {
    saleTransaction,
    retailProduct,
    user,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  let repo: SalesRepository;

  beforeEach(() => {
    repo = new SalesRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists sales with date-range pagination and staff context', async () => {
    saleTransaction.findMany.mockResolvedValue([{ id: 'sale-1' }]);
    saleTransaction.count.mockResolvedValue(1);

    await repo.listSales({
      page: 2,
      limit: 10,
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    });

    expect(saleTransaction.findMany).toHaveBeenCalledWith({
      where: {
        created_at: {
          gte: new Date('2026-03-01'),
          lte: new Date('2026-03-31'),
        },
      },
      include: {
        staff: {
          select: {
            id: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: 10,
      take: 10,
    });
  });

  it('loads a single sale with items and product snapshots', async () => {
    saleTransaction.findUnique.mockResolvedValue({ id: 'sale-1' });

    await repo.findSaleByIdOrThrow('sale-1');

    expect(saleTransaction.findUnique).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      include: {
        staff: {
          select: {
            id: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        items: {
          orderBy: [{ created_at: 'asc' }],
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image_url: true,
              },
            },
          },
        },
      },
      select: undefined,
    });
  });

  it('creates a cash sale transaction and decrements stock atomically', async () => {
    tx.retailProduct.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        price: new Prisma.Decimal('1499.00'),
        stock_quantity: 5,
        image_url: null,
        is_active: true,
      },
    ]);
    tx.user.findUnique.mockResolvedValue({ id: 'customer-1' });
    tx.saleTransaction.create.mockResolvedValue({ id: 'sale-1' });
    tx.saleTransactionItem.createMany.mockResolvedValue({ count: 1 });
    tx.retailProduct.updateMany.mockResolvedValue({ count: 1 });
    tx.saleTransaction.findUnique.mockResolvedValue({ id: 'sale-1' });

    await repo.createCashSale({
      processedBy: 'staff-1',
      customerName: 'Walk-in Customer',
      customerUserId: 'customer-1',
      notes: 'Cash drawer sale.',
      items: [{ product_id: 'product-1', quantity: 2 }],
      source: 'manual',
    });

    expect(tx.saleTransaction.create).toHaveBeenCalledWith({
      data: {
        customer_name: 'Walk-in Customer',
        customer_user_id: 'customer-1',
        notes: 'Cash drawer sale.',
        source: 'manual',
        total_amount: new Prisma.Decimal('2998.00'),
        payment_method: 'cash',
        processed_by: 'staff-1',
        status: 'completed',
      },
    });
    expect(tx.saleTransactionItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          transaction_id: 'sale-1',
          product_id: 'product-1',
          quantity: 2,
          unit_price: new Prisma.Decimal('1499.00'),
          subtotal: new Prisma.Decimal('2998.00'),
        },
      ],
    });
    expect(tx.retailProduct.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        is_active: true,
        stock_quantity: {
          gte: 2,
        },
      },
      data: {
        stock_quantity: {
          decrement: 2,
        },
      },
    });
  });

  it('creates a pending paymongo sale and shared payment record together', async () => {
    tx.retailProduct.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        price: new Prisma.Decimal('1499.00'),
        stock_quantity: 5,
        image_url: null,
        is_active: true,
      },
    ]);
    tx.user.findUnique.mockResolvedValue({ id: 'customer-1' });
    tx.saleTransaction.create.mockResolvedValue({ id: 'sale-1' });
    tx.saleTransactionItem.createMany.mockResolvedValue({ count: 1 });
    tx.retailProduct.updateMany.mockResolvedValue({ count: 1 });
    tx.payment.create.mockResolvedValue({ id: 'payment-1' });
    tx.saleTransaction.update.mockResolvedValue({
      id: 'sale-1',
      payment_id: 'payment-1',
    });
    tx.saleTransaction.findUnique.mockResolvedValue({ id: 'sale-1' });

    await repo.createPendingPaymongoSale({
      processedBy: 'staff-1',
      customerName: 'Walk-in Customer',
      customerUserId: 'customer-1',
      notes: 'Customer started checkout at the front desk.',
      items: [{ product_id: 'product-1', quantity: 2 }],
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      source: 'manual',
    });

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        user: {
          connect: {
            id: 'customer-1',
          },
        },
        payable_type: 'product',
        payable_id: 'sale-1',
        payment_stage: 'full',
        amount: new Prisma.Decimal('2998.00'),
        provider: 'paymongo',
        idempotency_key: '11111111-1111-4111-8111-111111111111',
        status: 'pending',
      },
    });
    expect(tx.saleTransaction.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: {
        payment_id: 'payment-1',
      },
    });
    expect(tx.retailProduct.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        is_active: true,
        stock_quantity: {
          gte: 2,
        },
      },
      data: {
        stock_quantity: {
          decrement: 2,
        },
      },
    });
  });

  it('finalizes a pending paymongo sale by marking the sale complete', async () => {
    tx.saleTransaction.findUnique.mockResolvedValue({
      id: 'sale-1',
      payment_method: 'paymongo',
      payment_id: 'payment-1',
      status: 'pending',
      items: [{ product_id: 'product-1', quantity: 2 }],
    });
    tx.saleTransaction.update.mockResolvedValue({
      id: 'sale-1',
      status: 'completed',
    });
    tx.saleTransaction.findUnique
      .mockResolvedValueOnce({
        id: 'sale-1',
        payment_method: 'paymongo',
        payment_id: 'payment-1',
        status: 'pending',
        items: [{ product_id: 'product-1', quantity: 2 }],
      })
      .mockResolvedValueOnce({ id: 'sale-1', status: 'completed' });

    await repo.completePendingPaymongoSale('sale-1', 'payment-1');

    expect(tx.retailProduct.updateMany).not.toHaveBeenCalled();
    expect(tx.saleTransaction.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: {
        status: 'completed',
      },
    });
  });

  it('returns null when a payment completion arrives for an already completed sale', async () => {
    tx.saleTransaction.findUnique.mockResolvedValue({
      id: 'sale-1',
      payment_method: 'paymongo',
      payment_id: 'payment-1',
      status: 'completed',
      items: [{ product_id: 'product-1', quantity: 2 }],
    });

    await expect(
      repo.completePendingPaymongoSale('sale-1', 'payment-1'),
    ).resolves.toBeNull();

    expect(tx.retailProduct.updateMany).not.toHaveBeenCalled();
    expect(tx.saleTransaction.update).not.toHaveBeenCalled();
  });

  it('rejects sale creation when requested stock exceeds availability', async () => {
    tx.retailProduct.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        price: new Prisma.Decimal('1499.00'),
        stock_quantity: 1,
        image_url: null,
        is_active: true,
      },
    ]);

    await expect(
      repo.createCashSale({
        processedBy: 'staff-1',
        items: [{ product_id: 'product-1', quantity: 2 }],
        source: 'manual',
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(tx.saleTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects paymongo sale creation when the customer user does not exist', async () => {
    tx.retailProduct.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        price: new Prisma.Decimal('1499.00'),
        stock_quantity: 5,
        image_url: null,
        is_active: true,
      },
    ]);
    tx.user.findUnique.mockResolvedValue(null);

    await expect(
      repo.createPendingPaymongoSale({
        processedBy: 'staff-1',
        customerUserId: 'missing-user',
        items: [{ product_id: 'product-1', quantity: 1 }],
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        source: 'manual',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects pending paymongo sale creation when stock was consumed before reservation commit', async () => {
    tx.retailProduct.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        price: new Prisma.Decimal('1499.00'),
        stock_quantity: 5,
        image_url: null,
        is_active: true,
      },
    ]);
    tx.user.findUnique.mockResolvedValue({ id: 'customer-1' });
    tx.saleTransaction.create.mockResolvedValue({ id: 'sale-1' });
    tx.saleTransactionItem.createMany.mockResolvedValue({ count: 1 });
    tx.retailProduct.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.createPendingPaymongoSale({
        processedBy: 'staff-1',
        customerUserId: 'customer-1',
        items: [{ product_id: 'product-1', quantity: 2 }],
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        source: 'manual',
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('rejects sale creation when a product is missing or inactive', async () => {
    tx.retailProduct.findMany.mockResolvedValue([]);

    await expect(
      repo.createCashSale({
        processedBy: 'staff-1',
        items: [{ product_id: 'missing-product', quantity: 1 }],
        source: 'manual',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
