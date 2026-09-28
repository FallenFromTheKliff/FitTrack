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
  const exerciseAlias = {
    findMany: jest.fn(),
  };
  const exerciseMovementFamily = {
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };

  const prisma = {
    exerciseCatalog,
    exerciseAlias,
    exerciseMovementFamily,
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
      include: {
        aliases: { orderBy: [{ normalized_label: 'asc' }] },
        movement_family: {
          include: {
            exercises: {
              select: { id: true, tracking_mode: true },
              where: { is_active: true },
            },
          },
        },
      },
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
      include: {
        aliases: { orderBy: [{ normalized_label: 'asc' }] },
        movement_family: {
          include: {
            exercises: {
              select: { id: true, tracking_mode: true },
              where: { is_active: true },
            },
          },
        },
      },
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

  it('lists only active muscle definitions for the member catalog', async () => {
    muscleDefinition.findMany.mockResolvedValue([{ id: 'muscle-1' }]);

    await repo.listActiveMuscleDefinitions();

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

  it('increments the family revision atomically when its shared contract changes', async () => {
    prisma.$transaction.mockImplementation(async callback => callback(prisma));
    exerciseMovementFamily.updateMany.mockResolvedValue({ count: 1 });
    exerciseMovementFamily.findUniqueOrThrow.mockResolvedValue({ id: 'family-squat' });

    await repo.updateMovementFamilyContract('family-squat', {
      schemaVersion: 'exercise_movement_profile_v1',
    }, undefined, 3);

    expect(exerciseMovementFamily.updateMany).toHaveBeenCalledWith({
      where: { id: 'family-squat', is_active: true, contract_revision: 3 },
      data: {
        base_movement_profile: {
          schemaVersion: 'exercise_movement_profile_v1',
        },
        contract_revision: { increment: 1 },
      },
    });
    expect(exerciseMovementFamily.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'family-squat' },
      include: {
        exercises: {
          where: { is_active: true },
          select: { id: true, name: true, tracking_mode: true },
        },
      },
    });
    expect(exerciseCatalog.update).not.toHaveBeenCalled();
  });
});
