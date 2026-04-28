import { GymLayoutRepository } from './gym-layout.repository';

describe('GymLayoutRepository', () => {
  const gymEquipment = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    gymEquipment,
    $transaction: jest.fn(),
  };

  let repo: GymLayoutRepository;

  beforeEach(() => {
    repo = new GymLayoutRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists only active layout equipment ordered by type then name', async () => {
    gymEquipment.findMany.mockResolvedValue([{ id: 'equipment-1' }]);

    await repo.listActiveEquipment();

    expect(gymEquipment.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      include: undefined,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });

  it('lists archived layout equipment ordered by type then name', async () => {
    gymEquipment.findMany.mockResolvedValue([{ id: 'equipment-1', is_active: false }]);

    await repo.listArchivedEquipment();

    expect(gymEquipment.findMany).toHaveBeenCalledWith({
      where: { is_active: false },
      include: undefined,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: undefined,
    });
  });

  it('creates layout equipment through the gym_equipment delegate', async () => {
    gymEquipment.create.mockResolvedValue({ id: 'equipment-1' });

    await repo.createEquipment({
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 12.5,
      position_y: 7.25,
      status: 'available',
    } as never);

    expect(gymEquipment.create).toHaveBeenCalledWith({
      data: {
        name: 'Leg Press Station',
        type: 'strength',
        position_x: 12.5,
        position_y: 7.25,
        status: 'available',
      },
      include: undefined,
    });
  });

  it('soft-deletes layout equipment by setting is_active to false', async () => {
    gymEquipment.update.mockResolvedValue({
      id: 'equipment-1',
      is_active: false,
    });

    await repo.softDeleteEquipment('equipment-1');

    expect(gymEquipment.update).toHaveBeenCalledWith({
      where: { id: 'equipment-1' },
      data: { is_active: false },
      include: undefined,
    });
  });

  it('restores layout equipment by setting is_active to true', async () => {
    gymEquipment.update.mockResolvedValue({
      id: 'equipment-1',
      is_active: true,
    });

    await repo.restoreEquipment('equipment-1');

    expect(gymEquipment.update).toHaveBeenCalledWith({
      where: { id: 'equipment-1' },
      data: { is_active: true },
      include: undefined,
    });
  });
});
