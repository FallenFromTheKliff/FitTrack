import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatorProfile,
  CreatorState,
  ExerciseCategory,
  ExerciseCatalog,
  ExerciseReviewSubmission,
  ExerciseReviewSubmissionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  ActiveExerciseGenerationRecord,
  CreatorUserIdentityRecord,
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
} from './dto/exercise.dto';
import {
  CreateExerciseReviewSubmissionDTO,
  CreateExerciseDraftProposalDTO,
  ExerciseDraftProposalResponseDTO,
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
  identity: CreatorUserIdentityRecord | null;
  profile: CreatorProfile | null;
};

type AiExerciseDraftProposalPayload = {
  category?: unknown;
  confidence?: unknown;
  description?: unknown;
  evidence?: unknown;
  hand_shape_profile?: unknown;
  instructions?: unknown;
  movement_profile?: unknown;
  muscle_group?: unknown;
  muscle_targets?: unknown;
  proposed_name?: unknown;
  review_warnings?: unknown;
  summary?: unknown;
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

function toJsonInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeReviewEvidence(
  value: Prisma.JsonValue | null,
): number[] | Record<string, unknown> | null {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => Number(entry));
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
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

function normalizeDraftLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return fallback;
  return normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  return value === 'primary' ||
    value === 'secondary' ||
    value === 'stabilizer'
    ? value
    : 'secondary';
}

function normalizeMuscleEffort(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeUnknownObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function inferMuscleGroupFromName(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('curl')) return 'biceps';
  if (normalized.includes('push')) return 'chest';
  if (normalized.includes('pull')) return 'lats';
  if (normalized.includes('dip')) return 'triceps';
  if (normalized.includes('squat')) return 'quads';
  return 'custom';
}

function createDefaultHandShapeProfile(exerciseName: string) {
  const requiresGrip = exerciseName.toLowerCase().includes('curl');
  return {
    grip: {
      maxOpenFrames: 0,
      maxOpenRatio: 0.18,
      minUsableFrames: 2,
      recentFrameLimit: 6,
      reliablePointMinVisibility: 0.36,
      required: requiresGrip,
    },
    schemaVersion: 'exercise_hand_shape_v1',
    subjectLockGesture: {
      enabled: true,
      gesture: 'rock_sign',
      handAboveShoulderOffset: 0.018,
      handRaisedFromElbowOffset: 0.018,
      holdMs: 3000,
      hornThumbLeadOffset: 0.025,
      maxHornLiftDelta: 0.08,
      minFingerDistance: 0.045,
      minFingerLift: 0.035,
      minFingerSpreadX: 0.025,
      minThumbOffset: 0.012,
      minThumbSeparation: 0.025,
    },
    warnings: [],
  };
}

function isExerciseCategory(value: unknown): value is ExerciseCategory {
  return (
    typeof value === 'string' &&
    Object.values(ExerciseCategory).includes(value as ExerciseCategory)
  );
}

@Injectable()
export class ExerciseService {
  constructor(
    private readonly repo: ExerciseRepository,
    private readonly config: ConfigService,
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
          ? { body_region: normalizeMuscleKey(dto.body_region) || dto.body_region }
          : {}),
        ...(dto.aliases !== undefined
          ? { aliases: normalizeMuscleDefinitionAliases(dto.aliases) }
          : {}),
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
    const muscleContract = await this.normalizeAndValidateMuscleTargets(
      dto.muscle_targets,
      dto.muscle_group,
    );

