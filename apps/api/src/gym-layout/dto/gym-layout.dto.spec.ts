import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EquipmentStatus } from '@prisma/client';

import { CreateEquipmentDTO, UpdateEquipmentDTO } from './gym-layout.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('GymLayout DTO validation', () => {
  const seededInventoryItemId = '43f0116a-2f44-5c3c-b5cd-7b72641e84fa';
  const seededVenueId = '80c9ad4f-3d8e-586b-8d53-bb12d74fe83f';

  it('requires a name for equipment creation', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      floor_id: 'floor-1',
      type: 'strength',
      grid_column: 4,
      grid_row: 3,
    });

    expect(extractMessages(await validate(dto))).toContain('name is required');
  });

  it('accepts sparse placement coordinates beyond the legacy 14 x 10 floor', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      floor_id: 'floor-1',
      name: 'Leg Press Station',
      type: 'strength',
      grid_column: 999,
      grid_row: 999,
      inventory_item_id: seededInventoryItemId,
      venue_id: seededVenueId,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects placement coordinates beyond the sparse planning safety range', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      floor_id: 'floor-1',
      name: 'Leg Press Station',
      type: 'strength',
      grid_column: 1001,
      grid_row: 1001,
    });

    expect(extractMessages(await validate(dto))).toEqual(
      expect.arrayContaining([
        'grid_column must be at most 1000',
        'grid_row must be at most 1000',
      ]),
    );
  });

  it('requires a supported floor on create', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      floor_id: 'basement',
      name: 'Leg Press Station',
      type: 'strength',
      grid_column: 4,
      grid_row: 3,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'floor_id must be one of: floor-1, floor-2, floor-3',
    );
  });

  it('accepts seeded UUIDv5 links for placement creation', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      floor_id: 'floor-1',
      grid_column: 4,
      grid_row: 3,
      inventory_item_id: seededInventoryItemId,
      name: 'Leg Press Station',
      type: 'strength',
      venue_id: seededVenueId,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts seeded UUIDv5 links for placement updates', async () => {
    const dto = plainToInstance(UpdateEquipmentDTO, {
      grid_column: 5,
      grid_row: 4,
      inventory_item_id: seededInventoryItemId,
      venue_id: seededVenueId,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects malformed placement link identifiers', async () => {
    const dto = plainToInstance(UpdateEquipmentDTO, {
      inventory_item_id: 'inventory-item-1',
      venue_id: 'venue-1',
    });

    expect(extractMessages(await validate(dto))).toEqual(
      expect.arrayContaining([
        'inventory_item_id must be a UUID',
        'venue_id must be a UUID',
      ]),
    );
  });

  it('accepts partial equipment updates', async () => {
    const dto = plainToInstance(UpdateEquipmentDTO, {
      status: EquipmentStatus.maintenance,
      is_active: false,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unsupported equipment statuses', async () => {
    const dto = plainToInstance(UpdateEquipmentDTO, {
      status: 'offline',
    });

    expect(extractMessages(await validate(dto))).toContain(
      `status must be one of: ${Object.values(EquipmentStatus).join(', ')}`,
    );
  });
});
