import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AmenityController } from './amenity.controller';

function getGuardMetadata(
  methodName:
    | 'listAmenities'
    | 'listArchivedAmenities'
    | 'getAmenityById'
    | 'createAmenity'
    | 'updateAmenity'
    | 'restoreAmenity'
    | 'deleteAmenity',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    AmenityController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'createAmenity'
    | 'updateAmenity'
    | 'restoreAmenity'
    | 'deleteAmenity'
    | 'listArchivedAmenities',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    AmenityController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('AmenityController', () => {
  const amenityService = {
    listAmenities: jest.fn(),
    listArchivedAmenities: jest.fn(),
    getAmenityById: jest.fn(),
    createAmenity: jest.fn(),
    updateAmenity: jest.fn(),
    restoreAmenity: jest.fn(),
    deleteAmenity: jest.fn(),
  };

  let controller: AmenityController;

  beforeEach(() => {
    controller = new AmenityController(amenityService as never);
    jest.clearAllMocks();
  });

  it('lists amenities through the service', async () => {
    amenityService.listAmenities.mockResolvedValue([{ id: 'amenity-1' }]);

    await controller.listAmenities();

    expect(amenityService.listAmenities).toHaveBeenCalled();
  });

  it('keeps amenity listing public', () => {
    expect(getGuardMetadata('listAmenities')).toBeUndefined();
  });

  it('lists archived amenities through the service', async () => {
    amenityService.listArchivedAmenities.mockResolvedValue([{ id: 'amenity-1' }]);

    await controller.listArchivedAmenities();

    expect(amenityService.listArchivedAmenities).toHaveBeenCalled();
  });

  it('protects single amenity reads with JWT auth', () => {
    expect(getGuardMetadata('getAmenityById')).toEqual([JwtAuthGuard]);
  });

  it('creates amenities through the service', async () => {
    amenityService.createAmenity.mockResolvedValue({ id: 'amenity-1' });

    await controller.createAmenity({
      name: 'Main Court',
      type: 'basketball_court',
    } as never);

    expect(amenityService.createAmenity).toHaveBeenCalledWith({
      name: 'Main Court',
      type: 'basketball_court',
    });
  });

  it.each(['createAmenity', 'updateAmenity', 'restoreAmenity', 'deleteAmenity', 'listArchivedAmenities'] as const)(
    'locks %s to admin users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
    },
  );

  it('restores amenities through the service', async () => {
    amenityService.restoreAmenity.mockResolvedValue({ id: 'amenity-1' });

    await controller.restoreAmenity('amenity-1');

    expect(amenityService.restoreAmenity).toHaveBeenCalledWith('amenity-1');
  });

  it('returns a confirmation message after soft delete', async () => {
    amenityService.deleteAmenity.mockResolvedValue(undefined);

    await expect(controller.deleteAmenity('amenity-1')).resolves.toEqual({
      message: 'Amenity deleted.',
    });
    expect(amenityService.deleteAmenity).toHaveBeenCalledWith('amenity-1');
  });
});
