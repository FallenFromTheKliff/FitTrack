import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RetailProductController } from './retail-product.controller';

function getGuardMetadata(
  methodName:
    | 'listProducts'
    | 'getProductById'
    | 'createProduct'
    | 'updateProduct'
    | 'restockProduct',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    RetailProductController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'createProduct' | 'updateProduct' | 'restockProduct',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    RetailProductController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('RetailProductController', () => {
  const retailProductService = {
    listProducts: jest.fn(),
    getProductById: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    restockProduct: jest.fn(),
  };

  let controller: RetailProductController;

  beforeEach(() => {
    controller = new RetailProductController(retailProductService as never);
    jest.clearAllMocks();
  });

  it('protects retail-product browse and detail routes with JWT auth', () => {
    expect(getGuardMetadata('listProducts')).toEqual([JwtAuthGuard]);
    expect(getGuardMetadata('getProductById')).toEqual([JwtAuthGuard]);
  });

  it('lists products through the service', async () => {
    retailProductService.listProducts.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listProducts({});

    expect(retailProductService.listProducts).toHaveBeenCalledWith({});
  });

  it.each(['createProduct', 'updateProduct'] as const)(
    'locks %s to admin users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
    },
  );

  it('locks restock to admin and staff users', () => {
    expect(getGuardMetadata('restockProduct')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('restockProduct')).toEqual([
      UserRole.admin,
      UserRole.staff,
    ]);
  });

  it('creates products through the service', async () => {
    retailProductService.createProduct.mockResolvedValue({ id: 'product-1' });

    await controller.createProduct({
      category: 'supplements',
      name: 'Whey Protein Isolate',
      price: 1499,
    });

    expect(retailProductService.createProduct).toHaveBeenCalledWith({
      category: 'supplements',
      name: 'Whey Protein Isolate',
      price: 1499,
    });
  });

  it('forwards restock requests with the authenticated actor id', async () => {
    retailProductService.restockProduct.mockResolvedValue({ id: 'product-1' });

    await controller.restockProduct({ sub: 'staff-1' } as never, 'product-1', {
      quantity: 5,
      notes: 'Delivered from supplier.',
    });

    expect(retailProductService.restockProduct).toHaveBeenCalledWith(
      'staff-1',
      'product-1',
      {
        quantity: 5,
        notes: 'Delivered from supplier.',
      },
    );
  });
});
