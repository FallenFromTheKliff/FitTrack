import { Test, TestingModule } from '@nestjs/testing';
import { AmenityType, EquipmentStatus } from '@prisma/client';

import { AmenityRepository } from './amenity.repository';
import { AmenityService } from './amenity.service';

describe('AmenityService', () => {
  let service: AmenityService;

  const repo = {
    listActiveAmenities: jest.fn(),
    listArchivedAmenities: jest.fn(),
    findActiveAmenityByIdOrThrow: jest.fn(),
    findAmenityByIdOrThrow: jest.fn(),
    createAmenity: jest.fn(),
    updateAmenity: jest.fn(),
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
