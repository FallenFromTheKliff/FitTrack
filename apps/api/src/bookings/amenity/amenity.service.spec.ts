import { Test, TestingModule } from '@nestjs/testing';
import { AmenityType } from '@prisma/client';

import { AmenityRepository } from './amenity.repository';
import { AmenityService } from './amenity.service';

describe('AmenityService', () => {
  let service: AmenityService;

  const repo = {
    listActiveAmenities: jest.fn(),
    findActiveAmenityByIdOrThrow: jest.fn(),
    createAmenity: jest.fn(),
    updateAmenity: jest.fn(),
    softDeleteAmenity: jest.fn(),
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
  });

  it('creates amenities with default optional values', async () => {
    repo.createAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.createAmenity({
      name: 'Main Court',
      type: AmenityType.basketball_court,
    });

    expect(repo.createAmenity).toHaveBeenCalledWith({
      name: 'Main Court',
      type: AmenityType.basketball_court,
      description: undefined,
      capacity: 1,
      hourly_rate: 0,
      requires_subscription: false,
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

  it('loads active amenities by id', async () => {
    repo.findActiveAmenityByIdOrThrow.mockResolvedValue({ id: 'amenity-1' });

    await service.getAmenityById('amenity-1');

    expect(repo.findActiveAmenityByIdOrThrow).toHaveBeenCalledWith('amenity-1');
  });

  it('soft-deletes amenities through the repository', async () => {
    repo.softDeleteAmenity.mockResolvedValue({ id: 'amenity-1' });

    await service.deleteAmenity('amenity-1');

    expect(repo.softDeleteAmenity).toHaveBeenCalledWith('amenity-1');
  });
});
