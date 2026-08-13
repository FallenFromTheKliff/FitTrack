import { Test, TestingModule } from '@nestjs/testing';
import {
  CreatorState,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
  MembershipCardStatus,
  UserRole,
} from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExerciseRepository } from './exercise.repository';
import { ExerciseService } from './exercise.service';

describe('ExerciseService', () => {
  let service: ExerciseService;

  const repo = {
    listExercises: jest.fn(),
    findActiveExerciseByIdOrThrow: jest.fn(),
    listActiveExercisesForGeneration: jest.fn(),
    listCreatorProfilesByUserIds: jest.fn(),
    listCreatorUserIdentitiesByUserIds: jest.fn(),
    listReviewSubmissionStatusesByUserIds: jest.fn(),
    listReviewSubmissions: jest.fn(),
    listMuscleDefinitions: jest.fn(),
    listActiveMuscleDefinitions: jest.fn(),
    listActiveMuscleDefinitionsByKeys: jest.fn(),
    createMuscleDefinition: jest.fn(),
    updateMuscleDefinition: jest.fn(),
    createExercise: jest.fn(),
    createReviewSubmission: jest.fn(),
    findCreatorSubmissionAccess: jest.fn(),
    findPoseSessionOwner: jest.fn(),
    updateExercise: jest.fn(),
    updateReviewSubmission: jest.fn(),
  };
  const config = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  };
  const originalFetch = global.fetch;

  const makeMuscleDefinition = (
    overrides: Record<string, unknown> = {},
  ) => ({
    aliases: [],
    body_region: 'arms',
    created_at: new Date('2026-03-26T02:00:00.000Z'),
    id: 'muscle-1',
    is_active: true,
    is_system: true,
    key: 'biceps',
    name: 'Biceps',
    sort_order: 10,
    updated_at: new Date('2026-03-26T03:00:00.000Z'),
    ...overrides,
  });

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

  const makeReviewSubmission = (overrides: Record<string, unknown> = {}) => ({
    id: 'submission-1',
    user_id: 'member-1',
    pose_session_id: null,
    published_exercise_id: null,
    status: ExerciseReviewSubmissionStatus.pending,
    source_label: 'detected unknown movement',
    origin_label: 'client custom',
    queue_tag: 'needs match',
    trigger_label: 'unknown after 3 reps',
    title: 'Rotational press pattern',
    proposed_name: 'Standing rotational press',
    summary: 'Client trace / detected unknown movement',
    match_hint: 'landmine press',
    category: ExerciseCategory.strength,
    muscle_group: 'shoulders',
    description: 'Standing press pattern with torso rotation.',
    instructions: 'Brace, rotate, and press with control.',
    evidence_bars: [24, 38, 62],
    review_notes: null,
    created_at: new Date('2026-04-22T02:00:00.000Z'),
    updated_at: new Date('2026-04-22T03:00:00.000Z'),
    reviewed_at: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseService,
        { provide: ExerciseRepository, useValue: repo },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<ExerciseService>(ExerciseService);
    jest.clearAllMocks();
    config.get.mockImplementation((_key: string, fallback?: unknown) => fallback);
    repo.listActiveMuscleDefinitionsByKeys.mockImplementation(
      async (keys: string[]) =>
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
    repo.listCreatorUserIdentitiesByUserIds.mockResolvedValue([]);
    global.fetch = originalFetch;
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
          { allocationPercent: 30, muscleGroup: 'ghost_muscle', role: 'secondary' },
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
        is_system: false,
        key: 'front_delts',
        name: 'Front Delts',
      }),
    );

    await expect(
      service.createMuscleDefinition({
        aliases: ['upper arm'],
        body_region: 'Upper Body',
        key: 'Front Delts',
        name: 'Front Delts',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        aliases: ['upper arm'],
        body_region: 'upper_body',
        is_system: false,
        key: 'front_delts',
        name: 'Front Delts',
      }),
    );

    expect(repo.createMuscleDefinition).toHaveBeenCalledWith({
      aliases: ['upper arm'],
      body_region: 'upper_body',
      is_system: false,
      key: 'front_delts',
      name: 'Front Delts',
      sort_order: 500,
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

  it('enriches review submissions with creator context', async () => {
    repo.listReviewSubmissions.mockResolvedValue({
      data: [makeReviewSubmission()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    repo.listCreatorProfilesByUserIds.mockResolvedValue([
      {
        user_id: 'member-1',
        state: CreatorState.candidate,
        admin_notes: 'Two clean custom submissions.',
        last_state_changed_at: new Date('2026-04-22T04:00:00.000Z'),
        updated_at: new Date('2026-04-22T05:00:00.000Z'),
      },
    ]);
    repo.listReviewSubmissionStatusesByUserIds.mockResolvedValue([
      { user_id: 'member-1', status: ExerciseReviewSubmissionStatus.pending },
      { user_id: 'member-1', status: ExerciseReviewSubmissionStatus.published },
    ]);
    repo.listCreatorUserIdentitiesByUserIds.mockResolvedValue([
      {
        id: 'member-1',
        profile: { first_name: 'Ava', last_name: 'Rivera' },
        auth_identities: [{ identifier: 'seed.member.active@fittrack.com' }],
      },
    ]);

    await expect(service.listReviewSubmissions({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          creator_candidate_score: 47,
          creator_display_name: 'Ava Rivera',
          creator_email: 'seed.member.active@fittrack.com',
          creator_governance_note: 'Two clean custom submissions.',
          creator_published_count: 1,
          creator_state: CreatorState.candidate,
          creator_submission_count: 2,
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('blocks active members without creator state from submitting drafts', async () => {
    repo.findCreatorSubmissionAccess.mockResolvedValue({
      creatorProfileState: CreatorState.none,
      membershipCardStatus: MembershipCardStatus.active,
      role: UserRole.member,
    });

    await expect(
      service.createReviewSubmission(
        {
          category: ExerciseCategory.strength,
          muscle_group: 'biceps',
          proposed_name: 'Strict Curl',
          summary: 'Three reps captured.',
        },
        'member-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repo.createReviewSubmission).not.toHaveBeenCalled();
  });

  it('allows creator candidates to submit exercise drafts', async () => {
    repo.findCreatorSubmissionAccess.mockResolvedValue({
      creatorProfileState: CreatorState.candidate,
      membershipCardStatus: MembershipCardStatus.active,
      role: UserRole.member,
    });
    repo.findPoseSessionOwner.mockResolvedValue('member-1');
    repo.createReviewSubmission.mockResolvedValue(
      makeReviewSubmission({ pose_session_id: 'pose-1' }),
    );
    repo.listCreatorProfilesByUserIds.mockResolvedValue([
      {
        user_id: 'member-1',
        state: CreatorState.candidate,
        admin_notes: null,
        last_state_changed_at: null,
        updated_at: new Date('2026-04-22T05:00:00.000Z'),
      },
    ]);
    repo.listReviewSubmissionStatusesByUserIds.mockResolvedValue([]);

    await expect(
      service.createReviewSubmission(
        {
          category: ExerciseCategory.strength,
          muscle_group: 'biceps',
          pose_session_id: 'pose-1',
          proposed_name: 'Strict Curl',
          summary: 'Three reps captured.',
        },
        'member-1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        creator_state: CreatorState.candidate,
        proposed_name: 'Standing rotational press',
      }),
    );

    expect(repo.createReviewSubmission).toHaveBeenCalled();
  });

  it('generates deterministic draft proposals through the creator gate', async () => {
    repo.findCreatorSubmissionAccess.mockResolvedValue({
      creatorProfileState: CreatorState.none,
      membershipCardStatus: null,
      role: UserRole.staff,
    });
    repo.findPoseSessionOwner.mockResolvedValue('staff-1');

    await expect(
      service.createExerciseDraftProposal(
        {
          category: ExerciseCategory.strength,
          evidence: {
            confidence: 0.73,
            movementContract: { dominantJoint: 'elbow' },
            repCount: 3,
            rig: { keyframes: [] },
          },
          muscle_group: 'biceps',
          pose_session_id: 'pose-1',
          proposed_name: 'dumbbell bicep curl',
          summary: 'Three reps captured.',
        },
        'staff-1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        confidence: 0.73,
        muscle_group: 'biceps',
        proposal_source: 'deterministic_fallback',
        proposed_name: 'Dumbbell Bicep Curl',
      }),
    );
  });

  it('uses deterministic proposal fallback when AI draft output is malformed', async () => {
    repo.findCreatorSubmissionAccess.mockResolvedValue({
      creatorProfileState: CreatorState.none,
      membershipCardStatus: null,
      role: UserRole.staff,
    });
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'ai.apiBaseUrl' ? 'https://ai.fittrack.test' : fallback,
    );
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ unexpected: true }),
      ok: true,
    }) as never;

    await expect(
      service.createExerciseDraftProposal(
        {
          evidence: { confidence: 0.61, repCount: 3 },
          proposed_name: 'push up',
        },
        'staff-1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        proposal_source: 'deterministic_fallback',
        proposed_name: 'Push Up',
      }),
    );
  });

  it('uses AI draft proposal when the AI microservice returns a valid contract', async () => {
    repo.findCreatorSubmissionAccess.mockResolvedValue({
      creatorProfileState: CreatorState.none,
      membershipCardStatus: null,
      role: UserRole.staff,
    });
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'ai.apiBaseUrl' ? 'https://ai.fittrack.test' : fallback,
    );
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        category: ExerciseCategory.strength,
        confidence: 0.84,
        description: 'AI polished curl description.',
        evidence: { repCount: 3 },
        hand_shape_profile: { schemaVersion: 'exercise_hand_shape_v1' },
        instructions: 'Curl with control and review the rig.',
        movement_profile: { schemaVersion: 'exercise_movement_profile_v1' },
        muscle_group: 'biceps',
        muscle_targets: [
          { allocationPercent: 80, muscleGroup: 'biceps', role: 'primary' },
        ],
        proposal_source: 'ai',
        proposed_name: 'Strict Dumbbell Curl',
        review_warnings: ['Validate captured rig before publishing.'],
        summary: 'AI generated proposal from three reps.',
      }),
      ok: true,
    }) as never;

    await expect(
      service.createExerciseDraftProposal(
        {
          evidence: { confidence: 0.61, repCount: 3 },
          proposed_name: 'dumbbell curl',
        },
        'staff-1',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        confidence: 0.84,
        proposal_source: 'ai',
        proposed_name: 'Strict Dumbbell Curl',
      }),
    );
  });

  it('updates review submissions with creator governance intent', async () => {
    repo.updateReviewSubmission.mockResolvedValue(
      makeReviewSubmission({
        status: ExerciseReviewSubmissionStatus.published,
        reviewed_at: new Date('2026-04-22T04:00:00.000Z'),
      }),
    );
    repo.listCreatorProfilesByUserIds.mockResolvedValue([
      {
        user_id: 'member-1',
        state: CreatorState.approved,
        admin_notes: 'Approved from operator review.',
        last_state_changed_at: new Date('2026-04-22T04:00:00.000Z'),
        updated_at: new Date('2026-04-22T05:00:00.000Z'),
      },
    ]);
    repo.listReviewSubmissionStatusesByUserIds.mockResolvedValue([
      { user_id: 'member-1', status: ExerciseReviewSubmissionStatus.published },
    ]);

    await service.updateReviewSubmission(
      'submission-1',
      {
        creator_governance_note: 'Approved from operator review.',
        creator_state: CreatorState.approved,
        status: ExerciseReviewSubmissionStatus.published,
      },
      'operator-1',
    );

    const [submissionId, submissionUpdate, creatorGovernance] = repo
      .updateReviewSubmission.mock.calls[0] as [
      string,
      { reviewed_at?: Date; status?: ExerciseReviewSubmissionStatus },
      { actorUserId?: string; note?: string; state?: CreatorState },
    ];

    expect(submissionId).toBe('submission-1');
    expect(submissionUpdate.status).toBe(
      ExerciseReviewSubmissionStatus.published,
    );
    expect(submissionUpdate.reviewed_at).toBeInstanceOf(Date);
    expect(creatorGovernance).toEqual({
      actorUserId: 'operator-1',
      note: 'Approved from operator review.',
      state: CreatorState.approved,
    });
  });

  it('persists reject rationale as review notes', async () => {
    repo.updateReviewSubmission.mockResolvedValue(
      makeReviewSubmission({
        review_notes:
          'Rejected because the submitted evidence does not show a repeatable movement contract.',
        reviewed_at: new Date('2026-04-22T04:00:00.000Z'),
        status: ExerciseReviewSubmissionStatus.rejected,
      }),
    );
    repo.listCreatorProfilesByUserIds.mockResolvedValue([]);
    repo.listReviewSubmissionStatusesByUserIds.mockResolvedValue([
      { user_id: 'member-1', status: ExerciseReviewSubmissionStatus.rejected },
    ]);

    const result = await service.updateReviewSubmission(
      'submission-1',
      {
        review_notes:
          'Rejected because the submitted evidence does not show a repeatable movement contract.',
        status: ExerciseReviewSubmissionStatus.rejected,
      },
      'operator-1',
    );

    const [, submissionUpdate] = repo.updateReviewSubmission.mock.calls[0] as [
      string,
      {
        review_notes?: string;
        reviewed_at?: Date;
        status?: ExerciseReviewSubmissionStatus;
      },
    ];

    expect(submissionUpdate).toEqual(
      expect.objectContaining({
        review_notes:
          'Rejected because the submitted evidence does not show a repeatable movement contract.',
        reviewed_at: expect.any(Date),
        status: ExerciseReviewSubmissionStatus.rejected,
      }),
    );
    expect(result.review_notes).toBe(
      'Rejected because the submitted evidence does not show a repeatable movement contract.',
    );
  });
});
