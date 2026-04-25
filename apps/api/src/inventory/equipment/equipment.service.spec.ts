import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

describe('EquipmentService', () => {
  let service: EquipmentService;

  const repo = {
    listEquipmentItems: jest.fn(),
    findEquipmentItemByIdOrThrow: jest.fn(),
    findEquipmentItemRecordByIdOrThrow: jest.fn(),
    createEquipmentItem: jest.fn(),
    updateEquipmentItem: jest.fn(),
    listWriteOffHistory: jest.fn(),
    writeOffEquipment: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue([]),
  };

  const makeEquipment = (overrides: Record<string, unknown> = {}) => ({
    id: 'equipment-1',
    name: 'Adjustable Bench',
    description: 'Commercial-grade incline and flat workout bench.',
    quantity_total: 8,
    quantity_current: 6,
    unit: 'units',
    is_active: true,
    created_at: new Date('2026-03-27T02:00:00.000Z'),
    updated_at: new Date('2026-03-27T03:00:00.000Z'),
    ...overrides,
  });

  const makeWriteOff = (overrides: Record<string, unknown> = {}) => ({
    id: 'writeoff-1',
    equipment_id: 'equipment-1',
    quantity_before: 6,
    quantity_set_to: 4,
    quantity_lost: 2,
    reason: 'Damaged equipment removed.',
    performed_by: 'staff-1',
    equipment: {
      id: 'equipment-1',
      name: 'Adjustable Bench',
    },
    performer: {
      id: 'staff-1',
      profile: {
        first_name: 'Morgan',
        last_name: 'Reyes',
      },
    },
    created_at: new Date('2026-03-27T04:00:00.000Z'),
    updated_at: new Date('2026-03-27T04:05:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: EquipmentRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<EquipmentService>(EquipmentService);
    jest.clearAllMocks();
  });

  it('maps equipment items to paginated response DTOs', async () => {
    repo.listEquipmentItems.mockResolvedValue({
      data: [makeEquipment()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listEquipmentItems({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'equipment-1',
          quantity_total: 8,
          quantity_current: 6,
          created_at: '2026-03-27T02:00:00.000Z',
          updated_at: '2026-03-27T03:00:00.000Z',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('returns a detail payload with nested write-off history', async () => {
    repo.findEquipmentItemByIdOrThrow.mockResolvedValue({
      ...makeEquipment(),
      write_offs: [makeWriteOff()],
    });

    await expect(service.getEquipmentItemById('equipment-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'equipment-1',
        write_offs: [
          expect.objectContaining({
            id: 'writeoff-1',
            quantity_lost: 2,
            performer: {
              id: 'staff-1',
              first_name: 'Morgan',
              last_name: 'Reyes',
            },
          }),
        ],
      }),
    );
  });

  it('rejects creation when current quantity exceeds total quantity', async () => {
    await expect(
      service.createEquipmentItem('admin-1', {
        name: 'Adjustable Bench',
        quantity_total: 4,
        quantity_current: 5,
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('creates equipment with the default unit when omitted', async () => {
    repo.createEquipmentItem.mockResolvedValue(makeEquipment());

    await service.createEquipmentItem('admin-1', {
      name: 'Adjustable Bench',
      quantity_total: 8,
      quantity_current: 6,
    });

    expect(repo.createEquipmentItem).toHaveBeenCalledWith({
      name: 'Adjustable Bench',
      description: null,
      image_url: null,
      quantity_total: 8,
      quantity_current: 6,
      unit: 'units',
    });
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'inventory.activity',
      expect.objectContaining({
        action: 'equipment_created',
        actorId: 'admin-1',
        entityName: 'Adjustable Bench',
      }),
    );
  });

  it('updates only the provided equipment fields', async () => {
    repo.updateEquipmentItem.mockResolvedValue(
      makeEquipment({ unit: 'sets', is_active: false }),
    );

    await service.updateEquipmentItem('admin-1', 'equipment-1', {
      unit: 'sets',
      is_active: false,
      description: undefined,
    });

    expect(repo.updateEquipmentItem).toHaveBeenCalledWith('equipment-1', {
      unit: 'sets',
      is_active: false,
    });
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'inventory.activity',
      expect.objectContaining({
        action: 'equipment_updated',
        actorId: 'admin-1',
        entityId: 'equipment-1',
      }),
    );
  });

  it('writes off equipment through the repository contract', async () => {
    repo.writeOffEquipment.mockResolvedValue(makeWriteOff());

    await expect(
      service.writeOffEquipment('staff-1', 'equipment-1', {
        quantity_set_to: 4,
        reason: 'Damaged equipment removed.',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'writeoff-1',
        quantity_before: 6,
        quantity_set_to: 4,
        quantity_lost: 2,
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'staff-1',
        entityId: 'equipment-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'inventory.equipment.write-off',
      expect.objectContaining({
        equipmentId: 'equipment-1',
        equipmentName: 'Adjustable Bench',
      }),
    );
  });

  it('loads paginated write-off history after asserting equipment existence', async () => {
    repo.findEquipmentItemRecordByIdOrThrow.mockResolvedValue(makeEquipment());
    repo.listWriteOffHistory.mockResolvedValue({
      data: [makeWriteOff()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getWriteOffHistory('equipment-1', { page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'writeoff-1',
          performer: {
            id: 'staff-1',
            first_name: 'Morgan',
            last_name: 'Reyes',
          },
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });
});
