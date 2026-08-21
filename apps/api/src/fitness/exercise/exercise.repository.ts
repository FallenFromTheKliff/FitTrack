import { ConflictException, Injectable } from '@nestjs/common';
import { ExerciseCatalog, MuscleDefinition, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExerciseFilterDTO,
  MuscleDefinitionFilterDTO,
} from './dto/exercise.dto';

const exerciseOrderBy = [
  { muscle_group: 'asc' },
  { name: 'asc' },
] satisfies Prisma.ExerciseCatalogOrderByWithRelationInput[];

export type ActiveExerciseGenerationRecord = Pick<
  ExerciseCatalog,
  'id' | 'name' | 'muscle_group' | 'category'
>;

export type MuscleDefinitionRecord = MuscleDefinition;

@Injectable()
export class ExerciseRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listExercises(
    dto: ExerciseFilterDTO,
  ): Promise<PaginatedResult<ExerciseCatalog>> {
    const where: Prisma.ExerciseCatalogWhereInput = dto.include_inactive
      ? {}
      : { is_active: true };

    if (dto.muscle_group) {
      where.muscle_group = {
        contains: dto.muscle_group.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.search) {
      const term = dto.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { muscle_group: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { instructions: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.paginate<ExerciseCatalog>(
      this.prisma.exerciseCatalog,
      {
        where,
        orderBy: exerciseOrderBy,
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findActiveExerciseByIdOrThrow(id: string): Promise<ExerciseCatalog> {
    return this.findOneOrThrow<ExerciseCatalog>(
      this.prisma.exerciseCatalog,
      { id, is_active: true },
      'Exercise',
    );
  }

  listActiveExercisesForGeneration(): Promise<
    ActiveExerciseGenerationRecord[]
  > {
    return this.prisma.exerciseCatalog.findMany({
      where: { is_active: true },
      orderBy: exerciseOrderBy,
      select: {
        id: true,
        name: true,
        muscle_group: true,
        category: true,
      },
    });
  }

  listMuscleDefinitions(
    dto: MuscleDefinitionFilterDTO,
  ): Promise<MuscleDefinitionRecord[]> {
    const where: Prisma.MuscleDefinitionWhereInput = dto.include_archived
      ? {}
      : { is_active: true };

    if (dto.search?.trim()) {
      const term = dto.search.trim();
      where.OR = [
        { key: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { body_region: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.muscleDefinition.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  listActiveMuscleDefinitions(): Promise<MuscleDefinitionRecord[]> {
    return this.prisma.muscleDefinition.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  listActiveMuscleDefinitionsByKeys(
    keys: string[],
  ): Promise<MuscleDefinitionRecord[]> {
    if (!keys.length) return Promise.resolve([]);

    return this.prisma.muscleDefinition.findMany({
      where: {
        is_active: true,
        key: { in: keys },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async createExercise(
    data: Prisma.ExerciseCatalogCreateInput,
  ): Promise<ExerciseCatalog> {
    const nextName = typeof data.name === 'string' ? data.name.trim() : '';
    if (nextName) {
      await this.ensureExerciseNameAvailable(nextName);
    }

    try {
      return await this.create<ExerciseCatalog>(
        this.prisma.exerciseCatalog,
        data,
      );
    } catch (error) {
      if (this.isDuplicateExerciseNameError(error)) {
        throw this.buildDuplicateExerciseConflict();
      }

      throw error;
    }
  }

  async createMuscleDefinition(
    data: Prisma.MuscleDefinitionCreateInput,
  ): Promise<MuscleDefinitionRecord> {
    try {
      return await this.create<MuscleDefinitionRecord>(
        this.prisma.muscleDefinition,
        data,
      );
    } catch (error) {
      if (this.isDuplicateMuscleDefinitionKeyError(error)) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Muscle Already Exists',
          status: 409,
          detail: 'A muscle definition with this key already exists.',
        });
      }

      throw error;
    }
  }

  async updateMuscleDefinition(
    id: string,
    data: Prisma.MuscleDefinitionUpdateInput,
  ): Promise<MuscleDefinitionRecord> {
    try {
      return await this.updateById<MuscleDefinitionRecord>(
        this.prisma.muscleDefinition,
        id,
        data,
      );
    } catch (error) {
      if (this.isDuplicateMuscleDefinitionKeyError(error)) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Muscle Already Exists',
          status: 409,
          detail: 'A muscle definition with this key already exists.',
        });
      }

      throw error;
    }
  }

  async updateExercise(
    id: string,
    data: Prisma.ExerciseCatalogUpdateInput,
  ): Promise<ExerciseCatalog> {
    const nextName = typeof data.name === 'string' ? data.name.trim() : '';
    if (nextName) {
      await this.ensureExerciseNameAvailable(nextName, id);
    }

    try {
      return await this.updateById<ExerciseCatalog>(
        this.prisma.exerciseCatalog,
        id,
        data,
      );
    } catch (error) {
      if (this.isDuplicateExerciseNameError(error)) {
        throw this.buildDuplicateExerciseConflict();
      }

      throw error;
    }
  }

  private buildDuplicateExerciseConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Exercise Already Exists',
      status: 409,
      detail: 'An exercise with this name already exists.',
    });
  }

  private isDuplicateExerciseNameError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const targetMeta = error.meta?.target;
    const target = Array.isArray(targetMeta)
      ? targetMeta.join(',')
      : typeof targetMeta === 'string'
        ? targetMeta
        : '';

    return target.includes('name') || String(error.message).includes('name');
  }

  private isDuplicateMuscleDefinitionKeyError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const targetMeta = error.meta?.target;
    const target = Array.isArray(targetMeta)
      ? targetMeta.join(',')
      : typeof targetMeta === 'string'
        ? targetMeta
        : '';

    return target.includes('key') || String(error.message).includes('key');
  }

  private async ensureExerciseNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.exerciseCatalog.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw this.buildDuplicateExerciseConflict();
    }
  }
}
