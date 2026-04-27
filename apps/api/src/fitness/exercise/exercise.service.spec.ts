import { Test, TestingModule } from '@nestjs/testing';
import {
  CreatorState,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
} from '@prisma/client';

import { ExerciseRepository } from './exercise.repository';
import { ExerciseService } from './exercise.service';

describe('ExerciseService', () => {
  let service: ExerciseService;

  const repo = {
    listExercises: jest.fn(),
    findActiveExerciseByIdOrThrow: jest.fn(),
    listActiveExercisesForGeneration: jest.fn(),
    listCreatorProfilesByUserIds: jest.fn(),
    listReviewSubmissionStatusesByUserIds: jest.fn(),
    listReviewSubmissions: jest.fn(),
    createExercise: jest.fn(),
    updateExercise: jest.fn(),
    updateReviewSubmission: jest.fn(),
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

    await expect(service.listReviewSubmissions({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          creator_candidate_score: 47,
          creator_governance_note: 'Two clean custom submissions.',
          creator_published_count: 1,
          creator_state: CreatorState.candidate,
          creator_submission_count: 2,
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
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
});
