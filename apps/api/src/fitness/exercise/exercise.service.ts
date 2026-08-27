import { isDeepStrictEqual } from 'node:util';

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ExerciseAliasKind,
  ExerciseTrackingMode,
  Prisma,
} from '@prisma/client';
import type { ExerciseMovementProfileRecord } from '../../../../../packages/types/fitness';
import {
  normalizeExerciseAlias,
  resolveEffectiveMovementProfile,
} from '../../../../../packages/utils/exercise-movement-contract';
import { validatePoseMovementContract } from '../../../../../packages/utils/pose';

import { ActivityLevelService } from '../../user/activity-level.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  ActiveExerciseGenerationRecord,
  ExerciseAliasWrite,
  ExerciseContractRecord,
  ExerciseRepository,
  MuscleDefinitionRecord,
} from './exercise.repository';
import {
  CreateMuscleDefinitionDTO,
  CreateExerciseDTO,
  ExerciseFilterDTO,
  ExerciseResponseDTO,
  MuscleDefinitionFilterDTO,
  MuscleDefinitionResponseDTO,
  UpdateMuscleDefinitionDTO,
  UpdateExerciseDTO,
  UpdateMovementFamilyContractDTO,
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

function toJsonInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeJsonArray(value: Prisma.JsonValue | null): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function normalizeJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeMuscleKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeMuscleDefinitionAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((alias): alias is string => typeof alias === 'string')
        .map((alias) => alias.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

function normalizeMuscleTargetRole(value: unknown): string {
  return value === 'primary' || value === 'secondary' || value === 'stabilizer'
    ? value
    : 'secondary';
}

function normalizeMuscleEffort(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeUnknownObject(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeExerciseAliases(value: unknown): ExerciseAliasWrite[] {
  if (!Array.isArray(value)) return [];
  const aliases = new Map<string, ExerciseAliasWrite>();
  for (const entry of value) {
    const record = normalizeUnknownObject(entry);
    const label =
      typeof entry === 'string'
        ? entry.trim()
        : typeof record?.label === 'string'
          ? record.label.trim()
          : '';
    const normalizedLabel = normalizeExerciseAlias(label);
    if (!label || !normalizedLabel) continue;
    aliases.set(normalizedLabel, {
      kind:
        record?.kind === ExerciseAliasKind.spelling
          ? ExerciseAliasKind.spelling
          : ExerciseAliasKind.synonym,
      label,
      normalizedLabel,
    });
  }
  return [...aliases.values()].slice(0, 24);
}

@Injectable()
export class ExerciseService {
  constructor(
    private readonly repo: ExerciseRepository,
    private readonly activityLevelService: ActivityLevelService,
  ) {}

  async listExercises(
    dto: ExerciseFilterDTO,
  ): Promise<PaginatedResult<ExerciseResponseDTO>> {
    const result = await this.repo.listExercises(dto);

    return {
      data: result.data.map((exercise) => this.toResponse(exercise)),
      meta: result.meta,
    };
  }

  async listMuscleDefinitions(dto: MuscleDefinitionFilterDTO): Promise<{
    data: MuscleDefinitionResponseDTO[];
  }> {
    const definitions = await this.repo.listMuscleDefinitions(dto);
    return {
      data: definitions.map((definition) =>
        this.toMuscleDefinitionResponse(definition),
      ),
    };
  }

  async listMemberMuscleDefinitions(): Promise<{
    data: MuscleDefinitionResponseDTO[];
  }> {
    const definitions = await this.repo.listActiveMuscleDefinitions();
    return {
      data: definitions
        .filter((definition) => definition.is_active)
        .map((definition) => this.toMuscleDefinitionResponse(definition)),
    };
  }

  async createMuscleDefinition(
    dto: CreateMuscleDefinitionDTO,
  ): Promise<MuscleDefinitionResponseDTO> {
    const key = normalizeMuscleKey(dto.key || dto.name);
    if (!key) {
      throw new BadRequestException('Muscle key could not be generated.');
    }

    return this.toMuscleDefinitionResponse(
      await this.repo.createMuscleDefinition({
        aliases: normalizeMuscleDefinitionAliases(dto.aliases),
        body_region: normalizeMuscleKey(dto.body_region) || dto.body_region,
        icon_asset_key: dto.icon_asset_key ?? null,
        icon_key: dto.icon_key ?? null,
        icon_kind: dto.icon_kind ?? null,
        is_system: false,
        key,
        name: dto.name.trim(),
        sort_order: dto.sort_order ?? 500,
      }),
    );
  }

  async updateMuscleDefinition(
    id: string,
    dto: UpdateMuscleDefinitionDTO,
  ): Promise<MuscleDefinitionResponseDTO> {
    return this.toMuscleDefinitionResponse(
      await this.repo.updateMuscleDefinition(id, {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.body_region !== undefined
          ? {
              body_region:
                normalizeMuscleKey(dto.body_region) || dto.body_region,
            }
          : {}),
        ...(dto.aliases !== undefined
          ? { aliases: normalizeMuscleDefinitionAliases(dto.aliases) }
          : {}),
        ...(dto.icon_asset_key !== undefined
          ? { icon_asset_key: dto.icon_asset_key }
          : {}),
        ...(dto.icon_key !== undefined ? { icon_key: dto.icon_key } : {}),
        ...(dto.icon_kind !== undefined ? { icon_kind: dto.icon_kind } : {}),
        ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      }),
    );
  }

  archiveMuscleDefinition(id: string): Promise<MuscleDefinitionResponseDTO> {
    return this.updateMuscleDefinition(id, { is_active: false });
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
    const muscleContract = await this.normalizeAndValidateMuscleTargets(
      dto.muscle_targets,
      dto.muscle_group,
    );

    const aliases = normalizeExerciseAliases(dto.aliases);
    await this.repo.ensureAliasesAvailable([
      dto.name,
      ...aliases.map((alias) => alias.label),
    ]);
    await this.validateTrackingWrite(dto);
    return this.toResponse(
      await this.repo.createExercise(
        this.toCreateInput(
          {
            ...dto,
            muscle_group: muscleContract.muscleGroup,
            muscle_targets: muscleContract.muscleTargets,
          },
          aliases,
        ),
      ),
    );
  }

  private async normalizeAndValidateMuscleTargets(
    rawTargets: unknown,
    fallbackMuscleGroup: string | undefined,
  ): Promise<{
    muscleGroup: string;
    muscleTargets: {
      allocationPercent: number;
      muscleGroup: string;
      role: string;
    }[];
  }> {
    const fallbackKey = normalizeMuscleKey(fallbackMuscleGroup) || 'core';
    const sourceTargets = Array.isArray(rawTargets) ? rawTargets : [];
    const muscleTargets = sourceTargets
      .map((target) => {
        const record = normalizeUnknownObject(target);
        if (!record) return null;
        const muscleGroup = normalizeMuscleKey(record.muscleGroup);
        if (!muscleGroup) return null;
        return {
          allocationPercent: normalizeMuscleEffort(record.allocationPercent),
          muscleGroup,
          role: normalizeMuscleTargetRole(record.role),
        };
      })
      .filter(
        (
          target,
        ): target is {
          allocationPercent: number;
          muscleGroup: string;
          role: string;
        } => Boolean(target),
      );

    if (!muscleTargets.length) {
      const fallbackDefinitions =
        await this.repo.listActiveMuscleDefinitionsByKeys([
          ...new Set([fallbackKey, 'core'].filter(Boolean)),
        ]);
      const fallbackDefinition =
        fallbackDefinitions.find(
          (definition) => definition.key === fallbackKey,
        ) ??
        fallbackDefinitions.find((definition) => definition.key === 'core');
      if (!fallbackDefinition) {
        throw new BadRequestException(
          'Muscle Library needs at least one active fallback muscle before exercises can be saved.',
        );
      }
      muscleTargets.push({
        allocationPercent: 100,
        muscleGroup: fallbackDefinition.key,
        role: 'primary',
      });
    }

    const uniqueKeys = new Set<string>();
    for (const target of muscleTargets) {
      if (uniqueKeys.has(target.muscleGroup)) {
        throw new BadRequestException(
          `Muscle "${target.muscleGroup}" can only appear once in Muscle Effort XP.`,
        );
      }
      uniqueKeys.add(target.muscleGroup);
    }

    const total = muscleTargets.reduce(
      (sum, target) => sum + target.allocationPercent,
      0,
    );
    if (total !== 100) {
      throw new BadRequestException(
        `Muscle Effort XP must total exactly 100%. Current total: ${total}%.`,
      );
    }

    const primaryTargets = muscleTargets.filter(
      (target) => target.role === 'primary',
    );
    if (primaryTargets.length !== 1) {
      throw new BadRequestException(
        'Muscle Effort XP needs exactly one primary muscle target.',
      );
    }

    const activeDefinitions = await this.repo.listActiveMuscleDefinitionsByKeys(
      [...uniqueKeys],
    );
    const activeKeys = new Set(
      activeDefinitions.map((definition) => definition.key),
    );
    const missingKeys = [...uniqueKeys].filter((key) => !activeKeys.has(key));
    if (missingKeys.length) {
      throw new BadRequestException(
        `Unknown or archived muscle target: ${missingKeys.join(', ')}.`,
      );
    }

    return {
      muscleGroup: primaryTargets[0].muscleGroup,
      muscleTargets,
    };
  }

  async updateExercise(
    id: string,
    dto: UpdateExerciseDTO,
  ): Promise<ExerciseResponseDTO> {
    const musclePatch =
      dto.muscle_targets !== undefined || dto.muscle_group !== undefined
        ? await this.normalizeAndValidateMuscleTargets(
            dto.muscle_targets,
            dto.muscle_group,
          )
        : null;

    const aliases =
      dto.aliases === undefined
        ? undefined
        : normalizeExerciseAliases(dto.aliases);
    await this.repo.ensureAliasesAvailable(
      [dto.name ?? '', ...(aliases ?? []).map((alias) => alias.label)],
      id,
    );
    await this.validateTrackingWrite(dto, id);
    return this.toResponse(
      await this.repo.updateExercise(
        id,
        this.toUpdateInput({
          ...dto,
          ...(musclePatch
            ? {
                muscle_group: musclePatch.muscleGroup,
                muscle_targets: musclePatch.muscleTargets,
              }
            : {}),
        }),
        aliases,
      ),
    );
  }

  private toCreateInput(
    dto: CreateExerciseDTO,
    aliases: ExerciseAliasWrite[],
  ): Prisma.ExerciseCatalogCreateInput {
    return {
      name: dto.name,
      muscle_group: dto.muscle_group,
      category: dto.category,
      description: dto.description,
      hand_shape_profile: toJsonInput(dto.hand_shape_profile),
      instructions: dto.instructions,
      movement_profile: toJsonInput(dto.movement_profile),
      movement_profile_override: toJsonInput(dto.movement_profile_override),
      tracking_mode: dto.tracking_mode ?? ExerciseTrackingMode.manual,
      ...(dto.movement_family_id
        ? { movement_family: { connect: { id: dto.movement_family_id } } }
        : {}),
      ...(aliases.length
        ? {
            aliases: {
              create: aliases.map((alias) => ({
                kind: alias.kind,
                label: alias.label,
                normalized_label: alias.normalizedLabel,
              })),
            },
          }
        : {}),
      video_url: dto.video_url,
      image_url: dto.image_url,
      muscle_targets: toJsonInput(dto.muscle_targets),
    };
  }

  private toUpdateInput(
    dto: UpdateExerciseDTO,
  ): Prisma.ExerciseCatalogUpdateInput {
    return {
      ...pickDefined(dto, EXERCISE_UPDATE_FIELDS),
      ...(dto.hand_shape_profile !== undefined
        ? { hand_shape_profile: toJsonInput(dto.hand_shape_profile) }
        : {}),
      ...(dto.movement_profile !== undefined
        ? { movement_profile: toJsonInput(dto.movement_profile) }
        : {}),
      ...(dto.movement_profile_override !== undefined
        ? {
            movement_profile_override: toJsonInput(
              dto.movement_profile_override,
            ),
          }
        : {}),
      ...(dto.tracking_mode !== undefined
        ? { tracking_mode: dto.tracking_mode }
        : {}),
      ...(dto.movement_family_id !== undefined
        ? {
            movement_family: dto.movement_family_id
              ? { connect: { id: dto.movement_family_id } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.muscle_targets !== undefined
        ? { muscle_targets: toJsonInput(dto.muscle_targets) }
        : {}),
    };
  }

  private toMuscleDefinitionResponse(
    definition: MuscleDefinitionRecord,
  ): MuscleDefinitionResponseDTO {
    return {
      aliases: Array.isArray(definition.aliases)
        ? definition.aliases.filter(
            (alias): alias is string => typeof alias === 'string',
          )
        : [],
      body_region: definition.body_region,
      created_at: definition.created_at.toISOString(),
      id: definition.id,
      icon_asset_key: definition.icon_asset_key,
      icon_key: definition.icon_key,
      icon_kind: definition.icon_kind,
      is_active: definition.is_active,
      is_system: definition.is_system,
      key: definition.key,
      name: definition.name,
      sort_order: definition.sort_order,
      updated_at: definition.updated_at.toISOString(),
    };
  }

  private toResponse(exercise: ExerciseContractRecord): ExerciseResponseDTO {
    const familyBase = normalizeJsonObject(
      exercise.movement_family?.base_movement_profile ?? null,
    ) as ExerciseMovementProfileRecord | null;
    const override = normalizeJsonObject(
      exercise.movement_profile_override,
    ) as Partial<ExerciseMovementProfileRecord> | null;
    const legacy = normalizeJsonObject(
      exercise.movement_profile,
    ) as ExerciseMovementProfileRecord | null;
    const effective = resolveEffectiveMovementProfile({
      exerciseId: exercise.id,
      familyBaseProfile: familyBase,
      familyKey: (exercise.movement_family?.key ?? null) as never,
      familyRevision: exercise.movement_family?.contract_revision ?? null,
      legacyProfile: legacy,
      override,
      trackingMode: exercise.tracking_mode,
    });
    return {
      aliases: exercise.aliases.map((alias) => ({
        id: alias.id,
        kind: alias.kind,
        label: alias.label,
        normalized_label: alias.normalized_label,
      })),
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      muscle_targets: normalizeJsonArray(exercise.muscle_targets),
      movement_profile: effective.profile as unknown as Record<
        string,
        unknown
      > | null,
      movement_profile_override: override as Record<string, unknown> | null,
      movement_family: exercise.movement_family
        ? {
            canonical_exercise_id:
              exercise.movement_family.canonical_exercise_id,
            contract_revision: exercise.movement_family.contract_revision,
            display_name: exercise.movement_family.display_name,
            id: exercise.movement_family.id,
            inheriting_exercise_ids: exercise.movement_family.exercises
              .filter(
                (entry) => entry.tracking_mode === ExerciseTrackingMode.inherit,
              )
              .map((entry) => entry.id),
            key: exercise.movement_family.key,
          }
        : null,
      tracking_mode: exercise.tracking_mode,
      movement_contract_identity: effective.identity as unknown as Record<
        string,
        unknown
      >,
      hand_shape_profile: normalizeJsonObject(exercise.hand_shape_profile),
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

  async updateMovementFamilyContract(
    familyId: string,
    dto: UpdateMovementFamilyContractDTO,
  ) {
    const profile = normalizeUnknownObject(dto.movement_profile);
    const contract = normalizeUnknownObject(profile?.movementContract);
    const validation = validatePoseMovementContract(contract);
    if (!profile || !validation.valid) {
      throw new BadRequestException({
        detail: `Movement contract is invalid: ${validation.errors.join(', ')}.`,
        errors: validation.errors,
      });
    }
    const current = await this.repo.findMovementFamilyById(familyId);
    const currentMovementProfile = current
      ? normalizeJsonObject(current.base_movement_profile)
      : null;
    const currentHandShapeProfile = current
      ? normalizeJsonObject(current.base_hand_shape_profile)
      : null;
    const nextHandShapeProfile =
      dto.hand_shape_profile === undefined
        ? undefined
        : normalizeUnknownObject(dto.hand_shape_profile);
    if (
      current &&
      isDeepStrictEqual(currentMovementProfile, profile) &&
      (nextHandShapeProfile === undefined ||
        isDeepStrictEqual(currentHandShapeProfile, nextHandShapeProfile))
    ) {
      return {
        id: current.id,
        key: current.key,
        contract_revision: current.contract_revision,
        affected_inheritors: current.exercises
          .filter(
            (exercise) =>
              exercise.tracking_mode === ExerciseTrackingMode.inherit,
          )
          .map((exercise) => ({ id: exercise.id, name: exercise.name })),
      };
    }
    const updated = await this.repo.updateMovementFamilyContract(
      familyId,
      profile as Prisma.InputJsonValue,
      dto.hand_shape_profile === undefined
        ? undefined
        : toJsonInput(dto.hand_shape_profile),
    );
    return {
      id: updated.id,
      key: updated.key,
      contract_revision: updated.contract_revision,
      affected_inheritors: updated.exercises
        .filter(
          (exercise) => exercise.tracking_mode === ExerciseTrackingMode.inherit,
        )
        .map((exercise) => ({ id: exercise.id, name: exercise.name })),
    };
  }

  async resolveExerciseContract(input: {
    exerciseId?: string | null;
    label?: string | null;
  }) {
    const exercise = input.exerciseId
      ? await this.repo.findActiveExerciseByIdOrThrow(input.exerciseId)
      : input.label
        ? await this.repo.findActiveExerciseByAlias(input.label)
        : null;
    return exercise ? this.toResponse(exercise) : null;
  }

  private async validateTrackingWrite(
    dto: Pick<
      CreateExerciseDTO,
      'movement_family_id' | 'movement_profile_override' | 'tracking_mode'
    >,
    exerciseId?: string,
  ) {
    const current = exerciseId
      ? await this.repo.findActiveExerciseByIdOrThrow(exerciseId)
      : null;
    const mode =
      dto.tracking_mode ??
      current?.tracking_mode ??
      ExerciseTrackingMode.manual;
    const familyId =
      dto.movement_family_id === undefined
        ? (current?.movement_family_id ?? null)
        : dto.movement_family_id;
    if (mode === ExerciseTrackingMode.manual) return;
    if (!familyId) {
      throw new BadRequestException(
        'Tracked exercises must select a movement family.',
      );
    }
    const family = await this.repo.findMovementFamilyById(familyId);
    if (!family || !family.is_active) {
      throw new BadRequestException(
        'Movement family was not found or is inactive.',
      );
    }
    const base = normalizeJsonObject(
      family.base_movement_profile,
    ) as ExerciseMovementProfileRecord | null;
    const override =
      dto.movement_profile_override === undefined
        ? (normalizeJsonObject(
            current?.movement_profile_override ?? null,
          ) as Partial<ExerciseMovementProfileRecord> | null)
        : (normalizeUnknownObject(
            dto.movement_profile_override,
          ) as Partial<ExerciseMovementProfileRecord> | null);
    const effective = resolveEffectiveMovementProfile({
      exerciseId: exerciseId ?? 'new-exercise',
      familyBaseProfile: base,
      familyKey: family.key as never,
      familyRevision: family.contract_revision,
      override,
      trackingMode: mode,
    });
    const validation = validatePoseMovementContract(
      effective.profile?.movementContract,
      family.key,
    );
    if (!validation.valid) {
      throw new BadRequestException({
        detail: `Movement contract is invalid: ${validation.errors.join(', ')}.`,
        errors: validation.errors,
      });
    }
  }
}
