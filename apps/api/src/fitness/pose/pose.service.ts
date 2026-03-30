import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Prisma, UserStatus } from '@prisma/client';
import Redis from 'ioredis';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import {
  AiPythonClientService,
  PoseAnalyzeResponse,
} from '../../ai/ai-python-client.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  FinalizePoseSessionDTO,
  PoseProfileFilterDTO,
  PoseProfileResponseDTO,
  PoseSessionEndReason,
  PoseSessionResponseDTO,
} from './dto/pose.dto';
import {
  PoseBootstrapProfileRecord,
  PoseProfileRecord,
  PoseRepository,
  PoseSessionDetailRecord,
} from './pose.repository';

export type PoseConnectionState = {
  poseSessionId: string;
  userId: string;
  exerciseHint: string | null;
  repCountAi: number;
  confidenceSum: number;
  confidenceSamples: number;
  acceptedFps: number;
  subjectLockMode: 'single_subject';
};

export type PoseFrameProcessingResult = {
  nextState: PoseConnectionState;
  analysis: PoseAnalyzeResponse;
};

type JsonObject = Record<string, unknown>;

const poseStarterCatalog = [
  'push_up',
  'squat',
  'bicep_curl',
  'shoulder_press',
  'plank',
] as const;

@Injectable()
export class PoseService {
  constructor(
    private readonly repo: PoseRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly aiClient: AiPythonClientService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async authenticateSocket(client: Socket): Promise<JwtPayload> {
    const token = this.extractToken(client);
    const secret = this.config.get<string>('jwt.secret', '');

    if (!token || !secret) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    const blacklisted = await this.redis.get(`token_blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new UnauthorizedException({
        type: 'TOKEN_REVOKED',
        title: 'Token Revoked',
        status: 401,
        detail: 'This token has been revoked. Please log in again.',
      });
    }

    if (payload.status !== UserStatus.active) {
      throw new ForbiddenException({
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        status: 403,
        detail: `Your account is ${payload.status}. Contact support.`,
      });
    }

    return payload;
  }

  async startPoseSession(
    userId: string,
    exerciseHint: string | null,
  ): Promise<PoseConnectionState> {
    const canonicalHint = this.toCanonicalExerciseHint(exerciseHint);
    const started = await this.repo.createPoseSession({
      userId,
      exerciseHint,
      startedAt: new Date(),
    });
    const candidateProfiles = await this.repo.listBootstrapPoseProfiles({
      exerciseHint,
      canonicalHint,
    });
    const bootstrap = await this.aiClient.bootstrapPoseSession({
      poseSessionId: started.id,
      exerciseHint,
      starterCatalog: [...poseStarterCatalog],
      candidateProfiles: candidateProfiles.map((profile) =>
        this.toPoseBootstrapProfile(profile),
      ),
    });

    return {
      poseSessionId: started.id,
      userId: started.user_id,
      exerciseHint: started.exercise_hint ?? null,
      repCountAi: started.rep_count_ai,
      confidenceSum: 0,
      confidenceSamples: 0,
      acceptedFps: bootstrap.accepted_fps,
      subjectLockMode: bootstrap.subject_lock_mode,
    };
  }

  async analyzeFrame(
    state: PoseConnectionState,
    frameBase64: string,
  ): Promise<PoseFrameProcessingResult> {
    if (typeof frameBase64 !== 'string' || frameBase64.trim().length === 0) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Pose Frame',
        status: 400,
        detail: 'frame_b64 is required.',
      });
    }

    const analysis = await this.aiClient.analyzePoseFrame({
      poseSessionId: state.poseSessionId,
      frameBase64: frameBase64.trim(),
    });
    const confidence = analysis.confidence;
    const repCountDelta =
      analysis.rep_count_delta ?? (analysis.rep_event ? 1 : 0);

    return {
      analysis,
      nextState: {
        ...state,
        repCountAi: state.repCountAi + repCountDelta,
        confidenceSum: state.confidenceSum + confidence,
        confidenceSamples: state.confidenceSamples + 1,
      },
    };
  }

  async finalizePoseSession(
    state: PoseConnectionState,
    endedReason: PoseSessionEndReason = 'client_disconnect',
  ): Promise<PoseSessionResponseDTO> {
    void endedReason;

    const session = await this.repo.findPoseSessionByIdOrThrow(
      state.poseSessionId,
    );
    this.assertPoseSessionOwner(session, state.userId);

    return this.finalizeOpenPoseSession(session, state);
  }

  async getPoseSessionById(
    userId: string,
    poseSessionId: string,
  ): Promise<PoseSessionResponseDTO> {
    const session = await this.repo.findPoseSessionByIdOrThrow(poseSessionId);
    this.assertPoseSessionOwner(session, userId);
    return this.toPoseSessionResponse(session);
  }

  async finalizePoseSessionById(
    userId: string,
    poseSessionId: string,
    dto: FinalizePoseSessionDTO,
  ): Promise<PoseSessionResponseDTO> {
    void dto;

    const session = await this.repo.findPoseSessionByIdOrThrow(poseSessionId);
    this.assertPoseSessionOwner(session, userId);

    return this.finalizeOpenPoseSession(session);
  }

  async listPoseProfiles(
    dto: PoseProfileFilterDTO,
  ): Promise<PaginatedResult<PoseProfileResponseDTO>> {
    const result = await this.repo.listPoseProfiles(dto);

    return {
      data: result.data.map((profile) => this.toPoseProfileResponse(profile)),
      meta: result.meta,
    };
  }

  normalizeExerciseHint(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async finalizeOpenPoseSession(
    session: PoseSessionDetailRecord,
    state?: PoseConnectionState,
  ): Promise<PoseSessionResponseDTO> {
    if (session.ended_at) {
      return this.toPoseSessionResponse(session);
    }

    const finalized = await this.aiClient.finalizePoseSession({
      poseSessionId: session.id,
    });
    const persisted = await this.repo.finalizePoseSession({
      poseSessionId: session.id,
      endedAt: new Date(),
      repCountAi: finalized.analysis_summary.reps_detected,
      confidenceAvg:
        finalized.analysis_summary.average_confidence ??
        this.toPoseConfidenceAverage(state),
      detectedExerciseName: finalized.detected_exercise_name,
      detectedProfileId: finalized.matched_profile_id,
      classificationConfidence: finalized.classification_confidence,
      subjectLockConfidence: finalized.subject_lock_confidence,
      analysisSummary: this.toPrismaJsonObject(finalized.analysis_summary),
      learnedProfile: finalized.learned_profile
        ? {
            canonicalName: finalized.learned_profile.canonical_name,
            exerciseId: null,
            landmarkSignature: this.toPrismaJsonObject(
              finalized.learned_profile.landmark_signature,
            ),
            angleSignature: this.toPrismaJsonObject(
              finalized.learned_profile.angle_signature,
            ),
            repRules: finalized.learned_profile.rep_rules
              ? this.toPrismaJsonObject(finalized.learned_profile.rep_rules)
              : null,
          }
        : null,
    });

    return this.toPoseSessionResponse(persisted);
  }

  private extractToken(client: Socket): string | null {
    const authToken = this.normalizeTokenValue(
      (client.handshake.auth as { token?: unknown } | undefined)?.token,
    );
    if (authToken) {
      return authToken;
    }

    const headerToken = this.normalizeTokenValue(
      client.handshake.headers.authorization,
    );
    if (headerToken) {
      return headerToken;
    }

    return this.normalizeTokenValue(client.handshake.query.token);
  }

  private normalizeTokenValue(value: unknown): string | null {
    const rawValue: unknown = Array.isArray(value)
      ? (value as unknown[])[0]
      : value;

    if (typeof rawValue !== 'string') {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.replace(/^Bearer\s+/i, '');
  }

  private toCanonicalExerciseHint(exerciseHint: string | null): string | null {
    const normalized = exerciseHint?.trim().toLowerCase().replace(/\s+/g, '_');

    if (!normalized) {
      return null;
    }

    const knownCatalog = {
      push_up: ['push_up', 'pushup'],
      squat: ['squat'],
      bicep_curl: ['bicep_curl', 'curl'],
      shoulder_press: ['shoulder_press', 'press'],
      plank: ['plank'],
    } satisfies Record<(typeof poseStarterCatalog)[number], string[]>;

    for (const [canonicalName, aliases] of Object.entries(knownCatalog)) {
      if (aliases.some((alias) => normalized.includes(alias))) {
        return canonicalName;
      }
    }

    return null;
  }

  private toPoseBootstrapProfile(profile: PoseBootstrapProfileRecord): {
    id: string;
    canonical_name: string;
    profile_kind: 'seed' | 'learned';
    landmark_signature: Record<string, unknown>;
    angle_signature: Record<string, unknown>;
    rep_rules?: Record<string, unknown> | null;
  } {
    return {
      id: profile.id,
      canonical_name: profile.canonical_name,
      profile_kind: profile.profile_kind,
      landmark_signature: this.toRequiredJsonObject(profile.landmark_signature),
      angle_signature: this.toRequiredJsonObject(profile.angle_signature),
      rep_rules: this.toOptionalJsonObject(profile.rep_rules),
    };
  }

  private assertPoseSessionOwner(
    session: Pick<PoseSessionDetailRecord, 'user_id'>,
    userId: string,
  ): void {
    if (session.user_id !== userId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Pose Session Forbidden',
        status: 403,
        detail: 'You can only access your own pose sessions.',
      });
    }
  }

  private toPoseSessionResponse(
    session: PoseSessionDetailRecord,
  ): PoseSessionResponseDTO {
    return {
      id: session.id,
      user_id: session.user_id,
      exercise_log_id: session.exercise_log_id ?? null,
      exercise_hint: session.exercise_hint ?? null,
      rep_count_ai: session.rep_count_ai,
      confidence_avg: this.toDecimalString(session.confidence_avg),
      detected_exercise_name: session.detected_exercise_name ?? null,
      detected_profile_id: session.detected_profile_id ?? null,
      classification_confidence: this.toDecimalString(
        session.classification_confidence,
      ),
      subject_lock_confidence: this.toDecimalString(
        session.subject_lock_confidence,
      ),
      analysis_summary: this.toOptionalJsonObject(session.analysis_summary),
      started_at: session.started_at.toISOString(),
      ended_at: session.ended_at?.toISOString() ?? null,
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString(),
    };
  }

  private toPoseProfileResponse(
    profile: PoseProfileRecord,
  ): PoseProfileResponseDTO {
    return {
      id: profile.id,
      exercise_id: profile.exercise_id ?? null,
      exercise_name: profile.exercise?.name ?? null,
      canonical_name: profile.canonical_name,
      profile_kind: profile.profile_kind,
      landmark_signature: this.toRequiredJsonObject(profile.landmark_signature),
      angle_signature: this.toRequiredJsonObject(profile.angle_signature),
      rep_rules: this.toOptionalJsonObject(profile.rep_rules),
      sample_count: profile.sample_count,
      confidence_threshold: this.toDecimalString(profile.confidence_threshold),
      is_active: profile.is_active,
      created_at: profile.created_at.toISOString(),
      updated_at: profile.updated_at.toISOString(),
    };
  }

  private toDecimalString(
    value: { toString(): string } | null | undefined,
  ): string | null {
    return value?.toString() ?? null;
  }

  private toRequiredJsonObject(value: Prisma.JsonValue): JsonObject {
    return this.toOptionalJsonObject(value) ?? {};
  }

  private toPrismaJsonObject(value: JsonObject): Prisma.InputJsonObject {
    return value as Prisma.InputJsonObject;
  }

  private toPoseConfidenceAverage(
    state: PoseConnectionState | undefined,
  ): number | null {
    if (!state || state.confidenceSamples === 0) {
      return null;
    }

    return state.confidenceSum / state.confidenceSamples;
  }

  private toOptionalJsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): JsonObject | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    return value as JsonObject;
  }
}
