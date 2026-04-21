import { Injectable } from '@nestjs/common';
import { PoseProfileKind, PoseSession, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PoseProfileFilterDTO } from './dto/pose.dto';

const poseProfileOrderBy = [
  { canonical_name: 'asc' },
  { created_at: 'desc' },
] satisfies Prisma.PoseExerciseProfileOrderByWithRelationInput[];

const poseSessionDetailSelect = {
  id: true,
  user_id: true,
  exercise_log_id: true,
  exercise_hint: true,
  rep_count_ai: true,
  confidence_avg: true,
  detected_exercise_name: true,
  detected_profile_id: true,
  classification_confidence: true,
  subject_lock_confidence: true,
  analysis_summary: true,
  started_at: true,
  ended_at: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.PoseSessionSelect;

const poseProfileSelect = {
  id: true,
  exercise_id: true,
  canonical_name: true,
  profile_kind: true,
  landmark_signature: true,
  angle_signature: true,
  orientation_signature: true,
  movement_pattern: true,
  visibility_pattern: true,
  dominant_joint: true,
  tolerance: true,
  rep_thresholds: true,
  rep_rules: true,
  sample_count: true,
  confidence_threshold: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  exercise: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PoseExerciseProfileSelect;

const poseBootstrapProfileSelect = {
  id: true,
  canonical_name: true,
  profile_kind: true,
  landmark_signature: true,
  angle_signature: true,
  orientation_signature: true,
  movement_pattern: true,
  visibility_pattern: true,
  dominant_joint: true,
  tolerance: true,
  rep_thresholds: true,
  rep_rules: true,
} satisfies Prisma.PoseExerciseProfileSelect;

export type PoseSessionRecord = Pick<
  PoseSession,
  | 'id'
  | 'user_id'
  | 'exercise_hint'
  | 'rep_count_ai'
  | 'started_at'
  | 'ended_at'
>;

export type PoseSessionDetailRecord = Pick<
  PoseSession,
  keyof typeof poseSessionDetailSelect
>;

export type PoseProfileRecord = Prisma.PoseExerciseProfileGetPayload<{
  select: typeof poseProfileSelect;
}>;

export type PoseBootstrapProfileRecord = Prisma.PoseExerciseProfileGetPayload<{
  select: typeof poseBootstrapProfileSelect;
}>;

@Injectable()
export class PoseRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  createPoseSession(input: {
    userId: string;
    exerciseHint: string | null;
    startedAt: Date;
  }): Promise<PoseSessionRecord> {
    return this.prisma.poseSession.create({
      data: {
        user: { connect: { id: input.userId } },
        exercise_hint: input.exerciseHint,
        started_at: input.startedAt,
      },
      select: {
        id: true,
        user_id: true,
        exercise_hint: true,
        rep_count_ai: true,
        started_at: true,
        ended_at: true,
      },
    });
  }

  deletePoseSessionById(poseSessionId: string): Promise<void> {
    return this.prisma.poseSession
      .deleteMany({
        where: {
          id: poseSessionId,
        },
      })
      .then(() => undefined);
  }

  listBootstrapPoseProfiles(input: {
    exerciseHint: string | null;
    canonicalHint: string | null;
  }): Promise<PoseBootstrapProfileRecord[]> {
    const where: Prisma.PoseExerciseProfileWhereInput = {
      is_active: true,
    };
    const hintFilters: Prisma.PoseExerciseProfileWhereInput[] = [];

    if (input.canonicalHint) {
      hintFilters.push({
        canonical_name: input.canonicalHint,
      });
    }

    if (input.exerciseHint) {
      hintFilters.push({
        exercise: {
          name: {
            contains: input.exerciseHint,
            mode: 'insensitive',
          },
        },
      });
    }

    if (hintFilters.length > 0) {
      where.OR = hintFilters;
    }

    return this.prisma.poseExerciseProfile.findMany({
      where,
      orderBy: poseProfileOrderBy,
      select: poseBootstrapProfileSelect,
    });
  }

  async finalizePoseSession(input: {
    poseSessionId: string;
    endedAt: Date;
    repCountAi: number;
    confidenceAvg: number | null;
    detectedExerciseName: string | null;
    detectedProfileId: string | null;
    classificationConfidence: number | null;
    subjectLockConfidence: number | null;
    analysisSummary: Prisma.InputJsonObject | null;
      learnedProfile?: {
        canonicalName: string;
        exerciseId: string | null;
        landmarkSignature: Prisma.InputJsonObject;
        angleSignature: Prisma.InputJsonObject;
        orientationSignature: Prisma.InputJsonObject;
        movementPattern: Prisma.InputJsonObject;
        visibilityPattern: Prisma.InputJsonObject;
        dominantJoint?: string | null;
        tolerance?: number | null;
        repThresholds?: Prisma.InputJsonObject | null;
        repRules?: Prisma.InputJsonObject | null;
      } | null;
  }): Promise<PoseSessionDetailRecord> {
    return this.prisma.$transaction(async (tx) => {
      let detectedProfileId = input.detectedProfileId;

      if (!detectedProfileId && input.learnedProfile) {
        const learnedProfile = await tx.poseExerciseProfile.create({
          data: {
            exercise_id: input.learnedProfile.exerciseId,
            canonical_name: input.learnedProfile.canonicalName,
            profile_kind: PoseProfileKind.learned,
            landmark_signature: input.learnedProfile.landmarkSignature,
            angle_signature: input.learnedProfile.angleSignature,
            orientation_signature: input.learnedProfile.orientationSignature,
            movement_pattern: input.learnedProfile.movementPattern,
            visibility_pattern: input.learnedProfile.visibilityPattern,
            dominant_joint: input.learnedProfile.dominantJoint,
            tolerance: this.toDecimal(input.learnedProfile.tolerance),
            rep_thresholds:
              input.learnedProfile.repThresholds ?? Prisma.JsonNull,
            rep_rules: input.learnedProfile.repRules ?? Prisma.JsonNull,
          },
          select: {
            id: true,
          },
        });

        detectedProfileId = learnedProfile.id;
      }

      return tx.poseSession.update({
        where: { id: input.poseSessionId },
        data: {
          ended_at: input.endedAt,
          rep_count_ai: input.repCountAi,
          confidence_avg: this.toDecimal(input.confidenceAvg),
          detected_exercise_name: input.detectedExerciseName,
          detected_profile_id: detectedProfileId,
          classification_confidence: this.toDecimal(
            input.classificationConfidence,
          ),
          subject_lock_confidence: this.toDecimal(input.subjectLockConfidence),
          analysis_summary: input.analysisSummary ?? Prisma.JsonNull,
        },
        select: poseSessionDetailSelect,
      });
    });
  }

  updatePoseSessionAnalysis(input: {
    poseSessionId: string;
    repCountAi?: number;
    detectedExerciseName: string | null;
    detectedProfileId: string | null;
    classificationConfidence: number | null;
    subjectLockConfidence: number | null;
    analysisSummary: Prisma.InputJsonObject | null;
  }): Promise<PoseSessionDetailRecord> {
    return this.prisma.poseSession.update({
      where: { id: input.poseSessionId },
      data: {
        ...(input.repCountAi !== undefined
          ? { rep_count_ai: input.repCountAi }
          : {}),
        detected_exercise_name: input.detectedExerciseName,
        detected_profile_id: input.detectedProfileId,
        classification_confidence: this.toDecimal(input.classificationConfidence),
        subject_lock_confidence: this.toDecimal(input.subjectLockConfidence),
        analysis_summary: input.analysisSummary ?? Prisma.JsonNull,
      },
      select: poseSessionDetailSelect,
    });
  }

  findActivePoseProfileByCanonicalName(
    canonicalName: string,
  ): Promise<PoseProfileRecord | null> {
    return this.prisma.poseExerciseProfile.findFirst({
      where: {
        canonical_name: canonicalName,
        is_active: true,
      },
      orderBy: poseProfileOrderBy,
      select: poseProfileSelect,
    });
  }

  upsertLearnedPoseProfile(input: {
    canonicalName: string;
    exerciseId: string | null;
    landmarkSignature: Prisma.InputJsonObject;
    angleSignature: Prisma.InputJsonObject;
    orientationSignature: Prisma.InputJsonObject;
    movementPattern: Prisma.InputJsonObject;
    visibilityPattern: Prisma.InputJsonObject;
    dominantJoint?: string | null;
    tolerance?: number | null;
    repThresholds?: Prisma.InputJsonObject | null;
    repRules?: Prisma.InputJsonObject | null;
    confidenceThreshold?: number | null;
  }): Promise<PoseProfileRecord> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.poseExerciseProfile.findFirst({
        where: {
          canonical_name: input.canonicalName,
          profile_kind: PoseProfileKind.learned,
        },
        orderBy: poseProfileOrderBy,
        select: {
          id: true,
        },
      });

      if (!existing) {
        return tx.poseExerciseProfile.create({
          data: {
            canonical_name: input.canonicalName,
            exercise_id: input.exerciseId,
            profile_kind: PoseProfileKind.learned,
            landmark_signature: input.landmarkSignature,
            angle_signature: input.angleSignature,
            orientation_signature: input.orientationSignature,
            movement_pattern: input.movementPattern,
            visibility_pattern: input.visibilityPattern,
            dominant_joint: input.dominantJoint,
            tolerance: this.toDecimal(input.tolerance),
            rep_thresholds: input.repThresholds ?? Prisma.JsonNull,
            rep_rules: input.repRules ?? Prisma.JsonNull,
            confidence_threshold: this.toDecimal(input.confidenceThreshold),
          },
          select: poseProfileSelect,
        });
      }

      return tx.poseExerciseProfile.update({
        where: {
          id: existing.id,
        },
        data: {
          exercise_id: input.exerciseId,
          landmark_signature: input.landmarkSignature,
          angle_signature: input.angleSignature,
          orientation_signature: input.orientationSignature,
          movement_pattern: input.movementPattern,
          visibility_pattern: input.visibilityPattern,
          dominant_joint: input.dominantJoint,
          tolerance: this.toDecimal(input.tolerance),
          rep_thresholds: input.repThresholds ?? Prisma.JsonNull,
          rep_rules: input.repRules ?? Prisma.JsonNull,
          confidence_threshold: this.toDecimal(input.confidenceThreshold),
          is_active: true,
          sample_count: {
            increment: 1,
          },
        },
        select: poseProfileSelect,
      });
    });
  }

  findPoseSessionByIdOrThrow(
    poseSessionId: string,
  ): Promise<PoseSessionDetailRecord> {
    return this.findByIdOrThrow<PoseSessionDetailRecord>(
      this.prisma.poseSession,
      poseSessionId,
      'PoseSession',
      undefined,
      poseSessionDetailSelect,
    );
  }

  listPoseProfiles(
    dto: PoseProfileFilterDTO,
  ): Promise<PaginatedResult<PoseProfileRecord>> {
    const where: Prisma.PoseExerciseProfileWhereInput = {};

    if (dto.canonical_name) {
      where.canonical_name = {
        contains: dto.canonical_name.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.profile_kind) {
      where.profile_kind = dto.profile_kind;
    }

    return this.paginate<PoseProfileRecord>(
      this.prisma.poseExerciseProfile,
      {
        where,
        orderBy: poseProfileOrderBy,
        select: poseProfileSelect,
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  private toDecimal(
    value: number | null | undefined,
  ): Prisma.Decimal | null {
    return value == null ? null : new Prisma.Decimal(value.toFixed(3));
  }
}
