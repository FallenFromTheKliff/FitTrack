import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

import { EquipmentRepository } from './equipment.repository';

describe('EquipmentRepository', () => {
  const gymEquipmentItem = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };

  const equipmentWriteOff = {
    findMany: jest.fn(),
    count: jest.fn(),
  };

  const tx = {
    gymEquipmentItem: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    equipmentWriteOff: {
      create: jest.fn(),
    },
  };

  const prisma = {
    gymEquipmentItem,
    equipmentWriteOff,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  let repo: EquipmentRepository;

  beforeEach(() => {
    repo = new EquipmentRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists equipment items with pagination and stable ordering', async () => {
    gymEquipmentItem.findMany.mockResolvedValue([{ id: 'equipment-1' }]);
    gymEquipmentItem.count.mockResolvedValue(1);

    await repo.listEquipmentItems({ page: 2, limit: 10 });

    expect(gymEquipmentItem.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: [{ name: 'asc' }, { created_at: 'desc' }],
      include: {
        layout_nodes: {
          where: { is_active: true },
          select: { id: true },
        },
      },
      skip: 10,
      take: 10,
    });
    expect(gymEquipmentItem.count).toHaveBeenCalledWith({
      where: { is_active: true },
    });
  });

  it('loads a single equipment item with descending write-off history', async () => {
    gymEquipmentItem.findUnique.mockResolvedValue({ id: 'equipment-1' });

    await repo.findEquipmentItemByIdOrThrow('equipment-1');

    expect(gymEquipmentItem.findUnique).toHaveBeenCalledWith({
      where: { id: 'equipment-1' },
      include: {
        layout_nodes: {
          where: { is_active: true },
          select: { id: true },
        },
        write_offs: {
          orderBy: { created_at: 'desc' },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
              },
            },
            performer: {
              select: {
                id: true,
                profile: {
                  select: {
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        },
      },
      select: undefined,
    });
  });

  it('lists write-off history scoped to one equipment item', async () => {
    equipmentWriteOff.findMany.mockResolvedValue([{ id: 'writeoff-1' }]);
    equipmentWriteOff.count.mockResolvedValue(1);

    await repo.listWriteOffHistory('equipment-1', { page: 1, limit: 5 });

    expect(equipmentWriteOff.findMany).toHaveBeenCalledWith({
      where: { equipment_id: 'equipment-1' },
      orderBy: [{ created_at: 'desc' }],
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
          },
        },
        performer: {
          select: {
            id: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      skip: 0,
      take: 5,
    });
    expect(equipmentWriteOff.count).toHaveBeenCalledWith({
      where: { equipment_id: 'equipment-1' },
    });
  });

  it('writes off equipment by preserving quantity snapshots and updating current quantity', async () => {
    tx.gymEquipmentItem.findUnique.mockResolvedValue({
      id: 'equipment-1',
      quantity_current: 6,
    });
    tx.gymEquipmentItem.updateMany.mockResolvedValue({ count: 1 });
    tx.equipmentWriteOff.create.mockResolvedValue({ id: 'writeoff-1' });

    await repo.writeOffEquipment(
      'staff-1',
      'equipment-1',
      4,
      'Damaged equipment removed.',
    );

    expect(tx.gymEquipmentItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'equipment-1', quantity_current: 6 },
      data: { quantity_current: 4 },
    });
    expect(tx.equipmentWriteOff.create).toHaveBeenCalledWith({
      data: {
        quantity_before: 6,
        quantity_set_to: 4,
        quantity_lost: 2,
        reason: 'Damaged equipment removed.',
        equipment: { connect: { id: 'equipment-1' } },
        performer: { connect: { id: 'staff-1' } },
      },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
          },
        },
        performer: {
          select: {
            id: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  });

  it('rejects write-offs that try to increase equipment quantity', async () => {
    tx.gymEquipmentItem.findUnique.mockResolvedValue({
      id: 'equipment-1',
      quantity_current: 6,
    });

    await expect(
      repo.writeOffEquipment('staff-1', 'equipment-1', 7, 'Invalid write-off'),
    ).rejects.toBeInstanceOf(HttpException);

    expect(tx.gymEquipmentItem.updateMany).not.toHaveBeenCalled();
    expect(tx.equipmentWriteOff.create).not.toHaveBeenCalled();
  });

  it('throws when the equipment item does not exist', async () => {
    tx.gymEquipmentItem.findUnique.mockResolvedValue(null);

    await expect(
      repo.writeOffEquipment('staff-1', 'missing-equipment', 0, 'Missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects stale write-offs when the equipment quantity changed mid-transaction', async () => {
    tx.gymEquipmentItem.findUnique
      .mockResolvedValueOnce({
        id: 'equipment-1',
        quantity_current: 6,
      })
      .mockResolvedValueOnce({
        quantity_current: 4,
      });
    tx.gymEquipmentItem.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.writeOffEquipment(
        'staff-1',
        'equipment-1',
        2,
        'Damaged equipment removed.',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.equipmentWriteOff.create).not.toHaveBeenCalled();
  });

  it('moves only the requested quantity between status buckets atomically', async () => {
    tx.gymEquipmentItem.findUnique
      .mockResolvedValueOnce({
        id: 'equipment-1',
        quantity_total: 8,
        quantity_current: 6,
        quantity_maintenance: 1,
        quantity_broken: 0,
        quantity_missing: 1,
      })
      .mockResolvedValueOnce({
        id: 'equipment-1',
        quantity_total: 8,
        quantity_current: 4,
        quantity_maintenance: 3,
        quantity_broken: 0,
        quantity_missing: 1,
        layout_nodes: [],
      });
    tx.gymEquipmentItem.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repo.transitionEquipmentStatus('equipment-1', 'available', 'maintenance', 2),
    ).resolves.toEqual(
      expect.objectContaining({
        quantity_current: 4,
        quantity_maintenance: 3,
      }),
    );

    expect(tx.gymEquipmentItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'equipment-1',
        quantity_current: 6,
        quantity_maintenance: 1,
        quantity_broken: 0,
        quantity_missing: 1,
      },
      data: {
        quantity_current: 4,
        quantity_maintenance: 3,
        quantity_broken: 0,
        quantity_missing: 1,
      },
    });
  });

  it('rejects a transition larger than the selected source bucket', async () => {
    tx.gymEquipmentItem.findUnique.mockResolvedValue({
      id: 'equipment-1',
      quantity_total: 8,
      quantity_current: 6,
      quantity_maintenance: 1,
      quantity_broken: 0,
      quantity_missing: 1,
    });

    await expect(
      repo.transitionEquipmentStatus('equipment-1', 'maintenance', 'broken', 2),
    ).rejects.toBeInstanceOf(HttpException);
    expect(tx.gymEquipmentItem.updateMany).not.toHaveBeenCalled();
  });
});
