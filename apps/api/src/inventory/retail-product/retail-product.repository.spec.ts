import { NotFoundException } from '@nestjs/common';

import { RetailProductRepository } from './retail-product.repository';

describe('RetailProductRepository', () => {
  const retailProduct = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    retailProduct,
    $transaction: jest.fn(),
  };

  let repo: RetailProductRepository;

  beforeEach(() => {
    repo = new RetailProductRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists active retail products with the requested filters', async () => {
    retailProduct.findMany.mockResolvedValue([{ id: 'product-1' }]);
    retailProduct.count.mockResolvedValue(1);

    await repo.listProducts({
      page: 2,
      limit: 10,
      search: 'whey',
      in_stock_only: true,
    });

    expect(retailProduct.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
        stock_quantity: { gt: 0 },
        OR: [
          { name: { contains: 'whey', mode: 'insensitive' } },
          { description: { contains: 'whey', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { created_at: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(retailProduct.count).toHaveBeenCalledWith({
      where: {
        is_active: true,
        stock_quantity: { gt: 0 },
        OR: [
          { name: { contains: 'whey', mode: 'insensitive' } },
          { description: { contains: 'whey', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('loads a single active product by id', async () => {
    retailProduct.findFirst.mockResolvedValue({ id: 'product-1' });

    await repo.findActiveProductByIdOrThrow('product-1');

    expect(retailProduct.findFirst).toHaveBeenCalledWith({
      where: { id: 'product-1', is_active: true },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('throws when an active product cannot be found by id', async () => {
    retailProduct.findFirst.mockResolvedValue(null);

    await expect(
      repo.findActiveProductByIdOrThrow('missing-product'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restocks products by incrementing stock quantity', async () => {
    retailProduct.update.mockResolvedValue({ id: 'product-1' });

    await repo.restockProduct('product-1', 5);

    expect(retailProduct.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        stock_quantity: {
          increment: 5,
        },
      },
    });
  });
});
