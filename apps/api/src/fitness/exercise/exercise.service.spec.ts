import { Test, TestingModule } from '@nestjs/testing';
import { ExerciseCategory, ProgressionIconKind } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

import { ActivityLevelService } from '../../user/activity-level.service';
import { ExerciseRepository } from './exercise.repository';
import { ExerciseService } from './exercise.service';
import { buildFallbackPoseMovementContract } from '../../../../../packages/utils/pose';

describe('ExerciseService', () => {
  let service: ExerciseService;

  const repo = {
    listExercises: jest.fn(),
    findActiveExerciseByIdOrThrow: jest.fn(),
    listActiveExercisesForGeneration: jest.fn(),
    listMuscleDefinitions: jest.fn(),
    listActiveMuscleDefinitions: jest.fn(),
    listActiveMuscleDefinitionsByKeys: jest.fn(),
    createMuscleDefinition: jest.fn(),
    updateMuscleDefinition: jest.fn(),
    createExercise: jest.fn(),
    updateExercise: jest.fn(),
    ensureAliasesAvailable: jest.fn(),
    findMovementFamilyById: jest.fn(),
    updateMovementFamilyContract: jest.fn(),
  };
  const activityLevelService = {
    recalculateForUser: jest.fn(),
  };

  const makeMuscleDefinition = (overrides: Record<string, unknown> = {}) => ({
    aliases: [],
    body_region: 'arms',
    created_at: new Date('2026-03-26T02:00:00.000Z'),
    id: 'muscle-1',
    icon_asset_key: null,
    icon_key: null,
    icon_kind: null,
    is_active: true,
    is_system: true,
    key: 'biceps',
    name: 'Biceps',
    sort_order: 10,
    updated_at: new Date('2026-03-26T03:00:00.000Z'),
    ...overrides,
  });

  const makeExercise = (overrides: Record<string, unknown> = {}) => ({
    aliases: [],
    id: 'exercise-1',
    name: 'Barbell Back Squat',
    muscle_group: 'legs',
    category: ExerciseCategory.strength,
    description: 'Compound lower-body movement.',
    instructions: 'Keep your chest up.',
    video_url: 'https://cdn.fittrack.test/videos/squat.mp4',
    image_url: 'https://cdn.fittrack.test/images/squat.png',
    is_active: true,
    hand_shape_profile: null,
    movement_family_id: null,
    movement_family: null,
    movement_profile: null,
    movement_profile_override: null,
    muscle_targets: [],
    tracking_mode: 'manual',
    created_at: new Date('2026-03-26T02:00:00.000Z'),
    updated_at: new Date('2026-03-26T03:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseService,
        { provide: ExerciseRepository, useValue: repo },
        { provide: ActivityLevelService, useValue: activityLevelService },
      ],
    }).compile();

    service = module.get<ExerciseService>(ExerciseService);
    jest.clearAllMocks();
    repo.listActiveMuscleDefinitionsByKeys.mockImplementation(
      (keys: string[]) =>
        keys.map((key) =>
          makeMuscleDefinition({
            body_region: key === 'core' ? 'core' : 'lower_body',
            id: `muscle-${key}`,
            key,
            name: key
              .split('_')
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' '),
          }),
        ),
    );
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
      hand_shape_profile: undefined,
      instructions: 'Keep your chest up.',
      movement_profile: undefined,
      movement_profile_override: undefined,
      video_url: 'https://cdn.fittrack.test/videos/squat.mp4',
      image_url: 'https://cdn.fittrack.test/images/squat.png',
    });

    expect(repo.createExercise).toHaveBeenCalledWith({
      name: 'Barbell Back Squat',
      tracking_mode: 'manual',
      muscle_group: 'legs',
      muscle_targets: [
        {
          allocationPercent: 100,
          muscleGroup: 'legs',
          role: 'primary',
        },
      ],
      category: ExerciseCategory.strength,
      description: 'Compound lower-body movement.',
      instructions: 'Keep your chest up.',
      video_url: 'https://cdn.fittrack.test/videos/squat.mp4',
      image_url: 'https://cdn.fittrack.test/images/squat.png',
    });
  });

  it('rejects exercise muscle effort totals that do not equal 100%', async () => {
    await expect(
      service.createExercise({
        name: 'Bad Curl',
        category: ExerciseCategory.strength,
        muscle_targets: [
          { allocationPercent: 70, muscleGroup: 'biceps', role: 'primary' },
          { allocationPercent: 20, muscleGroup: 'forearms', role: 'secondary' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.createExercise).not.toHaveBeenCalled();
  });

  it('rejects unknown or archived exercise muscle targets', async () => {
    repo.listActiveMuscleDefinitionsByKeys.mockResolvedValue([
      makeMuscleDefinition({ key: 'biceps', name: 'Biceps' }),
    ]);

    await expect(
      service.createExercise({
        name: 'Unknown Muscle Curl',
        category: ExerciseCategory.strength,
        muscle_targets: [
          { allocationPercent: 70, muscleGroup: 'biceps', role: 'primary' },
          {
            allocationPercent: 30,
            muscleGroup: 'ghost_muscle',
            role: 'secondary',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.createExercise).not.toHaveBeenCalled();
  });

  it('maps muscle definitions for the admin Muscle Library', async () => {
    repo.listMuscleDefinitions.mockResolvedValue([
      makeMuscleDefinition({
        aliases: ['arms'],
        body_region: 'upper_body',
        key: 'biceps',
        name: 'Biceps',
      }),
    ]);

    await expect(service.listMuscleDefinitions({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          aliases: ['arms'],
          body_region: 'upper_body',
          is_active: true,
          key: 'biceps',
          name: 'Biceps',
        }),
      ],
    });
  });

  it('maps only active member muscle definitions, including non-default keys', async () => {
    repo.listActiveMuscleDefinitions.mockResolvedValue([
      makeMuscleDefinition({ key: 'chest', name: 'Chest' }),
      makeMuscleDefinition({
        key: 'latissimus_dorsi',
        name: 'Latissimus Dorsi',
        is_active: true,
      }),
      makeMuscleDefinition({
        key: 'legacy_muscle',
        name: 'Legacy Muscle',
        is_active: false,
      }),
    ]);

    await expect(service.listMemberMuscleDefinitions()).resolves.toEqual({
      data: [
        expect.objectContaining({ key: 'chest', is_active: true }),
        expect.objectContaining({
          key: 'latissimus_dorsi',
          is_active: true,
        }),
      ],
    });
    expect(repo.listActiveMuscleDefinitions).toHaveBeenCalledWith();
  });

  it('creates canonical muscle definitions with normalized keys and aliases', async () => {
    repo.createMuscleDefinition.mockResolvedValue(
      makeMuscleDefinition({
        aliases: ['upper arm'],
        body_region: 'upper_body',
        icon_key: 'dumbbell',
        icon_kind: ProgressionIconKind.library,
        is_system: false,
        key: 'front_delts',
        name: 'Front Delts',
      }),
    );

    await expect(
      service.createMuscleDefinition({
        aliases: ['upper arm'],
        body_region: 'Upper Body',
        icon_asset_key: null,
        icon_key: 'dumbbell',
        icon_kind: ProgressionIconKind.library,
        key: 'Front Delts',
        name: 'Front Delts',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        aliases: ['upper arm'],
        body_region: 'upper_body',
        icon_asset_key: null,
        icon_key: 'dumbbell',
        icon_kind: ProgressionIconKind.library,
        is_system: false,
        key: 'front_delts',
        name: 'Front Delts',
      }),
    );

    expect(repo.createMuscleDefinition).toHaveBeenCalledWith({
      aliases: ['upper arm'],
      body_region: 'upper_body',
      icon_asset_key: null,
      icon_key: 'dumbbell',
      icon_kind: ProgressionIconKind.library,
      is_system: false,
      key: 'front_delts',
      name: 'Front Delts',
      sort_order: 500,
    });
  });

  it('updates and returns a managed muscle icon descriptor', async () => {
    repo.updateMuscleDefinition.mockResolvedValue(
      makeMuscleDefinition({
        icon_asset_key: 'uploads/muscles/front-delts.png',
        icon_key: null,
        icon_kind: ProgressionIconKind.custom,
      }),
    );

    await expect(
      service.updateMuscleDefinition('muscle-1', {
        icon_asset_key: 'uploads/muscles/front-delts.png',
        icon_key: null,
        icon_kind: ProgressionIconKind.custom,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        icon_asset_key: 'uploads/muscles/front-delts.png',
        icon_key: null,
        icon_kind: ProgressionIconKind.custom,
      }),
    );

    expect(repo.updateMuscleDefinition).toHaveBeenCalledWith('muscle-1', {
      icon_asset_key: 'uploads/muscles/front-delts.png',
      icon_key: null,
      icon_kind: ProgressionIconKind.custom,
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

    expect(repo.updateExercise).toHaveBeenCalledWith(
      'exercise-1',
      {
        is_active: false,
        image_url: 'https://cdn.fittrack.test/images/squat-v2.png',
      },
      undefined,
    );
    expect(repo.updateMovementFamilyContract).not.toHaveBeenCalled();
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

  it('increments only the shared family contract and reports inheriting exercises', async () => {
    const movementContract = buildFallbackPoseMovementContract('squat');
    if (!movementContract) throw new Error('squat contract missing');
    repo.updateMovementFamilyContract.mockResolvedValue({
      id: 'family-squat',
      key: 'squat',
      contract_revision: 3,
      exercises: [
        { id: 'inherit-1', name: 'Front Squat', tracking_mode: 'inherit' },
        { id: 'override-1', name: 'Goblet Squat', tracking_mode: 'override' },
        { id: 'manual-1', name: 'Historical Squat', tracking_mode: 'manual' },
      ],
    });

    await expect(
      service.updateMovementFamilyContract('family-squat', {
        movement_profile: {
          movementContract,
          rig: null,
          schemaVersion: 'exercise_movement_profile_v1',
          warnings: [],
        },
      }),
    ).resolves.toEqual({
      id: 'family-squat',
      key: 'squat',
      contract_revision: 3,
      affected_inheritors: [{ id: 'inherit-1', name: 'Front Squat' }],
    });
    expect(repo.updateMovementFamilyContract).toHaveBeenCalledTimes(1);
    expect(repo.updateExercise).not.toHaveBeenCalled();
  });

  it('keeps the family revision stable for a semantically identical contract', async () => {
    const movementContract = buildFallbackPoseMovementContract('squat');
    if (!movementContract) throw new Error('squat contract missing');
    const movementProfile = {
      movementContract,
      rig: null,
      schemaVersion: 'exercise_movement_profile_v1',
      warnings: [],
    };
    repo.findMovementFamilyById.mockResolvedValue({
      id: 'family-squat',
      key: 'squat',
      contract_revision: 6,
      base_movement_profile: {
        warnings: [],
        schemaVersion: 'exercise_movement_profile_v1',
        rig: null,
        movementContract,
      },
      base_hand_shape_profile: null,
      exercises: [
        { id: 'inherit-1', name: 'Front Squat', tracking_mode: 'inherit' },
        { id: 'override-1', name: 'Goblet Squat', tracking_mode: 'override' },
      ],
    });

    await expect(
      service.updateMovementFamilyContract('family-squat', {
        movement_profile: movementProfile,
      }),
    ).resolves.toEqual({
      id: 'family-squat',
      key: 'squat',
      contract_revision: 6,
      affected_inheritors: [{ id: 'inherit-1', name: 'Front Squat' }],
    });
    expect(repo.updateMovementFamilyContract).not.toHaveBeenCalled();
  });
});
