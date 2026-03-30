import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ExerciseCategory, UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ExerciseController } from './exercise.controller';

function getGuardMetadata(
  methodName:
    | 'listExercises'
    | 'getExerciseById'
    | 'createExercise'
    | 'updateExercise',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    ExerciseController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'createExercise' | 'updateExercise',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    ExerciseController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('ExerciseController', () => {
  const exerciseService = {
    listExercises: jest.fn(),
    getExerciseById: jest.fn(),
    createExercise: jest.fn(),
    updateExercise: jest.fn(),
  };

  let controller: ExerciseController;

  beforeEach(() => {
    controller = new ExerciseController(exerciseService as never);
    jest.clearAllMocks();
  });

  it('protects exercise browse and detail routes with JWT auth', () => {
    expect(getGuardMetadata('listExercises')).toEqual([JwtAuthGuard]);
    expect(getGuardMetadata('getExerciseById')).toEqual([JwtAuthGuard]);
  });

  it('lists exercises through the service', async () => {
    exerciseService.listExercises.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listExercises({});

    expect(exerciseService.listExercises).toHaveBeenCalledWith({});
  });

  it.each(['createExercise', 'updateExercise'] as const)(
    'locks %s to admin users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
    },
  );

  it('creates exercises through the service', async () => {
    exerciseService.createExercise.mockResolvedValue({ id: 'exercise-1' });

    await controller.createExercise({
      name: 'Barbell Back Squat',
      muscle_group: 'legs',
      category: ExerciseCategory.strength,
    });

    expect(exerciseService.createExercise).toHaveBeenCalledWith({
      name: 'Barbell Back Squat',
      muscle_group: 'legs',
      category: ExerciseCategory.strength,
    });
  });
});
