import { NotFoundException } from '@nestjs/common';
import { ExerciseCategory } from '@prisma/client';

import { ExerciseRepository } from './exercise.repository';

describe('ExerciseRepository', () => {
  const exerciseCatalog = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const muscleDefinition = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    exerciseCatalog,
    muscleDefinition,
    $transaction: jest.fn(),
  };

  let repo: ExerciseRepository;

  beforeEach(() => {
    repo = new ExerciseRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists active exercises with the requested filters', async () => {
    exerciseCatalog.findMany.mockResolvedValue([{ id: 'exercise-1' }]);
    exerciseCatalog.count.mockResolvedValue(1);

    await repo.listExercises({
      page: 2,
      limit: 10,
      muscle_group: 'legs',
      category: ExerciseCategory.strength,
      search: 'squat',
    });

    expect(exerciseCatalog.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
        muscle_group: {
          contains: 'legs',
          mode: 'insensitive',
        },
        category: ExerciseCategory.strength,
        OR: [
          { name: { contains: 'squat', mode: 'insensitive' } },
          { muscle_group: { contains: 'squat', mode: 'insensitive' } },
          { description: { contains: 'squat', mode: 'insensitive' } },
          { instructions: { contains: 'squat', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ muscle_group: 'asc' }, { name: 'asc' }],
      skip: 10,
      take: 10,
    });
    expect(exerciseCatalog.count).toHaveBeenCalledWith({
      where: {
        is_active: true,
        muscle_group: {
          contains: 'legs',
          mode: 'insensitive',
        },
        category: ExerciseCategory.strength,
        OR: [
          { name: { contains: 'squat', mode: 'insensitive' } },
          { muscle_group: { contains: 'squat', mode: 'insensitive' } },
          { description: { contains: 'squat', mode: 'insensitive' } },
          { instructions: { contains: 'squat', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('loads a single active exercise by id', async () => {
    exerciseCatalog.findFirst.mockResolvedValue({ id: 'exercise-1' });

    await repo.findActiveExerciseByIdOrThrow('exercise-1');

    expect(exerciseCatalog.findFirst).toHaveBeenCalledWith({
      where: { id: 'exercise-1', is_active: true },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('throws when an active exercise cannot be found by id', async () => {
    exerciseCatalog.findFirst.mockResolvedValue(null);

    await expect(
      repo.findActiveExerciseByIdOrThrow('missing-exercise'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists active muscle definitions by default', async () => {
    muscleDefinition.findMany.mockResolvedValue([{ id: 'muscle-1' }]);

    await repo.listMuscleDefinitions({});

    expect(muscleDefinition.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  });

  it('searches muscle definitions across key, name, and body region', async () => {
    muscleDefinition.findMany.mockResolvedValue([{ id: 'muscle-1' }]);

    await repo.listMuscleDefinitions({
      include_archived: true,
      search: 'delt',
    });

    expect(muscleDefinition.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { key: { contains: 'delt', mode: 'insensitive' } },
          { name: { contains: 'delt', mode: 'insensitive' } },
          { body_region: { contains: 'delt', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  });

  it('loads active muscle definitions by key for exercise validation', async () => {
    muscleDefinition.findMany.mockResolvedValue([{ id: 'muscle-1' }]);

    await repo.listActiveMuscleDefinitionsByKeys(['biceps']);

    expect(muscleDefinition.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
        key: { in: ['biceps'] },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  });
});
