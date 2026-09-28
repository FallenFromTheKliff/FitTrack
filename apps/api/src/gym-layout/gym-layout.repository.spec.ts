import { GymLayoutRepository } from './gym-layout.repository';

describe('GymLayoutRepository', () => {
  const gymEquipment = {
    count: jest.fn<() => Promise<number>>(),
    findUnique: jest.fn<() => Promise<unknown>>(),
    findMany: jest.fn<() => Promise<unknown>>(),
    create: jest.fn<() => Promise<unknown>>(),
    update: jest.fn<() => Promise<unknown>>(),
  };

  const gymEquipmentItem = {
    findUnique: jest.fn<() => Promise<unknown>>(),
  };

  const transactionClient = { gymEquipment, gymEquipmentItem };

  const prisma = {
    gymEquipment,
    gymEquipmentItem,
    $transaction:
      jest.fn<
        (
          callback: (transaction: typeof transactionClient) => unknown,
        ) => Promise<unknown>
      >(),
  };

  let repo: GymLayoutRepository;

  beforeEach(() => {
    repo = new GymLayoutRepository(prisma as never);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof transactionClient) => unknown) =>
        Promise.resolve(callback(transactionClient)),
    );
    prisma.gymEquipmentItem.findUnique.mockResolvedValue({
      is_active: true,
      quantity_current: 5,
    });
    gymEquipment.count.mockResolvedValue(0);
  });

  it('lists only active layout equipment ordered by type then name', async () => {
    gymEquipment.findMany.mockResolvedValue([{ id: 'equipment-1' }]);

    await repo.listActiveEquipment();

    expect(gymEquipment.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      include: expect.any(Object) as unknown,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });

  it('lists archived layout equipment ordered by type then name', async () => {
    gymEquipment.findMany.mockResolvedValue([
      { id: 'equipment-1', is_active: false },
    ]);

    await repo.listArchivedEquipment();

    expect(gymEquipment.findMany).toHaveBeenCalledWith({
      where: { is_active: false },
      include: expect.any(Object) as unknown,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });

  it('creates layout equipment through the gym_equipment delegate', async () => {
    gymEquipment.create.mockResolvedValue({ id: 'equipment-1' });

    await repo.createEquipment({
      name: 'Leg Press Station',
      type: 'strength',
      floor_id: 'floor-1',
      grid_column: 4,
      grid_row: 3,
      position_x: 12.5,
      position_y: 7.25,
      status: 'available',
      inventory_item: { connect: { id: 'inventory-item-1' } },
      venue: { connect: { id: 'venue-1' } },
    } as never);

    expect(gymEquipment.create).toHaveBeenCalledWith({
      data: {
        name: 'Leg Press Station',
        type: 'strength',
        floor_id: 'floor-1',
        grid_column: 4,
        grid_row: 3,
        position_x: 12.5,
        position_y: 7.25,
        status: 'available',
        inventory_item: { connect: { id: 'inventory-item-1' } },
        venue: { connect: { id: 'venue-1' } },
      },
      include: expect.any(Object) as unknown,
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
      include: expect.any(Object) as unknown,
    });
  });

  it('restores layout equipment by setting is_active to true', async () => {
    gymEquipment.update.mockResolvedValue({
      id: 'equipment-1',
      is_active: true,
    });
    gymEquipment.findUnique.mockResolvedValue({
      id: 'equipment-1',
      inventory_item_id: null,
      is_active: false,
    });

    await repo.restoreEquipment('equipment-1');

    expect(gymEquipment.update).toHaveBeenCalledWith({
      where: { id: 'equipment-1' },
      data: { is_active: true },
      include: expect.any(Object) as unknown,
    });
  });
});
