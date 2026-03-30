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

  const prisma = {
    exerciseCatalog,
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
});
