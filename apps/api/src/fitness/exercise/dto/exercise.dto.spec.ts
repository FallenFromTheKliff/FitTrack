import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateExerciseDTO,
  ExerciseFilterDTO,
  UpdateMovementFamilyContractDTO,
  UpdateExerciseDTO,
} from './exercise.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Exercise DTO validation', () => {
  it('requires a name for exercise creation', async () => {
    const dto = plainToInstance(CreateExerciseDTO, {
      muscle_group: 'legs',
      category: 'strength',
    });

    expect(extractMessages(await validate(dto))).toContain('name is required');
  });

  it('requires a muscle group for exercise creation', async () => {
    const dto = plainToInstance(CreateExerciseDTO, {
      name: 'Barbell Back Squat',
      category: 'strength',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'muscle_group is required',
    );
  });

  it('rejects invalid exercise categories', async () => {
    const dto = plainToInstance(CreateExerciseDTO, {
      name: 'Barbell Back Squat',
      muscle_group: 'legs',
      category: 'power',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'category must be one of: strength, cardio, flexibility, balance',
    );
  });

  it('accepts partial exercise updates', async () => {
    const dto = plainToInstance(UpdateExerciseDTO, {
      is_active: false,
      image_url: 'https://cdn.fittrack.test/images/squat.png',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('validates exercise browse filters', async () => {
    const dto = plainToInstance(ExerciseFilterDTO, {
      page: 2,
      limit: 10,
      category: 'strength',
      search: 'squat',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts the documented movement-family contract object', async () => {
    const dto = plainToInstance(UpdateMovementFamilyContractDTO, {
      movement_profile: {
        movementContract: { exercise: 'squat' },
        schemaVersion: 'exercise_movement_profile_v1',
      },
    });

    expect(
      await validate(dto, { forbidNonWhitelisted: true, whitelist: true }),
    ).toHaveLength(0);
  });

  it('rejects a non-object movement-family contract', async () => {
    const dto = plainToInstance(UpdateMovementFamilyContractDTO, {
      movement_profile: 'squat',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'movement_profile must be an object',
    );
  });
});
