import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SalesController } from './sales.controller';

function getGuardMetadata(
  methodName: 'createSale' | 'listSales' | 'getSaleById',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    SalesController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'createSale' | 'listSales' | 'getSaleById',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    SalesController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('SalesController', () => {
  const salesService = {
    createSale: jest.fn(),
    listSales: jest.fn(),
    getSaleById: jest.fn(),
  };

  let controller: SalesController;

  beforeEach(() => {
    controller = new SalesController(salesService as never);
    jest.clearAllMocks();
  });

  it('locks sale creation to staff users', async () => {
    salesService.createSale.mockResolvedValue({ id: 'sale-1' });

    await controller.createSale(
      { sub: 'staff-1' } as never,
      {
        payment_method: 'cash',
        items: [{ product_id: 'product-1', quantity: 2 }],
      } as never,
      '11111111-1111-4111-8111-111111111111',
    );

    expect(getGuardMetadata('createSale')).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata('createSale')).toEqual([UserRole.staff]);
    expect(salesService.createSale).toHaveBeenCalledWith(
      'staff-1',
      {
        payment_method: 'cash',
        items: [{ product_id: 'product-1', quantity: 2 }],
      },
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it.each(['listSales', 'getSaleById'] as const)(
    'locks %s to admin and staff users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([
        UserRole.admin,
        UserRole.staff,
      ]);
    },
  );

  it('lists sales through the service', async () => {
    salesService.listSales.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listSales({ page: 1, limit: 20 });

    expect(salesService.listSales).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });
});
