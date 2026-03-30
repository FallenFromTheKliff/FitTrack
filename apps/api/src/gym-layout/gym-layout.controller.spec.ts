import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GymLayoutController } from './gym-layout.controller';

function getGuardMetadata(
  methodName:
    | 'listEquipment'
    | 'createEquipment'
    | 'updateEquipment'
    | 'deleteEquipment',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    GymLayoutController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'createEquipment' | 'updateEquipment' | 'deleteEquipment',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    GymLayoutController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('GymLayoutController', () => {
  const gymLayoutService = {
    listEquipment: jest.fn(),
    createEquipment: jest.fn(),
    updateEquipment: jest.fn(),
    deleteEquipment: jest.fn(),
  };

  let controller: GymLayoutController;

  beforeEach(() => {
    controller = new GymLayoutController(gymLayoutService as never);
    jest.clearAllMocks();
  });

  it('lists equipment through the service', async () => {
    gymLayoutService.listEquipment.mockResolvedValue([{ id: 'equipment-1' }]);

    await controller.listEquipment();

    expect(gymLayoutService.listEquipment).toHaveBeenCalled();
  });

  it('protects equipment listing with JWT auth', () => {
    expect(getGuardMetadata('listEquipment')).toEqual([JwtAuthGuard]);
  });

  it('creates equipment through the service', async () => {
    gymLayoutService.createEquipment.mockResolvedValue({ id: 'equipment-1' });

    await controller.createEquipment({
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 12.5,
      position_y: 7.25,
    } as never);

    expect(gymLayoutService.createEquipment).toHaveBeenCalledWith({
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 12.5,
      position_y: 7.25,
    });
  });

  it.each(['createEquipment', 'updateEquipment', 'deleteEquipment'] as const)(
    'locks %s to admin users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
    },
  );

  it('returns a confirmation message after soft delete', async () => {
    gymLayoutService.deleteEquipment.mockResolvedValue(undefined);

    await expect(controller.deleteEquipment('equipment-1')).resolves.toEqual({
      message: 'Equipment deleted from gym layout.',
    });
    expect(gymLayoutService.deleteEquipment).toHaveBeenCalledWith(
      'equipment-1',
    );
  });
});
