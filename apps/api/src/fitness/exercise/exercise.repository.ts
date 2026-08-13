import { ConflictException, Injectable } from '@nestjs/common';
import {
  AuthProvider,
  CreatorProfile,
  CreatorState,
  ExerciseCatalog,
  ExerciseReviewSubmission,
  ExerciseReviewSubmissionStatus,
  MembershipCardStatus,
  ModerationActionType,
  MuscleDefinition,
  Prisma,
  UserRole,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExerciseFilterDTO,
  MuscleDefinitionFilterDTO,
} from './dto/exercise.dto';
import { ExerciseReviewSubmissionFilterDTO } from './dto/exercise-review.dto';

const exerciseOrderBy = [
  { muscle_group: 'asc' },
  { name: 'asc' },
] satisfies Prisma.ExerciseCatalogOrderByWithRelationInput[];

export type ActiveExerciseGenerationRecord = Pick<
  ExerciseCatalog,
  'id' | 'name' | 'muscle_group' | 'category'
>;

export type ExerciseReviewSubmissionRecord = ExerciseReviewSubmission;

export type CreatorProfileRecord = CreatorProfile;

export type CreatorUserIdentityRecord = {
  auth_identities: { identifier: string }[];
  id: string;
  profile: { first_name: string; last_name: string } | null;
};

export type ExerciseReviewSubmissionStatusRecord = Pick<
  ExerciseReviewSubmission,
  'status' | 'user_id'
>;

export type CreatorSubmissionAccessRecord = {
  creatorProfileState: CreatorState | null;
  membershipCardStatus: MembershipCardStatus | null;
  role: UserRole;
};

export type MuscleDefinitionRecord = MuscleDefinition;

const creatorModerationActionByState: Partial<
  Record<CreatorState, ModerationActionType>
