import { ConflictException, Injectable } from '@nestjs/common';
import {
  ExerciseAliasKind,
  ExerciseCatalog,
  MuscleDefinition,
  Prisma,
} from '@prisma/client';
import { normalizeExerciseAlias } from '../../../../../packages/utils/exercise-movement-contract';

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

const exerciseContractInclude = {
  aliases: { orderBy: [{ normalized_label: 'asc' as const }] },
  movement_family: {
    include: {
      exercises: {
        select: { id: true, tracking_mode: true },
        where: { is_active: true },
      },
    },
  },
} satisfies Prisma.ExerciseCatalogInclude;

export type ExerciseContractRecord = Prisma.ExerciseCatalogGetPayload<{
  include: typeof exerciseContractInclude;
}>;

export type ExerciseAliasWrite = {
  kind: ExerciseAliasKind;
  label: string;
  normalizedLabel: string;
};

export type SharedExerciseTrackingWrite = {
  familyId: string;
  expectedRevision: number;
  profile: Prisma.InputJsonValue;
  hands?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;
};

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
  ): Promise<PaginatedResult<ExerciseContractRecord>> {
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

    return this.paginate<ExerciseContractRecord>(
      this.prisma.exerciseCatalog,
      {
        where,
        orderBy: exerciseOrderBy,
        include: exerciseContractInclude,
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  async findActiveExerciseByIdOrThrow(
    id: string,
    includeInactive = false,
  ): Promise<ExerciseContractRecord> {
    const exercise = await this.prisma.exerciseCatalog.findFirst({
      where: { id, ...(includeInactive ? {} : { is_active: true }) },
      include: exerciseContractInclude,
    });
    if (!exercise) {
      await this.findOneOrThrow(
        this.prisma.exerciseCatalog,
        { id, ...(includeInactive ? {} : { is_active: true }) },
        'Exercise',
      );
      throw new Error('Exercise lookup invariant failed.');
    }
    return exercise;
  }

  async findActiveExerciseByAlias(
    label: string,
  ): Promise<ExerciseContractRecord | null> {
    const normalized = normalizeExerciseAlias(label);
    if (!normalized) return null;
    const alias = await this.prisma.exerciseAlias.findUnique({
      where: { normalized_label: normalized },
      select: { exercise_id: true },
    });
    if (alias) {
      return this.prisma.exerciseCatalog.findFirst({
        where: { id: alias.exercise_id, is_active: true },
        include: exerciseContractInclude,
      });
    }
    const candidates = await this.prisma.exerciseCatalog.findMany({
      where: { is_active: true },
      include: exerciseContractInclude,
    });
    const matches = candidates.filter(
      (candidate) => normalizeExerciseAlias(candidate.name) === normalized,
    );
    return matches.length === 1 ? matches[0] : null;
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
  ): Promise<ExerciseContractRecord> {
    const nextName = typeof data.name === 'string' ? data.name.trim() : '';
    if (nextName) {
      await this.ensureExerciseNameAvailable(nextName);
    }

    try {
      return await this.prisma.exerciseCatalog.create({
        data,
        include: exerciseContractInclude,
      });
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
    aliases?: ExerciseAliasWrite[],
    shared?: SharedExerciseTrackingWrite,
  ): Promise<ExerciseContractRecord> {
    const nextName = typeof data.name === 'string' ? data.name.trim() : '';
    if (nextName) {
      await this.ensureExerciseNameAvailable(nextName, id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (shared) {
          const changed = await tx.exerciseMovementFamily.updateMany({
            where: { id: shared.familyId, canonical_exercise_id: id, is_active: true, contract_revision: shared.expectedRevision },
            data: {
              base_movement_profile: shared.profile,
              contract_revision: { increment: 1 },
              ...(shared.hands !== undefined ? { base_hand_shape_profile: shared.hands } : {}),
            },
          });
          if (changed.count !== 1) throw new ConflictException('Shared tracking changed. Reload and review the latest revision before saving. Nothing was saved.');
        }
        if (aliases) {
          await tx.exerciseAlias.deleteMany({ where: { exercise_id: id } });
          if (aliases.length) {
            await tx.exerciseAlias.createMany({
              data: aliases.map((alias) => ({
                exercise_id: id,
                kind: alias.kind,
                label: alias.label,
                normalized_label: alias.normalizedLabel,
              })),
            });
          }
        }
        return tx.exerciseCatalog.update({
          where: { id },
          data,
          include: exerciseContractInclude,
        });
      });
    } catch (error) {
      if (this.isDuplicateExerciseNameError(error)) {
        throw this.buildDuplicateExerciseConflict();
      }

      throw error;
    }
  }

  async ensureAliasesAvailable(
    labels: string[],
    excludeExerciseId?: string,
  ): Promise<void> {
    const normalizedLabels = [
      ...new Set(labels.map(normalizeExerciseAlias).filter(Boolean)),
    ];
    if (!normalizedLabels.length) return;
    const [aliases, names] = await Promise.all([
      this.prisma.exerciseAlias.findMany({
        where: {
          normalized_label: { in: normalizedLabels },
          ...(excludeExerciseId
            ? { exercise_id: { not: excludeExerciseId } }
            : {}),
        },
        select: { normalized_label: true },
      }),
      this.prisma.exerciseCatalog.findMany({
        where: excludeExerciseId ? { id: { not: excludeExerciseId } } : {},
        select: { name: true },
      }),
    ]);
    const collision =
      aliases[0]?.normalized_label ??
      names
        .map((entry) => normalizeExerciseAlias(entry.name))
        .find((name) => normalizedLabels.includes(name));
    if (collision) throw this.buildDuplicateExerciseConflict(collision);
  }

  async updateMovementFamilyContract(
    familyId: string,
    baseMovementProfile: Prisma.InputJsonValue,
    baseHandShapeProfile?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull,
    expectedRevision?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
    const changed = await tx.exerciseMovementFamily.updateMany({
      where: { id: familyId, is_active: true, ...(expectedRevision !== undefined ? { contract_revision: expectedRevision } : {}) },
      data: {
        base_movement_profile: baseMovementProfile,
        ...(baseHandShapeProfile !== undefined
          ? { base_hand_shape_profile: baseHandShapeProfile }
          : {}),
        contract_revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Shared tracking changed. Reload and review the latest revision before saving. Nothing was saved.');
    return tx.exerciseMovementFamily.findUniqueOrThrow({
      where: { id: familyId },
      include: {
        exercises: {
          where: { is_active: true },
          select: { id: true, name: true, tracking_mode: true },
        },
      },
    });
    });
  }

  findMovementFamilyById(id: string) {
    return this.prisma.exerciseMovementFamily.findUnique({
      where: { id },
      include: {
        exercises: {
          where: { is_active: true },
          select: { id: true, name: true, tracking_mode: true },
        },
      },
    });
  }

  private buildDuplicateExerciseConflict(label?: string): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Exercise Already Exists',
      status: 409,
      detail: label
        ? `The normalized exercise label "${label}" already belongs to another exercise.`
        : 'An exercise with this name already exists.',
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
    await this.ensureAliasesAvailable([name], excludeId);
  }
}
