import { Injectable } from '@nestjs/common';
import {
  CreatorProfile,
  CreatorState,
  ExerciseCatalog,
  ExerciseReviewSubmission,
  ExerciseReviewSubmissionStatus,
  Prisma,
} from '@prisma/client';

import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  ActiveExerciseGenerationRecord,
  ExerciseRepository,
} from './exercise.repository';
import {
  CreateExerciseDTO,
  ExerciseFilterDTO,
  ExerciseResponseDTO,
  UpdateExerciseDTO,
} from './dto/exercise.dto';
import {
  ExerciseReviewSubmissionFilterDTO,
  ExerciseReviewSubmissionResponseDTO,
  UpdateExerciseReviewSubmissionDTO,
} from './dto/exercise-review.dto';

const EXERCISE_UPDATE_FIELDS = [
  'name',
  'muscle_group',
  'category',
  'description',
  'instructions',
  'video_url',
  'image_url',
  'is_active',
] as const;

const EXERCISE_REVIEW_SUBMISSION_UPDATE_FIELDS = [
  'status',
  'published_exercise_id',
  'review_notes',
] as const;

type CreatorReviewCounts = {
  leftPrivate: number;
  pending: number;
  published: number;
  rejected: number;
  total: number;
};

type CreatorReviewContext = {
  counts: CreatorReviewCounts;
  profile: CreatorProfile | null;
};

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      result[key] = value as T[K];
    }
  }

  return result;
}

@Injectable()
export class ExerciseService {
  constructor(private readonly repo: ExerciseRepository) {}

  async listExercises(
    dto: ExerciseFilterDTO,
  ): Promise<PaginatedResult<ExerciseResponseDTO>> {
    const result = await this.repo.listExercises(dto);

    return {
      data: result.data.map((exercise) => this.toResponse(exercise)),
      meta: result.meta,
    };
  }

  async getExerciseById(id: string): Promise<ExerciseResponseDTO> {
    return this.toResponse(await this.repo.findActiveExerciseByIdOrThrow(id));
  }

  listActiveExercisesForGeneration(): Promise<
    ActiveExerciseGenerationRecord[]
  > {
    return this.repo.listActiveExercisesForGeneration();
  }

  async listReviewSubmissions(
    dto: ExerciseReviewSubmissionFilterDTO,
  ): Promise<PaginatedResult<ExerciseReviewSubmissionResponseDTO>> {
    const result = await this.repo.listReviewSubmissions(dto);
    const creatorContextByUserId = await this.loadCreatorReviewContext(
      result.data.map((submission) => submission.user_id),
    );

    return {
      data: result.data.map((submission) =>
        this.toReviewSubmissionResponse(
          submission,
          creatorContextByUserId.get(submission.user_id),
        ),
      ),
      meta: result.meta,
    };
  }

  async createExercise(dto: CreateExerciseDTO): Promise<ExerciseResponseDTO> {
    return this.toResponse(
      await this.repo.createExercise(this.toCreateInput(dto)),
    );
  }

  async updateExercise(
    id: string,
    dto: UpdateExerciseDTO,
  ): Promise<ExerciseResponseDTO> {
    return this.toResponse(
      await this.repo.updateExercise(id, this.toUpdateInput(dto)),
    );
  }

  async updateReviewSubmission(
    id: string,
    dto: UpdateExerciseReviewSubmissionDTO,
    actorUserId?: string,
  ): Promise<ExerciseReviewSubmissionResponseDTO> {
    const reviewedAt =
      dto.status && dto.status !== 'pending' ? new Date() : undefined;
    const updatedSubmission = await this.repo.updateReviewSubmission(
      id,
      {
        ...pickDefined(dto, EXERCISE_REVIEW_SUBMISSION_UPDATE_FIELDS),
        ...(reviewedAt ? { reviewed_at: reviewedAt } : {}),
      },
      {
        actorUserId,
        note: dto.creator_governance_note,
        state: dto.creator_state,
      },
    );
    const creatorContextByUserId = await this.loadCreatorReviewContext([
      updatedSubmission.user_id,
    ]);

    return this.toReviewSubmissionResponse(
      updatedSubmission,
      creatorContextByUserId.get(updatedSubmission.user_id),
    );
  }

  private toCreateInput(
    dto: CreateExerciseDTO,
  ): Prisma.ExerciseCatalogCreateInput {
    return {
      name: dto.name,
      muscle_group: dto.muscle_group,
      category: dto.category,
      description: dto.description,
      instructions: dto.instructions,
      video_url: dto.video_url,
      image_url: dto.image_url,
    };
  }

