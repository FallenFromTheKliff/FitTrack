import { Injectable } from '@nestjs/common';
import { ExerciseCatalog, Prisma } from '@prisma/client';

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
}
