import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';

import { RetailProductRepository } from './retail-product.repository';
import { RetailProductService } from './retail-product.service';

describe('RetailProductService', () => {
  let service: RetailProductService;

  const repo = {
    listProducts: jest.fn(),
    findActiveProductByIdOrThrow: jest.fn(),
    findProductByIdOrThrow: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    restockProduct: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const makeProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 'product-1',
    category: 'supplements',
    name: 'Whey Protein Isolate',
    description: 'Vanilla whey isolate tub with 30 servings.',
    price: new Prisma.Decimal('1499.00'),
    stock_quantity: 25,
    reorder_threshold: 10,
    image_url: 'https://cdn.fittrack.test/images/whey.png',
    is_active: true,
    created_at: new Date('2026-03-27T02:00:00.000Z'),
    updated_at: new Date('2026-03-27T03:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetailProductService,
        { provide: RetailProductRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<RetailProductService>(RetailProductService);
    jest.clearAllMocks();
  });

  it('maps paginated products to response DTOs', async () => {
    repo.listProducts.mockResolvedValue({
      data: [makeProduct()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listProducts({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'product-1',
          category: 'supplements',
          name: 'Whey Protein Isolate',
          price: '1499.00',
          created_at: '2026-03-27T02:00:00.000Z',
          updated_at: '2026-03-27T03:00:00.000Z',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('creates products with defaults for optional inventory fields', async () => {
    repo.createProduct.mockResolvedValue(makeProduct());

    await service.createProduct({
      name: 'Whey Protein Isolate',
      price: 1499,
    });

    expect(repo.createProduct).toHaveBeenCalledWith({
      category: 'other',
      name: 'Whey Protein Isolate',
      description: null,
      price: 1499,
      stock_quantity: 0,
      reorder_threshold: 10,
      image_url: null,
    });
  });

  it('updates only fields provided in the DTO', async () => {
    repo.updateProduct.mockResolvedValue(
      makeProduct({ is_active: false, image_url: null }),
    );

    await service.updateProduct('product-1', {
      category: 'recovery',
      is_active: false,
      stock_quantity: 12,
      image_url: 'https://cdn.fittrack.test/images/whey-v2.png',
      description: undefined,
    });

    expect(repo.updateProduct).toHaveBeenCalledWith('product-1', {
      category: 'recovery',
      is_active: false,
      image_url: 'https://cdn.fittrack.test/images/whey-v2.png',
      stock_quantity: 12,
    });
  });

  it('restocks products through the repository contract', async () => {
    repo.findProductByIdOrThrow.mockResolvedValue(makeProduct());
    repo.restockProduct.mockResolvedValue(makeProduct({ stock_quantity: 30 }));

    await service.restockProduct('staff-1', 'product-1', {
      quantity: 5,
      notes: 'Delivered from supplier.',
    });

    expect(repo.restockProduct).toHaveBeenCalledWith('product-1', 5);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'staff-1',
        entityId: 'product-1',
      }),
    );
  });

  it('loads a single active product by id', async () => {
    repo.findActiveProductByIdOrThrow.mockResolvedValue(makeProduct());

    await expect(service.getProductById('product-1')).resolves.toEqual(
      expect.objectContaining({
        category: 'supplements',
        id: 'product-1',
        price: '1499.00',
      }),
    );
  });
});
