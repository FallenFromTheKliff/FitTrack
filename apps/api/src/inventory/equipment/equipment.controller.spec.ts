import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EquipmentController } from './equipment.controller';

function getGuardMetadata(
  methodName:
    | 'listEquipment'
    | 'listWriteOffHistory'
    | 'getEquipmentById'
    | 'createEquipment'
    | 'updateEquipment'
    | 'writeOffEquipment',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    EquipmentController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'listEquipment'
    | 'listWriteOffHistory'
    | 'getEquipmentById'
    | 'createEquipment'
    | 'updateEquipment'
    | 'writeOffEquipment',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    EquipmentController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('EquipmentController', () => {
  const equipmentService = {
    listEquipmentItems: jest.fn(),
    getWriteOffHistory: jest.fn(),
    getEquipmentItemById: jest.fn(),
    createEquipmentItem: jest.fn(),
    updateEquipmentItem: jest.fn(),
    writeOffEquipment: jest.fn(),
  };

  let controller: EquipmentController;

  beforeEach(() => {
    controller = new EquipmentController(equipmentService as never);
    jest.clearAllMocks();
  });

  it.each([
    'listEquipment',
    'listWriteOffHistory',
    'getEquipmentById',
  ] as const)('locks %s to admin and staff users', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata(methodName)).toEqual([
      UserRole.admin,
      UserRole.staff,
    ]);
  });

  it.each(['createEquipment', 'updateEquipment'] as const)(
    'locks %s to admin users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
    },
  );

  it('forwards write-off requests with the authenticated performer id', async () => {
    equipmentService.writeOffEquipment.mockResolvedValue({ id: 'writeoff-1' });

    await controller.writeOffEquipment(
      { sub: 'staff-1' } as never,
      'equipment-1',
      {
        quantity_set_to: 4,
        reason: 'Damaged equipment removed.',
      },
    );

    expect(getGuardMetadata('writeOffEquipment')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('writeOffEquipment')).toEqual([
      UserRole.admin,
      UserRole.staff,
    ]);
    expect(equipmentService.writeOffEquipment).toHaveBeenCalledWith(
      'staff-1',
      'equipment-1',
      {
        quantity_set_to: 4,
        reason: 'Damaged equipment removed.',
      },
    );
  });

  it('forwards equipment create and update requests with the authenticated actor id', async () => {
    equipmentService.createEquipmentItem.mockResolvedValue({
      id: 'equipment-1',
    });
    equipmentService.updateEquipmentItem.mockResolvedValue({
      id: 'equipment-1',
    });

    await controller.createEquipment({ sub: 'admin-1' } as never, {
      name: 'Adjustable Bench',
      quantity_total: 8,
      quantity_current: 6,
    });
    await controller.updateEquipment(
      { sub: 'admin-1' } as never,
      'equipment-1',
      {
        unit: 'sets',
      },
    );

    expect(equipmentService.createEquipmentItem).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        name: 'Adjustable Bench',
      }),
    );
    expect(equipmentService.updateEquipmentItem).toHaveBeenCalledWith(
      'admin-1',
      'equipment-1',
      {
        unit: 'sets',
      },
    );
  });

  it('loads paginated write-off history through the service', async () => {
    equipmentService.getWriteOffHistory.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listWriteOffHistory('equipment-1', { page: 2, limit: 5 });

    expect(equipmentService.getWriteOffHistory).toHaveBeenCalledWith(
      'equipment-1',
      { page: 2, limit: 5 },
    );
  });
});
