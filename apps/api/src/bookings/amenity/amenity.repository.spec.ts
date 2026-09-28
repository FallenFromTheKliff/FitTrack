import { NotFoundException } from '@nestjs/common';

import { AmenityRepository } from './amenity.repository';

describe('AmenityRepository', () => {
  const amenity = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    amenity,
    $transaction: jest.fn(),
  };

  let repo: AmenityRepository;

  beforeEach(() => {
    repo = new AmenityRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists only active amenities ordered by type then name', async () => {
    amenity.findMany.mockResolvedValue([{ id: 'amenity-1' }]);

    await repo.listActiveAmenities();

    expect(amenity.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      include: undefined,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });

  it('lists active mapped reservable amenities without excluding maintenance status', async () => {
    const records = [
      { id: 'amenity-1', is_reservable: true, status: 'maintenance' },
      { id: 'amenity-2', is_reservable: true, status: 'occupied' },
    ];
    amenity.findMany.mockResolvedValue(records);

    await expect(repo.listReservableOperationalAmenities()).resolves.toEqual(
      records,
    );

    expect(amenity.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
        is_mapped: true,
        is_reservable: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });

  it('lists archived amenities ordered by type then name', async () => {
    amenity.findMany.mockResolvedValue([{ id: 'amenity-1', is_active: false }]);

    await repo.listArchivedAmenities();

    expect(amenity.findMany).toHaveBeenCalledWith({
      where: { is_active: false },
      include: undefined,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: undefined,
    });
  });

  it('loads a single active amenity by id', async () => {
    amenity.findFirst.mockResolvedValue({ id: 'amenity-1', is_active: true });

    await repo.findActiveAmenityByIdOrThrow('amenity-1');

    expect(amenity.findFirst).toHaveBeenCalledWith({
      where: { id: 'amenity-1', is_active: true },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('throws when an active amenity cannot be found by id', async () => {
    amenity.findFirst.mockResolvedValue(null);

    await expect(
      repo.findActiveAmenityByIdOrThrow('missing-amenity'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(amenity.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing-amenity', is_active: true },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('restores amenities by setting is_active to true', async () => {
    amenity.update.mockResolvedValue({ id: 'amenity-1', is_active: true });

    await repo.restoreAmenity('amenity-1');

    expect(amenity.update).toHaveBeenCalledWith({
      where: { id: 'amenity-1' },
      data: { is_active: true },
      include: undefined,
    });
  });
});
