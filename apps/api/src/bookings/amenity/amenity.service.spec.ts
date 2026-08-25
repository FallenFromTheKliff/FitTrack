import { Test, TestingModule } from '@nestjs/testing';
import { AmenityType, EquipmentStatus } from '@prisma/client';

import { AmenityRepository } from './amenity.repository';
import { AmenityService } from './amenity.service';

describe('AmenityService', () => {
  let service: AmenityService;

  const repo = {
    listActiveAmenities: jest.fn(),
    listBookableAmenities: jest.fn(),
    listArchivedAmenities: jest.fn(),
    findActiveAmenityByIdOrThrow: jest.fn(),
    findAmenityByIdOrThrow: jest.fn(),
    createAmenity: jest.fn(),
    updateAmenity: jest.fn(),
    moveAmenityAndEquipment: jest.fn(),
    getFloorMap: jest.fn(),
    listMappedAmenitiesForFloor: jest.fn(),
    listEquipmentForVenue: jest.fn(),
    softDeleteAmenity: jest.fn(),
    restoreAmenity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmenityService,
        { provide: AmenityRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<AmenityService>(AmenityService);
    jest.clearAllMocks();
    repo.findAmenityByIdOrThrow.mockResolvedValue({
      hourly_rate: 0,
      is_reservable: false,
    });
    repo.getFloorMap.mockResolvedValue({
      footprint_cells: Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 14 }, (_, column) => ({ column: column + 1, row: row + 1 })),
      ).flat(),
      path_cells: [],
    });
    repo.listMappedAmenitiesForFloor.mockResolvedValue([]);
    repo.listEquipmentForVenue.mockResolvedValue([]);
  });

  it('creates amenities with default optional values', async () => {
    repo.createAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.createAmenity({
      name: 'Main Court',
      type: AmenityType.basketball_court,
      hourly_rate: 100,
    });

    expect(repo.createAmenity).toHaveBeenCalledWith({
      name: 'Main Court',
      type: AmenityType.basketball_court,
      description: undefined,
      capacity: 1,
      hourly_rate: 100,
      minimum_hours: 1,
      icon_key: 'basketball',
      image_url: null,
      image_fit: 'cover',
      image_focal_x: 0.5,
      image_focal_y: 0.5,
      image_crop_zoom: 1,
      grid_column: 9,
      grid_row: 1,
      grid_width: 6,
      grid_height: 4,
      is_reservable: true,
      display_order: 3,
      floor_id: 'floor-1',
      requires_subscription: false,
      status: EquipmentStatus.available,
    });
  });

  it('updates only fields provided in the DTO', async () => {
    repo.updateAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.updateAmenity('amenity-1', {
      name: 'Updated Court',
      requires_subscription: true,
    });

    expect(repo.updateAmenity).toHaveBeenCalledWith('amenity-1', {
      name: 'Updated Court',
      requires_subscription: true,
    });
  });

  it('respects explicit layout metadata during creation', async () => {
    repo.createAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.createAmenity({
      name: 'Studio Alpha',
      type: AmenityType.other,
      floor_id: 'floor-3',
      grid_column: 5,
      grid_row: 2,
      grid_width: 4,
      grid_height: 3,
      icon_key: 'yoga',
      is_reservable: false,
      display_order: 7,
      minimum_hours: 2,
    });

    expect(repo.createAmenity).toHaveBeenCalledWith({
      name: 'Studio Alpha',
      type: AmenityType.other,
      description: undefined,
      capacity: 1,
      hourly_rate: 0,
      minimum_hours: 2,
      icon_key: 'yoga',
      image_url: null,
      image_fit: 'cover',
      image_focal_x: 0.5,
      image_focal_y: 0.5,
      image_crop_zoom: 1,
      grid_column: 5,
      grid_row: 2,
      grid_width: 4,
      grid_height: 3,
      is_reservable: false,
      display_order: 7,
      floor_id: 'floor-3',
      requires_subscription: false,
      status: EquipmentStatus.available,
    });
  });

  it('moves a venue and its equipment by the same grid delta atomically', async () => {
    repo.findAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1', hourly_rate: 100, is_reservable: true, is_mapped: true,
      floor_id: 'floor-1', grid_column: 2, grid_row: 2, grid_width: 3, grid_height: 3,
    });
    repo.listEquipmentForVenue.mockResolvedValue([{ id: 'equipment-1', grid_column: 3, grid_row: 3 }]);
    repo.moveAmenityAndEquipment.mockResolvedValue({ id: 'amenity-1' });
    await service.updateAmenity('amenity-1', { grid_column: 4, grid_row: 3 });
    expect(repo.moveAmenityAndEquipment).toHaveBeenCalledWith(
      'amenity-1', { grid_column: 4, grid_row: 3 },
      [{ id: 'equipment-1', gridColumn: 5, gridRow: 4 }],
    );
  });

  it('rejects overlapping mapped venue geometry before mutation', async () => {
    repo.findAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1', hourly_rate: 100, is_reservable: true, is_mapped: true,
      floor_id: 'floor-1', grid_column: 2, grid_row: 2, grid_width: 2, grid_height: 2,
    });
    repo.listMappedAmenitiesForFloor.mockResolvedValue([{
      grid_column: 4, grid_row: 2, grid_width: 2, grid_height: 2,
    }]);
    await expect(service.updateAmenity('amenity-1', { grid_column: 4 }))
      .rejects.toThrow('Bad Request Exception');
    expect(repo.moveAmenityAndEquipment).not.toHaveBeenCalled();
  });

  it('rejects venue geometry outside the fixed grid or published footprint', async () => {
    repo.findAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1', hourly_rate: 100, is_reservable: true, is_mapped: true,
      floor_id: 'floor-1', grid_column: 2, grid_row: 2, grid_width: 2, grid_height: 2,
    });
    await expect(service.updateAmenity('amenity-1', { grid_column: 14 }))
      .rejects.toThrow('Bad Request Exception');

    repo.getFloorMap.mockResolvedValue({
      footprint_cells: [{ column: 1, row: 1 }],
      path_cells: [],
    });
    await expect(service.updateAmenity('amenity-1', { grid_column: 1, grid_row: 1 }))
      .rejects.toThrow('Bad Request Exception');
    expect(repo.moveAmenityAndEquipment).not.toHaveBeenCalled();
  });

  it('accepts a valid enlarge and rejects a shrink that excludes equipment', async () => {
    repo.findAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1', hourly_rate: 100, is_reservable: true, is_mapped: true,
      floor_id: 'floor-1', grid_column: 2, grid_row: 2, grid_width: 3, grid_height: 3,
    });
    repo.listEquipmentForVenue.mockResolvedValue([{ id: 'equipment-1', grid_column: 4, grid_row: 4 }]);
    repo.moveAmenityAndEquipment.mockResolvedValue({ id: 'amenity-1' });
    await service.updateAmenity('amenity-1', { grid_width: 4, grid_height: 4 });
    expect(repo.moveAmenityAndEquipment).toHaveBeenCalledTimes(1);

    repo.moveAmenityAndEquipment.mockClear();
    await expect(service.updateAmenity('amenity-1', { grid_width: 2 }))
      .rejects.toThrow('Bad Request Exception');
    expect(repo.moveAmenityAndEquipment).not.toHaveBeenCalled();
  });

  it('accepts a shrink when all contained equipment remains inside', async () => {
    repo.findAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1', hourly_rate: 100, is_reservable: true, is_mapped: true,
      floor_id: 'floor-1', grid_column: 2, grid_row: 2, grid_width: 4, grid_height: 4,
    });
    repo.listEquipmentForVenue.mockResolvedValue([{ id: 'equipment-1', grid_column: 3, grid_row: 3 }]);
    repo.moveAmenityAndEquipment.mockResolvedValue({ id: 'amenity-1' });
    await service.updateAmenity('amenity-1', { grid_width: 2, grid_height: 2 });
    expect(repo.moveAmenityAndEquipment).toHaveBeenCalledWith(
      'amenity-1', { grid_width: 2, grid_height: 2 },
      [{ id: 'equipment-1', gridColumn: 3, gridRow: 3 }],
    );
  });

  it('persists explicit venue image media settings', async () => {
    repo.updateAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.updateAmenity('amenity-1', {
      image_fit: 'contain',
      image_focal_x: 0.2,
      image_focal_y: 0.8,
      image_crop_zoom: 1.75,
    });

    expect(repo.updateAmenity).toHaveBeenCalledWith('amenity-1', {
      image_fit: 'contain',
      image_focal_x: 0.2,
      image_focal_y: 0.8,
      image_crop_zoom: 1.75,
    });
  });

  it('loads active amenities by id', async () => {
    repo.findActiveAmenityByIdOrThrow.mockResolvedValue({ id: 'amenity-1' });

    await service.getAmenityById('amenity-1');

    expect(repo.findActiveAmenityByIdOrThrow).toHaveBeenCalledWith('amenity-1');
  });

  it('lists only repository-approved bookable amenities for booking surfaces', async () => {
    repo.listBookableAmenities.mockResolvedValue([{ id: 'bookable-venue' }]);

    await expect(service.listAmenities()).resolves.toEqual([
      { id: 'bookable-venue' },
    ]);
    expect(repo.listBookableAmenities).toHaveBeenCalledTimes(1);
  });

  it('lists all active venues for admin and staff operational surfaces', async () => {
    repo.listActiveAmenities.mockResolvedValue([
      { id: 'bookable-venue' },
      { id: 'maintenance-venue' },
    ]);

    await expect(service.listOperationalAmenities()).resolves.toHaveLength(2);
    expect(repo.listActiveAmenities).toHaveBeenCalledTimes(1);
  });

  it('lists archived amenities through the repository', async () => {
    repo.listArchivedAmenities.mockResolvedValue([{ id: 'amenity-1' }]);

    await service.listArchivedAmenities();

    expect(repo.listArchivedAmenities).toHaveBeenCalled();
  });

  it('soft-deletes amenities through the repository', async () => {
    repo.softDeleteAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.deleteAmenity('amenity-1');

    expect(repo.softDeleteAmenity).toHaveBeenCalledWith('amenity-1');
  });

  it('restores amenities through the repository', async () => {
    repo.restoreAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.restoreAmenity('amenity-1');

    expect(repo.restoreAmenity).toHaveBeenCalledWith('amenity-1');
  });
});
