import { Injectable } from '@nestjs/common';
import {
  ExerciseCatalog,
  ExerciseReviewSubmission,
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

    return {
      data: result.data.map((submission) =>
        this.toReviewSubmissionResponse(submission),
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
  ): Promise<ExerciseReviewSubmissionResponseDTO> {
    const reviewedAt =
      dto.status && dto.status !== 'pending' ? new Date() : undefined;

    return this.toReviewSubmissionResponse(
      await this.repo.updateReviewSubmission(id, {
        ...pickDefined(dto, EXERCISE_REVIEW_SUBMISSION_UPDATE_FIELDS),
        ...(reviewedAt ? { reviewed_at: reviewedAt } : {}),
      }),
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
  ): ExerciseReviewSubmissionResponseDTO {
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
    };
  }
}
