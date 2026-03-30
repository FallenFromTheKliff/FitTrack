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
  it('requires a name for equipment creation', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      type: 'strength',
      position_x: 12.5,
      position_y: 7.25,
    });

    expect(extractMessages(await validate(dto))).toContain('name is required');
  });

  it('requires numeric map positions on create', async () => {
    const dto = plainToInstance(CreateEquipmentDTO, {
      name: 'Leg Press Station',
      type: 'strength',
      position_x: 'left',
      position_y: 'front',
    });

    expect(extractMessages(await validate(dto))).toEqual(
      expect.arrayContaining([
        'position_x must be a number',
        'position_y must be a number',
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
      'status must be one of: available, occupied, maintenance',
    );
  });
});