> = {
  [CreatorState.approved]: ModerationActionType.approve_creator,
  [CreatorState.suspended]: ModerationActionType.suspend_creator,
  [CreatorState.revoked]: ModerationActionType.revoke_creator,
};

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

  listReviewSubmissions(
    dto: ExerciseReviewSubmissionFilterDTO,
  ): Promise<PaginatedResult<ExerciseReviewSubmissionRecord>> {
    const where: Prisma.ExerciseReviewSubmissionWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.category ? { category: dto.category } : {}),
    };

    if (dto.muscle_group?.trim()) {
      where.muscle_group = {
        contains: dto.muscle_group.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.search?.trim()) {
      const term = dto.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { proposed_name: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
        { source_label: { contains: term, mode: 'insensitive' } },
        { origin_label: { contains: term, mode: 'insensitive' } },
        { queue_tag: { contains: term, mode: 'insensitive' } },
        { trigger_label: { contains: term, mode: 'insensitive' } },
        { match_hint: { contains: term, mode: 'insensitive' } },
        { muscle_group: { contains: term, mode: 'insensitive' } },
        {
          user: {
            profile: {
              is: {
                OR: [
                  { first_name: { contains: term, mode: 'insensitive' } },
                  { last_name: { contains: term, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
        {
          user: {
            auth_identities: {
              some: {
                identifier: { contains: term, mode: 'insensitive' },
                provider: AuthProvider.email,
              },
            },
          },
        },
      ];
    }

    return this.paginate<ExerciseReviewSubmissionRecord>(
      this.prisma.exerciseReviewSubmission,
      {
        where,
        orderBy: [{ created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
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

  listCreatorProfilesByUserIds(
    userIds: string[],
  ): Promise<CreatorProfileRecord[]> {
    if (!userIds.length) return Promise.resolve([]);

    return this.prisma.creatorProfile.findMany({
      where: { user_id: { in: userIds } },
    });
  }

  listCreatorUserIdentitiesByUserIds(
    userIds: string[],
  ): Promise<CreatorUserIdentityRecord[]> {
    if (!userIds.length) return Promise.resolve([]);

    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        auth_identities: {
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
          select: { identifier: true },
          take: 1,
          where: { provider: AuthProvider.email },
        },
        id: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  listReviewSubmissionStatusesByUserIds(
    userIds: string[],
  ): Promise<ExerciseReviewSubmissionStatusRecord[]> {
    if (!userIds.length) return Promise.resolve([]);

    return this.prisma.exerciseReviewSubmission.findMany({
      where: { user_id: { in: userIds } },
      select: {
        status: true,
        user_id: true,
      },
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

  createReviewSubmission(
    data: Prisma.ExerciseReviewSubmissionCreateInput,
  ): Promise<ExerciseReviewSubmissionRecord> {
    return this.create<ExerciseReviewSubmissionRecord>(
      this.prisma.exerciseReviewSubmission,
      data,
    );
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

  async updateReviewSubmission(
    id: string,
    data: Prisma.ExerciseReviewSubmissionUpdateInput,
    creatorGovernance?: {
      actorUserId?: string;
      note?: string;
      state?: CreatorState;
    },
  ): Promise<ExerciseReviewSubmissionRecord> {
    const existingSubmission =
      await this.findByIdOrThrow<ExerciseReviewSubmissionRecord>(
        this.prisma.exerciseReviewSubmission,
        id,
        'Exercise review submission',
      );

    return this.prisma.$transaction(async (tx) => {
      const updatedSubmission = await tx.exerciseReviewSubmission.update({
        where: { id },
        data,
      });

      const existingProfile = await tx.creatorProfile.findUnique({
        where: { user_id: existingSubmission.user_id },
      });
      const shouldAutoPromoteCandidate =
        updatedSubmission.status === ExerciseReviewSubmissionStatus.published &&
        (!existingProfile || existingProfile.state === CreatorState.none);
      const nextCreatorState =
        creatorGovernance?.state ??
        (shouldAutoPromoteCandidate ? CreatorState.candidate : undefined);

      if (!nextCreatorState && !creatorGovernance?.note?.trim()) {
        return updatedSubmission;
      }

      const now = new Date();
      const nextAdminNote =
        creatorGovernance?.note?.trim() ||
        (shouldAutoPromoteCandidate
          ? `Auto-candidacy from published Exercise Lab submission: ${updatedSubmission.title}.`
          : undefined);
      const nextState =
        nextCreatorState ?? existingProfile?.state ?? CreatorState.none;
      const profile = await tx.creatorProfile.upsert({
        where: { user_id: existingSubmission.user_id },
        create: {
          user_id: existingSubmission.user_id,
          state: nextState,
          last_state_changed_at: nextCreatorState ? now : null,
          admin_notes: nextAdminNote,
        },
        update: {
          ...(nextCreatorState
            ? { state: nextState, last_state_changed_at: now }
            : {}),
          ...(nextAdminNote !== undefined
            ? { admin_notes: nextAdminNote }
            : {}),
        },
      });

      const moderationActionType = creatorModerationActionByState[nextState];
      const stateChanged = existingProfile?.state !== profile.state;
      if (moderationActionType && stateChanged) {
        await tx.moderationActionRecord.create({
          data: {
            actor_user_id: creatorGovernance?.actorUserId,
            target_user_id: existingSubmission.user_id,
            action_type: moderationActionType,
            rationale:
              nextAdminNote ?? `Creator state changed to ${nextState}.`,
            before_state: {
              creator_state: existingProfile?.state ?? CreatorState.none,
              submission_id: updatedSubmission.id,
              submission_status: existingSubmission.status,
            } satisfies Prisma.JsonObject,
            after_state: {
              creator_state: profile.state,
              submission_id: updatedSubmission.id,
              submission_status: updatedSubmission.status,
            } satisfies Prisma.JsonObject,
          },
        });
      }

      return updatedSubmission;
    });
  }

  async findCreatorSubmissionAccess(
    userId: string,
  ): Promise<CreatorSubmissionAccessRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        membership_card: { select: { status: true } },
        creator_profile: { select: { state: true } },
      },
    });

    if (!user) return null;

    return {
      creatorProfileState: user.creator_profile?.state ?? null,
      membershipCardStatus: user.membership_card?.status ?? null,
      role: user.role,
    };
  }

  async findPoseSessionOwner(poseSessionId: string): Promise<string | null> {
    const poseSession = await this.prisma.poseSession.findUnique({
      where: { id: poseSessionId },
      select: { user_id: true },
    });

    return poseSession?.user_id ?? null;
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