  private toUpdateInput(
    dto: UpdateExerciseDTO,
  ): Prisma.ExerciseCatalogUpdateInput {
    return {
      ...pickDefined(dto, EXERCISE_UPDATE_FIELDS),
    };
  }

  private toResponse(exercise: ExerciseCatalog): ExerciseResponseDTO {
    return {
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      category: exercise.category,
      description: exercise.description ?? null,
      instructions: exercise.instructions ?? null,
      video_url: exercise.video_url ?? null,
      image_url: exercise.image_url ?? null,
      is_active: exercise.is_active,
      created_at: exercise.created_at.toISOString(),
      updated_at: exercise.updated_at.toISOString(),
    };
  }

  private toReviewSubmissionResponse(
    submission: ExerciseReviewSubmission,
    creatorContext?: CreatorReviewContext,
  ): ExerciseReviewSubmissionResponseDTO {
    const creatorState = creatorContext?.profile?.state ?? CreatorState.none;
    const creatorCounts = creatorContext?.counts ?? {
      leftPrivate: 0,
      pending: 0,
      published: 0,
      rejected: 0,
      total: 0,
    };

    return {
      id: submission.id,
      user_id: submission.user_id,
      pose_session_id: submission.pose_session_id ?? null,
      published_exercise_id: submission.published_exercise_id ?? null,
      status: submission.status,
      title: submission.title,
      proposed_name: submission.proposed_name,
      summary: submission.summary,
      origin_label: submission.origin_label,
      trigger_label: submission.trigger_label,
      source_label: submission.source_label,
      queue_tag: submission.queue_tag,
      match_hint: submission.match_hint ?? null,
      category: submission.category,
      muscle_group: submission.muscle_group,
      description: submission.description ?? null,
      instructions: submission.instructions ?? null,
      evidence_bars: Array.isArray(submission.evidence_bars)
        ? submission.evidence_bars.map((entry) => Number(entry))
        : null,
      review_notes: submission.review_notes ?? null,
      created_at: submission.created_at.toISOString(),
      updated_at: submission.updated_at.toISOString(),
      reviewed_at: submission.reviewed_at?.toISOString() ?? null,
      creator_state: creatorState,
      creator_state_label: this.toCreatorStateLabel(creatorState),
      creator_submission_count: creatorCounts.total,
      creator_published_count: creatorCounts.published,
      creator_rejected_count: creatorCounts.rejected,
      creator_candidate_score:
        this.calculateCreatorCandidateScore(creatorCounts),
      creator_governance_note: creatorContext?.profile?.admin_notes ?? null,
      creator_last_state_changed_at:
        creatorContext?.profile?.last_state_changed_at?.toISOString() ?? null,
      creator_profile_updated_at:
        creatorContext?.profile?.updated_at.toISOString() ?? null,
    };
  }

  private async loadCreatorReviewContext(
    userIds: string[],
  ): Promise<Map<string, CreatorReviewContext>> {
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
    if (!uniqueUserIds.length) return new Map();

    const [profiles, statusRows] = await Promise.all([
      this.repo.listCreatorProfilesByUserIds(uniqueUserIds),
      this.repo.listReviewSubmissionStatusesByUserIds(uniqueUserIds),
    ]);
    const contextByUserId = new Map<string, CreatorReviewContext>();

    for (const userId of uniqueUserIds) {
      contextByUserId.set(userId, {
        counts: {
          leftPrivate: 0,
          pending: 0,
          published: 0,
          rejected: 0,
          total: 0,
        },
        profile: null,
      });
    }

    for (const profile of profiles) {
      const context = contextByUserId.get(profile.user_id);
      if (context) {
        context.profile = profile;
      }
    }

    for (const row of statusRows) {
      const context = contextByUserId.get(row.user_id);
      if (!context) continue;

      context.counts.total += 1;
      if (row.status === ExerciseReviewSubmissionStatus.pending) {
        context.counts.pending += 1;
      } else if (row.status === ExerciseReviewSubmissionStatus.published) {
        context.counts.published += 1;
      } else if (row.status === ExerciseReviewSubmissionStatus.rejected) {
        context.counts.rejected += 1;
      } else if (row.status === ExerciseReviewSubmissionStatus.left_private) {
        context.counts.leftPrivate += 1;
      }
    }

    return contextByUserId;
  }

  private calculateCreatorCandidateScore(counts: CreatorReviewCounts): number {
    return Math.max(
      0,
      Math.min(
        100,
        counts.published * 35 +
          counts.pending * 12 +
          counts.leftPrivate * 5 -
          counts.rejected * 10,
      ),
    );
  }

  private toCreatorStateLabel(state: CreatorState): string {
    return state
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
