import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateEquipmentItemDTO,
  EquipmentWriteOffDTO,
  UpdateEquipmentItemDTO,
} from './equipment.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Equipment DTO validation', () => {
  it('requires a name for equipment item creation', async () => {
    const dto = plainToInstance(CreateEquipmentItemDTO, {
      quantity_total: 8,
      quantity_current: 6,
    });

    expect(extractMessages(await validate(dto))).toContain('name is required');
  });

  it('rejects negative current quantities on create', async () => {
    const dto = plainToInstance(CreateEquipmentItemDTO, {
      name: 'Adjustable Bench',
      quantity_total: 8,
      quantity_current: -1,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'quantity_current must be at least 0',
    );
  });

  it('accepts partial equipment updates', async () => {
    const dto = plainToInstance(UpdateEquipmentItemDTO, {
      unit: 'sets',
      is_active: false,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('requires a write-off reason and non-negative set-to quantity', async () => {
    const dto = plainToInstance(EquipmentWriteOffDTO, {
      quantity_set_to: -1,
    });

    expect(extractMessages(await validate(dto))).toEqual(
      expect.arrayContaining([
        'quantity_set_to must be at least 0',
        'reason is required',
      ]),
    );
  });
});