    return this.toResponse(
      await this.repo.createExercise(
        this.toCreateInput({
          ...dto,
          muscle_group: muscleContract.muscleGroup,
          muscle_targets: muscleContract.muscleTargets,
        }),
      ),
    );
  }

  async createReviewSubmission(
    dto: CreateExerciseReviewSubmissionDTO,
    userId: string,
  ): Promise<ExerciseReviewSubmissionResponseDTO> {
    await this.ensureCanSubmitExerciseDraft(userId);
    await this.ensurePoseSessionBelongsToUser(dto.pose_session_id, userId);
    const muscleContract = await this.normalizeAndValidateMuscleTargets(
      dto.muscle_targets,
      dto.muscle_group,
    );

    const createdSubmission = await this.repo.createReviewSubmission({
      proposed_name: dto.proposed_name,
      summary: dto.summary,
      category: dto.category,
      muscle_group: muscleContract.muscleGroup,
      description: dto.description,
      evidence_bars: toJsonInput(dto.evidence_bars),
      hand_shape_profile: toJsonInput(dto.hand_shape_profile),
      instructions: dto.instructions,
      match_hint: dto.match_hint,
      movement_profile: toJsonInput(dto.movement_profile),
      muscle_targets: toJsonInput(muscleContract.muscleTargets),
      origin_label: dto.origin_label,
      queue_tag: dto.queue_tag,
      source_label: dto.source_label,
      status: ExerciseReviewSubmissionStatus.pending,
      title: dto.title?.trim() || dto.proposed_name.trim(),
      trigger_label: dto.trigger_label,
      user: { connect: { id: userId } },
      ...(dto.pose_session_id
        ? { pose_session: { connect: { id: dto.pose_session_id } } }
        : {}),
    });
    const creatorContextByUserId = await this.loadCreatorReviewContext([
      userId,
    ]);

    return this.toReviewSubmissionResponse(
      createdSubmission,
      creatorContextByUserId.get(userId),
    );
  }

  async createExerciseDraftProposal(
    dto: CreateExerciseDraftProposalDTO,
    userId: string,
  ): Promise<ExerciseDraftProposalResponseDTO> {
    await this.ensureCanSubmitExerciseDraft(userId);
    await this.ensurePoseSessionBelongsToUser(dto.pose_session_id, userId);

    const proposedName = normalizeDraftLabel(
      dto.proposed_name,
      'Custom Exercise Draft',
    );
    const evidence = normalizeUnknownObject(dto.evidence) ?? {};
    const incomingMovementProfile = normalizeUnknownObject(dto.movement_profile);
    const evidenceMovementContract = normalizeUnknownObject(
      evidence.movementContract,
    );
    const evidenceRig = normalizeUnknownObject(evidence.rig);
    const movementProfile =
      incomingMovementProfile ??
      ({
        movementContract: evidenceMovementContract,
        rig: evidenceRig,
        schemaVersion: 'exercise_movement_profile_v1',
        warnings: [
          'Generated from submitted draft evidence; verify before publishing.',
        ],
      } satisfies Record<string, unknown>);
    const confidence =
      typeof evidence.confidence === 'number'
        ? Math.max(0, Math.min(1, evidence.confidence))
        : 0.58;
    const muscleGroup =
      dto.muscle_group?.trim() || inferMuscleGroupFromName(proposedName);
    const muscleTargets = normalizeUnknownArray(dto.muscle_targets);
    const normalizedMuscleTargets = muscleTargets.length
      ? muscleTargets
      : [
          {
            allocationPercent: 100,
            muscleGroup,
            role: 'primary',
          },
        ];
    const normalizedEvidence = {
      confidence,
      integrityNotes: normalizeUnknownArray(evidence.integrityNotes),
      movementContract:
        normalizeUnknownObject(movementProfile.movementContract) ??
        evidenceMovementContract,
      promptContractVersion: 'exercise_creation_v1',
      repCount: Number.isFinite(Number(evidence.repCount))
        ? Number(evidence.repCount)
        : 0,
      rig: normalizeUnknownObject(movementProfile.rig) ?? evidenceRig,
      schemaVersion: 'exercise_ai_draft_v1',
      source: 'mobile_pose_session',
    };

    const fallbackProposal: ExerciseDraftProposalResponseDTO = {
      category: dto.category ?? ExerciseCategory.strength,
      confidence,
      description:
        dto.description?.trim() ||
        `${proposedName} generated from pose evidence and editable movement thresholds.`,
      evidence: normalizedEvidence,
      hand_shape_profile:
        normalizeUnknownObject(dto.hand_shape_profile) ??
        createDefaultHandShapeProfile(proposedName),
      instructions:
        dto.instructions?.trim() ||
        'Use the visual rig to confirm the start position, peak contraction, and controlled return before publishing.',
      movement_profile: movementProfile,
      muscle_group: muscleGroup,
      muscle_targets: normalizedMuscleTargets,
      proposal_source: 'deterministic_fallback',
      proposed_name: proposedName,
      review_warnings: [
        'AI-assisted draft endpoint used deterministic fallback; validate rig, thresholds, and muscles before publishing.',
      ],
      summary:
        dto.summary?.trim() ||
        `${proposedName} draft generated from submitted pose evidence.`,
    };

    const aiProposal = await this.tryCreateAiExerciseDraftProposal(
      dto,
      fallbackProposal,
    );

    return aiProposal ?? fallbackProposal;
  }

  private async tryCreateAiExerciseDraftProposal(
    dto: CreateExerciseDraftProposalDTO,
    fallbackProposal: ExerciseDraftProposalResponseDTO,
  ): Promise<ExerciseDraftProposalResponseDTO | null> {
    const apiBaseUrl = this.config.get<string>('ai.apiBaseUrl', '').trim();
    if (!apiBaseUrl) {
      return null;
    }

    const requestTimeoutMs = Math.max(
      1000,
      Number(this.config.get<number>('ai.requestTimeoutMs', 60000)) || 60000,
    );

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/exercise-drafts/propose`,
        {
          body: JSON.stringify({
            category: dto.category ?? fallbackProposal.category,
            description: dto.description ?? fallbackProposal.description,
            evidence: normalizeUnknownObject(dto.evidence) ?? fallbackProposal.evidence,
            hand_shape_profile:
              normalizeUnknownObject(dto.hand_shape_profile) ??
              fallbackProposal.hand_shape_profile,
            instructions: dto.instructions ?? fallbackProposal.instructions,
            movement_profile:
              normalizeUnknownObject(dto.movement_profile) ??
              fallbackProposal.movement_profile,
            muscle_group: dto.muscle_group ?? fallbackProposal.muscle_group,
            muscle_targets:
              normalizeUnknownArray(dto.muscle_targets).length > 0
                ? normalizeUnknownArray(dto.muscle_targets)
                : fallbackProposal.muscle_targets,
            pose_session_id: dto.pose_session_id ?? null,
            proposed_name: dto.proposed_name ?? fallbackProposal.proposed_name,
            summary: dto.summary ?? fallbackProposal.summary,
          }),
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(requestTimeoutMs),
        },
      );

      if (!response.ok) {
        return null;
      }

      return this.mergeAiDraftProposal(
        (await response.json()) as AiExerciseDraftProposalPayload,
        fallbackProposal,
      );
    } catch {
      return null;
    }
  }

  private mergeAiDraftProposal(
    payload: AiExerciseDraftProposalPayload,
    fallbackProposal: ExerciseDraftProposalResponseDTO,
  ): ExerciseDraftProposalResponseDTO | null {
    const aiPayload = normalizeUnknownObject(payload);
    if (!aiPayload) {
      return null;
    }
    if (aiPayload.proposal_source !== 'ai') {
      return null;
    }

    const movementProfile =
      normalizeUnknownObject(aiPayload.movement_profile) ??
      fallbackProposal.movement_profile;
    const handShapeProfile =
      normalizeUnknownObject(aiPayload.hand_shape_profile) ??
      fallbackProposal.hand_shape_profile;
    const evidence =
      normalizeUnknownObject(aiPayload.evidence) ?? fallbackProposal.evidence;
    const muscleTargets = normalizeUnknownArray(aiPayload.muscle_targets);
    const reviewWarnings = normalizeUnknownArray(aiPayload.review_warnings)
      .filter((warning): warning is string => typeof warning === 'string')
      .map((warning) => warning.trim())
      .filter(Boolean);

    if (!movementProfile || !handShapeProfile || !evidence) {
      return null;
    }

    return {
      ...fallbackProposal,
      category: isExerciseCategory(aiPayload.category)
        ? aiPayload.category
        : fallbackProposal.category,
      confidence:
        typeof aiPayload.confidence === 'number' &&
        Number.isFinite(aiPayload.confidence)
          ? Math.max(0, Math.min(1, aiPayload.confidence))
          : fallbackProposal.confidence,
      description: this.normalizeAiDraftText(
        aiPayload.description,
        fallbackProposal.description,
      ),
      evidence,
      hand_shape_profile: handShapeProfile,
      instructions: this.normalizeAiDraftText(
        aiPayload.instructions,
        fallbackProposal.instructions,
      ),
      movement_profile: movementProfile,
      muscle_group: this.normalizeAiDraftText(
        aiPayload.muscle_group,
        fallbackProposal.muscle_group,
      ),
      muscle_targets: muscleTargets.length
        ? muscleTargets
        : fallbackProposal.muscle_targets,
      proposal_source: 'ai',
      proposed_name: normalizeDraftLabel(
        aiPayload.proposed_name,
        fallbackProposal.proposed_name,
      ),
      review_warnings: reviewWarnings.length
        ? reviewWarnings
        : [
            'AI-assisted proposal generated; validate rig, thresholds, and muscles before publishing.',
          ],
      summary: this.normalizeAiDraftText(
        aiPayload.summary,
        fallbackProposal.summary,
      ),
    };
  }

  private normalizeAiDraftText(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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
        fallbackDefinitions.find((definition) => definition.key === fallbackKey) ??
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
    const activeKeys = new Set(activeDefinitions.map((definition) => definition.key));
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
      ),
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
      hand_shape_profile: toJsonInput(dto.hand_shape_profile),
      instructions: dto.instructions,
      movement_profile: toJsonInput(dto.movement_profile),
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
      is_active: definition.is_active,
      is_system: definition.is_system,
      key: definition.key,
      name: definition.name,
      sort_order: definition.sort_order,
      updated_at: definition.updated_at.toISOString(),
    };
  }

  private toResponse(exercise: ExerciseCatalog): ExerciseResponseDTO {
    return {
      id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      muscle_targets: normalizeJsonArray(exercise.muscle_targets),
      movement_profile: normalizeJsonObject(exercise.movement_profile),
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
      creator_display_name: this.toCreatorDisplayName(creatorContext?.identity),
      creator_email: this.toCreatorEmail(creatorContext?.identity),
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
      muscle_targets: normalizeJsonArray(submission.muscle_targets),
      movement_profile: normalizeJsonObject(submission.movement_profile),
      hand_shape_profile: normalizeJsonObject(submission.hand_shape_profile),
      description: submission.description ?? null,
      instructions: submission.instructions ?? null,
      evidence_bars: normalizeReviewEvidence(submission.evidence_bars),
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

    const [profiles, statusRows, identities] = await Promise.all([
      this.repo.listCreatorProfilesByUserIds(uniqueUserIds),
      this.repo.listReviewSubmissionStatusesByUserIds(uniqueUserIds),
      this.repo.listCreatorUserIdentitiesByUserIds(uniqueUserIds),
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
        identity: null,
        profile: null,
      });
    }

    for (const identity of identities) {
      const context = contextByUserId.get(identity.id);
      if (context) {
        context.identity = identity;
      }
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

  private toCreatorDisplayName(
    identity: CreatorUserIdentityRecord | null | undefined,
  ): string | null {
    const profile = identity?.profile;
    const displayName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    return displayName || null;
  }

  private toCreatorEmail(
    identity: CreatorUserIdentityRecord | null | undefined,
  ): string | null {
    return identity?.auth_identities[0]?.identifier ?? null;
  }

  private async ensureCanSubmitExerciseDraft(userId: string): Promise<void> {
    const access = await this.repo.findCreatorSubmissionAccess(userId);
    if (!access) {
      throw new NotFoundException('User not found.');
    }

    if (access.role === UserRole.admin || access.role === UserRole.staff) {
      return;
    }

    if (
      access.creatorProfileState === CreatorState.approved ||
      access.creatorProfileState === CreatorState.candidate ||
      access.creatorProfileState === CreatorState.pending_review
    ) {
      return;
    }

    throw new ForbiddenException(
      'Only admins, staff, and approved creator candidates can submit exercise drafts.',
    );
  }

  private async ensurePoseSessionBelongsToUser(
    poseSessionId: string | null | undefined,
    userId: string,
  ): Promise<void> {
    if (!poseSessionId) return;

    const ownerUserId = await this.repo.findPoseSessionOwner(poseSessionId);
    if (!ownerUserId || ownerUserId !== userId) {
      throw new NotFoundException('Pose session not found.');
    }
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
