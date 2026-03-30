import { Test, TestingModule } from '@nestjs/testing';
import { ExerciseCategory } from '@prisma/client';

import { ExerciseRepository } from './exercise.repository';
import { ExerciseService } from './exercise.service';

describe('ExerciseService', () => {
  let service: ExerciseService;

  const repo = {
    listExercises: jest.fn(),
    findActiveExerciseByIdOrThrow: jest.fn(),
    listActiveExercisesForGeneration: jest.fn(),
    createExercise: jest.fn(),
    updateExercise: jest.fn(),
  };

  const makeExercise = (overrides: Record<string, unknown> = {}) => ({
    id: 'exercise-1',
    name: 'Barbell Back Squat',
    muscle_group: 'legs',
    category: ExerciseCategory.strength,
    description: 'Compound lower-body movement.',
    instructions: 'Keep your chest up.',
    video_url: 'https://cdn.fittrack.test/videos/squat.mp4',
    image_url: 'https://cdn.fittrack.test/images/squat.png',
    is_active: true,
    created_at: new Date('2026-03-26T02:00:00.000Z'),
    updated_at: new Date('2026-03-26T03:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseService,
        { provide: ExerciseRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<ExerciseService>(ExerciseService);
    jest.clearAllMocks();
  });

  it('maps paginated exercises to response DTOs', async () => {
    repo.listExercises.mockResolvedValue({
      data: [makeExercise()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listExercises({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'exercise-1',
          name: 'Barbell Back Squat',
          created_at: '2026-03-26T02:00:00.000Z',
          updated_at: '2026-03-26T03:00:00.000Z',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('creates exercises with the documented DTO fields', async () => {
    repo.createExercise.mockResolvedValue(makeExercise());

    await service.createExercise({
      name: 'Barbell Back Squat',
      muscle_group: 'legs',
      category: ExerciseCategory.strength,
      description: 'Compound lower-body movement.',
      instructions: 'Keep your chest up.',
      video_url: 'https://cdn.fittrack.test/videos/squat.mp4',
      image_url: 'https://cdn.fittrack.test/images/squat.png',
    });

    expect(repo.createExercise).toHaveBeenCalledWith({
      name: 'Barbell Back Squat',
      muscle_group: 'legs',
      category: ExerciseCategory.strength,
      description: 'Compound lower-body movement.',
      instructions: 'Keep your chest up.',
      video_url: 'https://cdn.fittrack.test/videos/squat.mp4',
      image_url: 'https://cdn.fittrack.test/images/squat.png',
    });
  });

  it('updates only fields provided in the DTO', async () => {
    repo.updateExercise.mockResolvedValue(
      makeExercise({ is_active: false, instructions: null }),
    );

    await service.updateExercise('exercise-1', {
      is_active: false,
      instructions: undefined,
      image_url: 'https://cdn.fittrack.test/images/squat-v2.png',
    });

    expect(repo.updateExercise).toHaveBeenCalledWith('exercise-1', {
      is_active: false,
      image_url: 'https://cdn.fittrack.test/images/squat-v2.png',
    });
  });

  it('loads a single active exercise by id', async () => {
    repo.findActiveExerciseByIdOrThrow.mockResolvedValue(makeExercise());

    await expect(service.getExerciseById('exercise-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'exercise-1',
        category: ExerciseCategory.strength,
      }),
    );
  });

  it('exposes the active generation catalog without reshaping it', async () => {
    repo.listActiveExercisesForGeneration.mockResolvedValue([
      {
        id: 'exercise-1',
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: ExerciseCategory.strength,
      },
    ]);

    await expect(service.listActiveExercisesForGeneration()).resolves.toEqual([
      {
        id: 'exercise-1',
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: ExerciseCategory.strength,
      },
    ]);
  });
});
