import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EquipmentStatus, UserStatus } from '@prisma/client';
import type { Socket } from 'socket.io';

import { GymLayoutRepository } from './gym-layout.repository';
import { GymLayoutService } from './gym-layout.service';

describe('GymLayoutService', () => {
  let service: GymLayoutService;

  const repo = {
    listActiveEquipment: jest.fn(),
    listArchivedEquipment: jest.fn(),
    createEquipment: jest.fn(),
    findActiveVenueByIdOrThrow: jest.fn(),
    findEquipmentByIdOrThrow: jest.fn(),
    updateEquipment: jest.fn(),
    softDeleteEquipment: jest.fn(),
    restoreEquipment: jest.fn(),
  };

  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'jwt.secret' ? 'jwt-secret' : (fallback ?? ''),
    ),
  };

  const redis = {
    del: jest.fn(),
    get: jest.fn(),
    hdel: jest.fn(),
    hgetall: jest.fn(),
    hset: jest.fn(),
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GymLayoutService,
        { provide: GymLayoutRepository, useValue: repo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<GymLayoutService>(GymLayoutService);
    jest.clearAllMocks();
  });

  it('authenticates socket tokens and mirrors HTTP guard blacklist checks', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      role: 'member',
      status: UserStatus.active,
      jti: 'jti-1',
    });
    redis.get.mockResolvedValue(null);

    await expect(
      service.authenticateSocket({
        handshake: {
          auth: { token: 'Bearer token-1' },
          headers: {},
          query: {},
        },
      } as Socket),
    ).resolves.toEqual(
      expect.objectContaining({
        sub: 'user-1',
        status: UserStatus.active,
      }),
    );

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-1', {
      secret: 'jwt-secret',
    });
    expect(redis.get).toHaveBeenCalledWith('token_blacklist:jti-1');
  });

  it('lists equipment with decimal positions mapped to numbers', async () => {
    repo.listActiveEquipment.mockResolvedValue([
      {
        id: 'equipment-1',
        floor_id: 'floor-1',
        grid_column: 10,
        grid_row: 4,
        name: 'Leg Press Station',
        type: 'strength',
        position_x: { toString: () => '67.86' },
        position_y: { toString: () => '35' },
        status: EquipmentStatus.available,
        icon_key: null,
        is_active: true,
        created_at: new Date('2026-03-27T02:00:00.000Z'),
        updated_at: new Date('2026-03-27T03:00:00.000Z'),
      },
    ]);

    await expect(service.listEquipment()).resolves.toEqual([
      {
        id: 'equipment-1',
        floor_id: 'floor-1',
        grid_column: 10,
        grid_row: 4,
        name: 'Leg Press Station',
        type: 'strength',
        position_x: 67.86,
        position_y: 35,
        grid_width: null,
        grid_height: null,
        inventory_item_id: null,
        venue_id: null,
        image_url: null,
        placed_quantity: 0,
        remaining_placeable_quantity: null,
        status: EquipmentStatus.available,
        icon_key: null,
        is_active: true,
        created_at: '2026-03-27T02:00:00.000Z',
        updated_at: '2026-03-27T03:00:00.000Z',
      },
    ]);
  });

  it('lists archived equipment with decimal positions mapped to numbers', async () => {
    repo.listArchivedEquipment.mockResolvedValue([
      {
        id: 'equipment-1',
        floor_id: 'floor-1',
        grid_column: 10,
        grid_row: 4,
        name: 'Leg Press Station',
        type: 'strength',
        position_x: { toString: () => '67.86' },
        position_y: { toString: () => '35' },
        status: EquipmentStatus.available,
        icon_key: null,
        is_active: false,
        created_at: new Date('2026-03-27T02:00:00.000Z'),
        updated_at: new Date('2026-03-27T03:00:00.000Z'),
      },
    ]);

    await expect(service.listArchivedEquipment()).resolves.toEqual([
      expect.objectContaining({
        id: 'equipment-1',
        is_active: false,
        position_x: 67.86,
        position_y: 35,
      }),
    ]);
  });

  it('hydrates the Redis status cache when the realtime snapshot is cold', async () => {
    repo.listActiveEquipment.mockResolvedValue([
      {
        id: 'equipment-1',
        floor_id: 'floor-1',
        grid_column: 10,
        grid_row: 4,
        name: 'Leg Press Station',
        type: 'strength',
        position_x: { toString: () => '67.86' },
        position_y: { toString: () => '35' },
        status: EquipmentStatus.occupied,
        icon_key: null,
        is_active: true,
        created_at: new Date('2026-03-27T02:00:00.000Z'),
        updated_at: new Date('2026-03-27T03:00:00.000Z'),
      },
    ]);
    redis.hgetall.mockResolvedValueOnce({}).mockResolvedValueOnce({
      'equipment-1': EquipmentStatus.occupied,
    });
    redis.del.mockResolvedValue(1);
    redis.hset.mockResolvedValue(1);

    await expect(service.getRealtimeSnapshot()).resolves.toEqual([
      {
        id: 'equipment-1',
        floor_id: 'floor-1',
        grid_column: 10,
        grid_row: 4,
        name: 'Leg Press Station',
        type: 'strength',
        position_x: 67.86,
        position_y: 35,
        grid_width: null,
        grid_height: null,
        inventory_item_id: null,
        venue_id: null,
        image_url: null,
        placed_quantity: 0,
        remaining_placeable_quantity: null,
        status: EquipmentStatus.occupied,
        icon_key: null,
        is_active: true,
        created_at: '2026-03-27T02:00:00.000Z',
        updated_at: '2026-03-27T03:00:00.000Z',
      },
    ]);

    expect(redis.del).toHaveBeenCalledWith('equipment_status');
    expect(redis.hset).toHaveBeenCalledWith(
      'equipment_status',
      'equipment-1',
      EquipmentStatus.occupied,
    );
  });

  it('creates equipment with the default available status', async () => {
    repo.findActiveVenueByIdOrThrow.mockResolvedValue({
      floor_id: 'floor-1',
      grid_column: 1,
      grid_row: 1,
      grid_width: 20,
      grid_height: 20,
    });
    repo.createEquipment.mockResolvedValue({
      id: 'equipment-1',
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 67.86,
      position_y: 35,
      status: EquipmentStatus.available,
      icon_key: null,
      is_active: true,
      created_at: new Date('2026-03-27T02:00:00.000Z'),
      updated_at: new Date('2026-03-27T03:00:00.000Z'),
    });
    redis.hset.mockResolvedValue(1);
    redis.publish.mockResolvedValue(1);

    await service.createEquipment({
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      inventory_item_id: '22222222-2222-4222-8222-222222222222',
      venue_id: '33333333-3333-4333-8333-333333333333',
    });

    expect(repo.createEquipment).toHaveBeenCalledWith({
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      inventory_item: {
        connect: { id: '22222222-2222-4222-8222-222222222222' },
      },
      venue: {
        connect: { id: '33333333-3333-4333-8333-333333333333' },
      },
      grid_width: 1,
      grid_height: 1,
      position_x: 67.86,
      position_y: 35,
      status: EquipmentStatus.available,
      icon_key: null,
    });
    expect(redis.publish).toHaveBeenCalledWith(
      'equipment:status',
      expect.stringContaining('"operation":"upsert"'),
    );
  });

  it('updates only fields provided in the DTO', async () => {
    repo.findEquipmentByIdOrThrow.mockResolvedValue({
      id: 'equipment-1',
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      position_x: { toString: () => '67.86' },
      position_y: { toString: () => '35' },
      status: EquipmentStatus.available,
      icon_key: 'leg-press',
      is_active: true,
      created_at: new Date('2026-03-27T02:00:00.000Z'),
      updated_at: new Date('2026-03-27T03:00:00.000Z'),
    });
    repo.updateEquipment.mockResolvedValue({
      id: 'equipment-1',
      floor_id: 'floor-2',
      grid_column: 11,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 75,
      position_y: 35,
      status: EquipmentStatus.maintenance,
      icon_key: 'leg-press',
      is_active: true,
      created_at: new Date('2026-03-27T02:00:00.000Z'),
      updated_at: new Date('2026-03-27T03:00:00.000Z'),
    });
    redis.hset.mockResolvedValue(1);
    redis.publish.mockResolvedValue(1);

    await service.updateEquipment('equipment-1', {
      grid_column: 11,
      status: EquipmentStatus.maintenance,
    });

    expect(repo.updateEquipment).toHaveBeenCalledWith('equipment-1', {
      grid_column: 11,
      grid_row: 4,
      position_x: 75,
      position_y: 35,
      status: EquipmentStatus.maintenance,
    });
    expect(redis.hset).toHaveBeenCalledWith(
      'equipment_status',
      'equipment-1',
      EquipmentStatus.maintenance,
    );
  });

  it('soft-deletes equipment through the repository', async () => {
    repo.softDeleteEquipment.mockResolvedValue({
      id: 'equipment-1',
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 67.86,
      position_y: 35,
      status: EquipmentStatus.available,
      icon_key: null,
      is_active: false,
      created_at: new Date('2026-03-27T02:00:00.000Z'),
      updated_at: new Date('2026-03-27T03:00:00.000Z'),
    });
    redis.hdel.mockResolvedValue(1);
    redis.publish.mockResolvedValue(1);

    await service.deleteEquipment('equipment-1');

    expect(repo.softDeleteEquipment).toHaveBeenCalledWith('equipment-1');
    expect(redis.hdel).toHaveBeenCalledWith('equipment_status', 'equipment-1');
    expect(redis.publish).toHaveBeenCalledWith(
      'equipment:status',
      expect.stringContaining('"operation":"remove"'),
    );
  });

  it('restores equipment through the repository and realtime cache', async () => {
    repo.restoreEquipment.mockResolvedValue({
      id: 'equipment-1',
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 4,
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 67.86,
      position_y: 35,
      status: EquipmentStatus.available,
      icon_key: null,
      is_active: true,
      created_at: new Date('2026-03-27T02:00:00.000Z'),
      updated_at: new Date('2026-03-27T03:00:00.000Z'),
    });
    redis.hset.mockResolvedValue(1);
    redis.publish.mockResolvedValue(1);

    await service.restoreEquipment('equipment-1');

    expect(repo.restoreEquipment).toHaveBeenCalledWith('equipment-1');
    expect(redis.hset).toHaveBeenCalledWith(
      'equipment_status',
      'equipment-1',
      EquipmentStatus.available,
    );
    expect(redis.publish).toHaveBeenCalledWith(
      'equipment:status',
      expect.stringContaining('"operation":"upsert"'),
    );
  });
});
