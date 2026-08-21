import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  type MasteryRank,
  MilestoneDefinitionStatus,
  MilestoneEvidenceRequirement,
  MilestoneProgressStatus,
  MilestoneVerificationPolicy,
  ModerationActionType,
  ProgressionIconKind,
  type MuscleMasteryProgress,
  Prisma,
  ProgressionSourceStatus,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import { type PaginatedResult } from '../../common/base-repository/base-repository';
import { FilesService } from '../../files/files.service';
import { type PaginationDTO } from '../../user/dto/user-dto';
import {
  UserService,
  type GamificationParticipantProfile,
} from '../../user/user.service';
import {
  WORKOUT_SESSION_COMPLETED_EVENT,
  type WorkoutSessionExerciseSummary,
  type WorkoutSessionCompletedEvent,
} from '../session/events/workout-session-completed.event';
import {
  POSE_SESSION_FINALIZED_EVENT,
  type PoseSessionFinalizedEvent,
} from '../pose/events/pose-session-finalized.event';
import {
  AdminGamificationOverviewResponseDTO,
  AdminGamificationSeasonListItemDTO,
  AdminGrantModerationDTO,
  AdminIntegrityCaseResponseDTO,
  AdminMilestoneDefinitionDTO,
  AdminMilestoneDefinitionFilterDTO,
  AdminMilestoneDefinitionResponseDTO,
  AdminMilestoneEvidenceFilterDTO,
  AdminManualExpGrantDTO,
  AchievementReviewResponseDTO,
  AdminProgressionGrantResponseDTO,
  AdminRankingOverrideDTO,
  AdminRankingOverrideResponseDTO,
  AdminMuscleLeaderboardFilterDTO,
  AdminSeasonCreateDTO,
  AdminSeasonStandingFilterDTO,
  AdminSeasonStandingRowDTO,
  AdminSeasonGovernanceResponseDTO,
  AdminSeasonStatusDTO,
  AdminSeasonUpdateDTO,
  IntegritySummaryResponseDTO,
  CreateIntegrityCaseDTO,
  LeaderboardEntryResponseDTO,
  LeaderboardFilterDTO,
  MasteryFilterDTO,
  MilestoneEvidenceSubmissionResponseDTO,
  MilestoneListFilterDTO,
  MilestoneProgressResponseDTO,
  MuscleLeaderboardFilterDTO,
  MuscleLeaderboardRowDTO,
  MuscleMasteryResponseDTO,
  ProgressionProfileResponseDTO,
  ProgressionSourceListFilterDTO,
  ProgressionSourceSummaryResponseDTO,
  RankingProfileResponseDTO,
  ReviewMilestoneEvidenceDTO,
  ResolveIntegrityCaseDTO,
  SeasonStandingResponseDTO,
  SeasonHistorySummaryDTO,
  SeasonTopPerformerFilterDTO,
  SubmitMilestoneEvidenceDTO,
  UpdateRankingProfileDTO,
} from './dto/gamification.dto';
import {
  DEFAULT_MILESTONE_ICON_KEY,
  evaluateMasteryRank,
  formatMasteryRankDisplay,
  getCompetitionRankPositions,
  isHigherMasteryRank,
  isAllowedProgressionLibraryIconKey,
  resolveProgressionIcon,
} from './gamification.constants';
import {
  GAMIFICATION_RANK_UP_EVENT,
  type GamificationRankUpEvent,
} from './events/rank-up.event';
import {
  type LeaderboardTotalRecord,
  type AchievementReviewRecord,
  GamificationRepository,
  type ActiveSeasonStandingRecord,
  type AdminGamificationOverviewRecord,
  type AdminMilestoneDefinitionRecord,
  type AdminSeasonListRecord,
  type AdminSeasonStandingRecord,
  type GrantModerationResult,
  type IntegrityCaseMutationResult,
  type IntegritySummaryRecord,
  type MuscleLeaderboardRecord,
  type MilestoneEvidenceSubmissionRecord,
  type MilestoneProgressRecord,
  type ProgressionSourceEventRecord,
  type ProgressionGrantRecord,
  type ProgressionProfileRecord,
  type RankingProfileRecord,
  type RankingOverrideResult,
  type SeasonStatusUpdateResult,
  type SeasonHistoryRecord,
  type WorkoutProgressionDeltaRecord,
} from './gamification.repository';
import {
  decodeLeaderboardCursor,
  encodeLeaderboardCursor,
  isAfterLeaderboardCursor,
} from './leaderboard-pagination';

export interface MuscleMasteryDelta {
  xp: number;
  volumeKg: Prisma.Decimal;
}

const DEFAULT_ANONYMOUS_DISPLAY_NAME = 'Anonymous Athlete';

const SEASON_STATUS_TRANSITIONS: Record<SeasonStatus, SeasonStatus[]> = {
  [SeasonStatus.draft]: [SeasonStatus.active, SeasonStatus.archived],
  [SeasonStatus.active]: [SeasonStatus.closed, SeasonStatus.archived],
  [SeasonStatus.closed]: [SeasonStatus.archived],
  [SeasonStatus.archived]: [],
};

import { calculateWorkoutProgressionDelta } from './gamification.constants';

const ADMIN_RANKING_GOVERNANCE_STATUSES = new Set<RankingGovernanceStatus>([
  RankingGovernanceStatus.normal,
  RankingGovernanceStatus.hidden_by_admin,
  RankingGovernanceStatus.disqualified,
]);

const MILESTONE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

@Injectable()
export class GamificationService {
  @Inject(FilesService)
  private readonly filesService!: FilesService;
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly repo: GamificationRepository,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(WORKOUT_SESSION_COMPLETED_EVENT, { async: true })
  async handleWorkoutCompleted(
    event: WorkoutSessionCompletedEvent,
  ): Promise<void> {
    try {
      const deltas = this.computeDeltas(event.exerciseSummaries);
      const progression = await this.repo.applyWorkoutCompletionProgression({
        userId: event.userId,
        sessionId: event.sessionId,
        completedAt: new Date(event.completedAt),
        recordedAt: new Date(event.recordedAt),
        totalVolumeKg: new Prisma.Decimal(event.totalVolumeKg),
        exerciseLogCount: event.exerciseLogCount,
        validationState: event.validationState,
        integrityState: event.integrityState,
        sourceQualityNotes: event.validationMetadata.sourceQualityNotes,
        deltas: this.toWorkoutProgressionDeltas(deltas),
        sourceContext: this.toWorkoutSourceContext(event),
      });

      if (progression.alreadyProcessed) {
        return;
      }

      progression.rankUpdates.forEach((rankUpdate) =>
        this.emitRankUp({
          userId: rankUpdate.userId,
          muscleGroup: rankUpdate.muscleGroup,
          oldRank: rankUpdate.oldRank,
          newRank: rankUpdate.newRank,
          rankedAt: rankUpdate.rankedAt.toISOString(),
        }),
      );

      if (progression.integrityEventId) {
        this.emitAudit({
          action: 'workout.session.flagged',
          entity: 'progression_source_event',
          entityId: event.sessionId,
          userId: event.userId,
          after: {
            source_id: event.sessionId,
            integrity_event_id: progression.integrityEventId,
            source_status: progression.sourceStatus,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process workout completion gamification for session ${event.sessionId}`,
        this.formatError(error),
      );
    }
  }

  @OnEvent(POSE_SESSION_FINALIZED_EVENT, { async: true })
  async handlePoseSessionFinalized(
    event: PoseSessionFinalizedEvent,
  ): Promise<void> {
    try {
      const recorded = await this.repo.recordPoseSessionProgressionSource({
        userId: event.userId,
        poseSessionId: event.sourceId,
        occurredAt: new Date(event.occurredAt),
        recordedAt: new Date(event.recordedAt),
        sourceRevision: event.sourceRevision,
        sourceStatus: this.toPoseSourceStatus(event),
        sourceContext: this.toPoseSourceContext(event),
        integrityState: event.integrityState,
        integrityMarkers: event.qualitySummary.integrityMarkers,
        integrityRiskLevel: this.toPoseIntegrityRiskLevel(event),
      });

      if (recorded.alreadyProcessed || !recorded.integrityEventId) {
        if (event.correlation.sessionId) {
          await this.reconcileWorkoutSourceFromPose(event);
        }
        return;
      }

      this.emitAudit({
        action: 'pose.session.flagged',
        entity: 'progression_source_event',
        entityId: event.sourceId,
        userId: event.userId,
        after: {
          source_id: event.sourceId,
          integrity_event_id: recorded.integrityEventId,
          source_status: recorded.sourceStatus,
        },
      });

      if (event.correlation.sessionId) {
        await this.reconcileWorkoutSourceFromPose(event);
      }
    } catch (error) {
      this.logger.error(
        `Failed to record pose-session backbone fact for source ${event.sourceId}`,
        this.formatError(error),
      );
    }
  }

  async getMuscleMastery(
    userId: string,
    dto: MasteryFilterDTO,
  ): Promise<MuscleMasteryResponseDTO[]> {
    const records = await this.repo.listMuscleMastery(userId, dto);

    return records.map((record) => this.toMasteryResponse(record));
  }

  async getLeaderboard(
    dto: LeaderboardFilterDTO | PaginationDTO,
  ): Promise<PaginatedResult<LeaderboardEntryResponseDTO> & { meta: PaginatedResult<LeaderboardEntryResponseDTO>['meta'] & { next_cursor: string | null; snapshot: string } }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter = dto as LeaderboardFilterDTO;
    const cursor = decodeLeaderboardCursor(filter.cursor);
    if (filter.cursor && !cursor) {
      throw new BadRequestException('Invalid leaderboard cursor.');
    }
    const snapshot = filter.snapshot ?? cursor?.snapshot ?? new Date().toISOString();
    if (Number.isNaN(new Date(snapshot).getTime())) {
      throw new BadRequestException('Invalid leaderboard snapshot.');
    }
    if (cursor && cursor.snapshot !== snapshot) {
      throw new BadRequestException('Leaderboard cursor does not match snapshot.');
    }
    const [participants, totals] = await Promise.all([
      this.userService.listGamificationParticipants(),
      this.repo.listLeaderboardTotals(),
    ]);
    const rankingProfiles = await this.repo.listRankingProfiles(
      participants.map((participant) => participant.user_id),
    );

    const leaderboard = this.buildLeaderboardEntries(
      participants,
      totals,
      rankingProfiles,
    );
    const total = leaderboard.length;
    const cursorRows = cursor
      ? leaderboard.filter((entry) =>
          isAfterLeaderboardCursor(
            {
              score: entry.total_xp,
              tie_breaker: entry.display_name,
              user_id: entry.user_id,
            },
            cursor,
          ),
        )
      : leaderboard;
    const start = cursor ? 0 : (page - 1) * limit;
    const data = cursorRows.slice(start, start + limit);
    const last = data[data.length - 1];
    const nextCursor =
      last && cursorRows.length > data.length
        ? encodeLeaderboardCursor({
            snapshot,
            score: last.total_xp,
            tie_breaker: last.display_name,
            user_id: last.user_id,
          })
        : null;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        next_cursor: nextCursor,
        snapshot,
      },
    };
  }

  async getProgressionProfile(
    userId: string,
  ): Promise<ProgressionProfileResponseDTO> {
    const profile = await this.repo.getProgressionProfile(userId);
    return this.toProgressionProfileResponse(userId, profile);
  }

  async listProgressionSources(
    userId: string,
    dto: ProgressionSourceListFilterDTO,
  ): Promise<PaginatedResult<ProgressionSourceSummaryResponseDTO>> {
    const result = await this.repo.listProgressionSources({
      userId,
      page: dto.page,
      limit: dto.limit,
      sourceType: dto.source_type,
      sourceStatus: dto.source_status,
    });

    return {
      ...result,
      data: result.data.map((record) =>
        this.toProgressionSourceSummaryResponse(record),
      ),
    };
  }

  async updateRankingProfile(
    userId: string,
    dto: UpdateRankingProfileDTO,
  ): Promise<RankingProfileResponseDTO> {
    const normalizedAlias =
      dto.visibility === RankingVisibility.anonymous
        ? dto.display_alias?.trim() || DEFAULT_ANONYMOUS_DISPLAY_NAME
        : null;
    const governanceStatus =
      dto.visibility === RankingVisibility.private
        ? RankingGovernanceStatus.hidden_by_user
        : dto.visibility === RankingVisibility.anonymous
          ? RankingGovernanceStatus.anonymized_by_user
          : RankingGovernanceStatus.normal;

    const profile = await this.repo.upsertRankingProfile({
      userId,
      visibility: dto.visibility,
      governanceStatus,
      displayAlias: normalizedAlias,
    });

    return this.toRankingProfileResponse(profile);
  }

  async getRankingProfile(userId: string): Promise<RankingProfileResponseDTO> {
    const profile = await this.repo.getRankingProfile(userId);

    if (!profile) {
      return {
        user_id: userId,
        visibility: RankingVisibility.public,
        governance_status: RankingGovernanceStatus.normal,
        display_alias: null,
        updated_at: null,
      };
    }

    return this.toRankingProfileResponse(profile);
  }

  async getActiveSeasonStanding(
    userId: string,
  ): Promise<SeasonStandingResponseDTO> {
    const standing = await this.repo.getActiveSeasonStanding(userId);
    return this.toSeasonStandingResponse(userId, standing);
  }

  async getMilestoneProgress(
    userId: string,
    dto?: MilestoneListFilterDTO,
  ): Promise<MilestoneProgressResponseDTO[]> {
    await this.repo.syncMilestoneProgressForUser({ userId });
    const milestones = await this.repo.listMilestoneProgress(userId);
    void dto;

    return milestones.flatMap((milestone) => {
      const progress = milestone.user_progress[0] ?? null;

      if (
        milestone.is_hidden &&
        (!progress || progress.status === MilestoneProgressStatus.in_progress)
      ) {
        return [];
      }

      return [this.toMilestoneProgressResponse(milestone)];
    });
  }

  async listAchievementReviews(): Promise<AchievementReviewResponseDTO[]> {
    const reviews = await this.repo.listAchievementReviews();
    return reviews.map((review) => this.toAchievementReviewResponse(review));
  }

  async listAdminMilestoneDefinitions(
    dto: AdminMilestoneDefinitionFilterDTO,
  ): Promise<PaginatedResult<AdminMilestoneDefinitionResponseDTO>> {
    const result = await this.repo.listAdminMilestoneDefinitions({
      category: dto.category,
      evidenceRequirement: dto.evidence_requirement,
      includeArchived: dto.include_archived,
      limit: dto.limit,
      page: dto.page,
      search: dto.search,
      sort: dto.sort,
      status: dto.status,
      triggerType: dto.trigger_type,
      verificationPolicy: dto.verification_policy,
    });

    return {
      ...result,
      data: result.data.map((record) =>
        this.toAdminMilestoneDefinitionResponse(record),
      ),
    };
  }

  async getAdminMilestoneDefinition(
    milestoneDefinitionId: string,
  ): Promise<AdminMilestoneDefinitionResponseDTO> {
    const record = await this.repo.getAdminMilestoneDefinition(
      milestoneDefinitionId,
    );

    if (!record) {
      throw new NotFoundException('Milestone definition was not found.');
    }

    return this.toAdminMilestoneDefinitionResponse(record);
  }

  async createAdminMilestoneDefinition(
    actorUserId: string,
    dto: AdminMilestoneDefinitionDTO,
  ): Promise<AdminMilestoneDefinitionResponseDTO> {
    const normalized = await this.normalizeMilestoneDefinitionInput(
      actorUserId,
      dto,
    );
    const record = await this.repo.createAdminMilestoneDefinition({
      actorUserId,
      ...normalized,
    });

    return this.toAdminMilestoneDefinitionResponse(record);
  }

  async updateAdminMilestoneDefinition(
    actorUserId: string,
    milestoneDefinitionId: string,
    dto: AdminMilestoneDefinitionDTO,
  ): Promise<AdminMilestoneDefinitionResponseDTO> {
    const existing = await this.repo.getAdminMilestoneDefinition(
      milestoneDefinitionId,
    );

    if (!existing) {
      throw new NotFoundException('Milestone definition was not found.');
    }

    const normalized = await this.normalizeMilestoneDefinitionInput(
      actorUserId,
      dto,
    );
    const record = await this.repo.updateAdminMilestoneDefinition({
      actorUserId,
      id: milestoneDefinitionId,
      ...normalized,
    });

    return this.toAdminMilestoneDefinitionResponse(record);
  }

  async archiveAdminMilestoneDefinition(
    actorUserId: string,
    milestoneDefinitionId: string,
  ): Promise<AdminMilestoneDefinitionResponseDTO> {
    const existing = await this.repo.getAdminMilestoneDefinition(
      milestoneDefinitionId,
    );

    if (!existing) {
      throw new NotFoundException('Milestone definition was not found.');
    }

    const record = await this.repo.archiveAdminMilestoneDefinition({
      actorUserId,
      id: milestoneDefinitionId,
    });

    return this.toAdminMilestoneDefinitionResponse(record);
  }

  async restoreAdminMilestoneDefinition(
    actorUserId: string,
    milestoneDefinitionId: string,
  ): Promise<AdminMilestoneDefinitionResponseDTO> {
    const existing = await this.repo.getAdminMilestoneDefinition(
      milestoneDefinitionId,
    );

    if (!existing) {
      throw new NotFoundException('Milestone definition was not found.');
    }

    const record = await this.repo.restoreAdminMilestoneDefinition({
      actorUserId,
      id: milestoneDefinitionId,
    });

    return this.toAdminMilestoneDefinitionResponse(record);
  }

  async listMilestoneEvidenceSubmissions(
    dto: AdminMilestoneEvidenceFilterDTO,
  ): Promise<PaginatedResult<MilestoneEvidenceSubmissionResponseDTO>> {
    const result = await this.repo.listMilestoneEvidenceSubmissions({
      limit: dto.limit,
      page: dto.page,
      search: dto.search,
      status: dto.status,
    });

    return {
      ...result,
      data: result.data.map((record) =>
        this.toMilestoneEvidenceSubmissionResponse(record),
      ),
    };
  }

  submitMilestoneEvidence(
    userId: string,
    milestoneDefinitionId: string,
    dto: SubmitMilestoneEvidenceDTO,
  ): never {
    void userId;
    void milestoneDefinitionId;
    void dto;
    throw new BadRequestException(
      'Milestone proof submissions are no longer required or accepted.',
    );
  }

  reviewMilestoneEvidence(
    reviewerUserId: string,
    evidenceSubmissionId: string,
    dto: ReviewMilestoneEvidenceDTO,
  ): never {
    void reviewerUserId;
    void evidenceSubmissionId;
    void dto;
    throw new BadRequestException(
      'Milestone proof review is retired. Achievement progress is evaluated automatically.',
    );
  }

  async claimMilestone(
    userId: string,
    milestoneDefinitionId: string,
  ): Promise<MilestoneProgressResponseDTO> {
    const milestone = await this.repo.getMilestoneProgressById(
      userId,
      milestoneDefinitionId,
    );

    if (!milestone) {
      throw new NotFoundException('Milestone was not found.');
    }

    const progress = milestone.user_progress[0] ?? null;
    const isHiddenLocked =
      milestone.is_hidden &&
      (!progress || progress.status === MilestoneProgressStatus.in_progress);

    if (isHiddenLocked) {
      throw new NotFoundException('Milestone was not found.');
    }

    if (progress.status === MilestoneProgressStatus.claimed) {
      return this.toMilestoneProgressResponse(milestone);
    }

    if (progress.status !== MilestoneProgressStatus.unlocked) {
      throw new BadRequestException(
        'Milestone must be unlocked before it can be claimed.',
      );
    }

    const claimed = await this.repo.claimMilestoneProgress(
      userId,
      milestoneDefinitionId,
    );
    return this.toMilestoneProgressResponse(claimed);
  }

  async getIntegritySummary(
    userId: string,
  ): Promise<IntegritySummaryResponseDTO> {
    const summary = await this.repo.getIntegritySummary(userId);
    return this.toIntegritySummaryResponse(userId, summary);
  }

  async getAdminOverview(): Promise<AdminGamificationOverviewResponseDTO> {
    const overview = await this.repo.getAdminOverview();
    return this.toAdminOverviewResponse(overview);
  }

  listAdminManualExpEligibleMembers(search?: string) {
    return this.repo.listManualExpEligibleMembers(search);
  }

  async listAdminSeasons(): Promise<AdminGamificationSeasonListItemDTO[]> {
    const seasons = await this.repo.listAdminSeasons({ includeArchived: true });
    return seasons.map((season) => this.toAdminSeasonListItemResponse(season));
  }

  async adminCreateSeason(
    actorUserId: string,
    dto: AdminSeasonCreateDTO,
  ): Promise<AdminGamificationSeasonListItemDTO> {
    const startsAt = new Date(dto.starts_at);
    const endsAt = new Date(dto.ends_at);
    this.validateSeasonWindow(startsAt, endsAt);
    const season = await this.repo.createSeason({
      autoStartNext: dto.auto_start_next ?? false,
      description: dto.description ?? null,
      endsAt,
      rulesVersion: dto.rules_version ?? 'v1',
      startsAt,
      title: dto.title,
    });
    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_SEASON_CREATED',
      entity: 'SeasonDefinition',
      entityId: season.id,
      after: { status: season.status, title: season.title },
    });
    return this.toAdminSeasonListItemResponse(season);
  }

  async adminUpdateSeason(
    actorUserId: string,
    seasonId: string,
    dto: AdminSeasonUpdateDTO,
  ): Promise<AdminGamificationSeasonListItemDTO> {
    const current = await this.repo.getSeasonById(seasonId);
    if (!current) {
      throw new NotFoundException(`Season ${seasonId} was not found.`);
    }
    if (current.status !== SeasonStatus.draft) {
      throw new BadRequestException('Only draft seasons can be edited.');
    }
    const startsAt = dto.starts_at ? new Date(dto.starts_at) : current.starts_at;
    const endsAt = dto.ends_at ? new Date(dto.ends_at) : current.ends_at;
    this.validateSeasonWindow(startsAt, endsAt);
    const season = await this.repo.updateDraftSeason({
      autoStartNext: dto.auto_start_next,
      description: dto.description,
      endsAt: dto.ends_at ? endsAt : undefined,
      rulesVersion: dto.rules_version,
      seasonId,
      startsAt: dto.starts_at ? startsAt : undefined,
      title: dto.title,
    });
    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_SEASON_UPDATED',
      entity: 'SeasonDefinition',
      entityId: season.id,
      before: { title: current.title },
      after: { title: season.title },
    });
    return this.toAdminSeasonListItemResponse(season);
  }

  async listMuscleLeaderboard(
    dto: MuscleLeaderboardFilterDTO | AdminMuscleLeaderboardFilterDTO,
    currentUserId?: string,
  ): Promise<
    PaginatedResult<MuscleLeaderboardRowDTO> & {
      meta: PaginatedResult<MuscleLeaderboardRowDTO>['meta'] & {
        next_cursor: string | null;
        snapshot: string;
      };
    }
  > {
    const adminDto = dto as AdminMuscleLeaderboardFilterDTO;
    const cursor = decodeLeaderboardCursor(dto.cursor);
    if (dto.cursor && !cursor) {
      throw new BadRequestException('Invalid muscle leaderboard cursor.');
    }
    const snapshot = dto.snapshot ?? cursor?.snapshot ?? new Date().toISOString();
    if (cursor && cursor.snapshot !== snapshot) {
      throw new BadRequestException('Muscle leaderboard cursor does not match snapshot.');
    }
    const result = await this.repo.listMuscleLeaderboard({
      includeHidden: adminDto.include_hidden ?? false,
      limit: 10000,
      muscleKey: dto.muscle_key,
      page: 1,
      scope: dto.scope,
      search: adminDto.search,
      seasonId: dto.season_id,
      snapshot,
    });
    const rows = result.data.map((row) =>
      this.toMuscleLeaderboardResponse(row, currentUserId),
    );
    const cursorRows = cursor
      ? rows.filter((row) =>
          isAfterLeaderboardCursor(
            { score: row.xp_points, tie_breaker: row.user_id, user_id: row.user_id },
            cursor,
          ),
        )
      : rows;
    const limit = dto.limit ?? 20;
    const data = cursorRows.slice(cursor ? 0 : ((dto.page ?? 1) - 1) * limit, cursor ? limit : (dto.page ?? 1) * limit);
    const last = data[data.length - 1];
    const nextCursor =
      last && cursorRows.length > data.length
        ? encodeLeaderboardCursor({
            snapshot,
            score: last.xp_points,
            tie_breaker: last.user_id,
            user_id: last.user_id,
          })
        : null;
    return {
      data,
      meta: {
        ...result.meta,
        page: dto.page ?? 1,
        limit,
        next_cursor: nextCursor,
        snapshot,
      },
    };
  }

  async listSeasonHistory(
    dto: SeasonTopPerformerFilterDTO,
  ): Promise<SeasonHistorySummaryDTO[]> {
    const history = await this.repo.listSeasonHistory({
      limit: dto.limit ?? 3,
    });
    return history.map((season) => this.toSeasonHistoryResponse(season));
  }

  runSeasonLifecycleSweep() {
    return this.repo.runSeasonLifecycleSweep();
  }

  async listAdminSeasonStandings(
    dto: AdminSeasonStandingFilterDTO,
  ): Promise<PaginatedResult<AdminSeasonStandingRowDTO>> {
    const standings = await this.repo.listAdminSeasonStandings({
      governanceStatus: dto.governance_status,
      includeArchived: dto.include_archived,
      limit: dto.limit,
      muscleKey: dto.muscle_key,
      page: dto.page,
      search: dto.search,
      seasonId: dto.season_id,
      visibility: dto.visibility,
    });

    return {
      ...standings,
      data: standings.data.map((standing) =>
        this.toAdminSeasonStandingResponse(standing),
      ),
    };
  }

  async adminUpdateSeasonStatus(
    actorUserId: string,
    seasonId: string,
    dto: AdminSeasonStatusDTO,
  ): Promise<AdminSeasonGovernanceResponseDTO> {
    const season = await this.repo.getSeasonById(seasonId);

    if (!season) {
      throw new NotFoundException(`Season ${seasonId} was not found.`);
    }

    if (season.status === dto.status) {
      throw new BadRequestException(
        `Season is already ${dto.status}; choose a different target status.`,
      );
    }

    if (!SEASON_STATUS_TRANSITIONS[season.status].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move a ${season.status} season to ${dto.status}.`,
      );
    }

    const result = await this.repo.updateSeasonStatus({
      actorUserId,
      seasonId,
      status: dto.status,
      rationale: dto.rationale,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_SEASON_STATUS_UPDATED',
      entity: 'SeasonDefinition',
      entityId: seasonId,
      before: {
        status: season.status,
      },
      after: {
        rationale: dto.rationale,
        status: dto.status,
      },
    });

    return this.toAdminSeasonGovernanceResponse(result);
  }

  async adminVoidProgressionGrant(
    actorUserId: string,
    grantId: string,
    dto: AdminGrantModerationDTO,
  ): Promise<AdminProgressionGrantResponseDTO> {
    const grant = await this.requireProgressionGrant(grantId);

    if (grant.grant_status === 'voided') {
      throw new BadRequestException('Progression grant is already voided.');
    }

    const result = await this.repo.voidProgressionGrant({
      actorUserId,
      grantId,
      rationale: dto.rationale,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_GRANT_VOIDED',
      entity: 'ProgressionGrantLedger',
      entityId: grantId,
      before: {
        grant_status: grant.grant_status,
      },
      after: {
        grant_status: 'voided',
      },
    });

    return this.toAdminProgressionGrantResponse(result);
  }

  async adminCreateManualExpGrant(
    actorUserId: string,
    dto: AdminManualExpGrantDTO,
    idempotencyKey: string | undefined,
  ): Promise<AdminProgressionGrantResponseDTO> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (!normalizedIdempotencyKey || !isUUID(normalizedIdempotencyKey, '4')) {
      throw new BadRequestException(
        'Idempotency-Key header must be a valid UUID v4.',
      );
    }

    const result = await this.repo.createManualExpGrant({
      actorUserId,
      allocations: dto.allocations,
      rationale: dto.rationale,
      sourceId: `manual_exp:${normalizedIdempotencyKey}`,
      userId: dto.user_id,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_MANUAL_EXP_GRANTED',
      entity: 'ProgressionGrantLedger',
      entityId: result.grantId,
      after: {
        user_id: dto.user_id,
        allocations: dto.allocations,
        total_amount: dto.allocations.reduce(
          (total, allocation) => total + allocation.amount,
          0,
        ),
      },
    });

    return {
      grant_id: result.grantId,
      grant_ids: result.grantIds,
      user_id: result.userId,
      grant_status: result.grantStatus,
      moderation_action_type: ModerationActionType.manual_exp_grant,
      moderation_action_id: result.moderationActionId,
      total_xp: result.totalXp,
      current_season_points: result.currentSeasonPoints,
    };
  }

  async adminRestoreProgressionGrant(
    actorUserId: string,
    grantId: string,
    dto: AdminGrantModerationDTO,
  ): Promise<AdminProgressionGrantResponseDTO> {
    const grant = await this.requireProgressionGrant(grantId);

    if (grant.grant_status !== 'voided') {
      throw new BadRequestException(
        'Only voided progression grants can be restored.',
      );
    }

    const result = await this.repo.restoreProgressionGrant({
      actorUserId,
      grantId,
      rationale: dto.rationale,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_GRANT_RESTORED',
      entity: 'ProgressionGrantLedger',
      entityId: grantId,
      before: {
        grant_status: grant.grant_status,
      },
      after: {
        grant_status: 'applied',
      },
    });

    return this.toAdminProgressionGrantResponse(result);
  }

  async adminApplyRankingOverride(
    actorUserId: string,
    targetUserId: string,
    dto: AdminRankingOverrideDTO,
  ): Promise<AdminRankingOverrideResponseDTO> {
    if (!ADMIN_RANKING_GOVERNANCE_STATUSES.has(dto.governance_status)) {
      throw new BadRequestException(
        'Admin ranking override supports normal, hidden_by_admin, and disqualified only.',
      );
    }

    const result = await this.repo.applyRankingOverride({
      actorUserId,
      targetUserId,
      governanceStatus: dto.governance_status,
      adminNote: dto.admin_note ?? null,
      rationale: dto.rationale ?? null,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_RANKING_OVERRIDE_APPLIED',
      entity: 'RankingProfile',
      entityId: targetUserId,
      after: {
        governance_status: dto.governance_status,
      },
    });

    return this.toAdminRankingOverrideResponse(result);
  }

  async adminCreateIntegrityCase(
    actorUserId: string,
    dto: CreateIntegrityCaseDTO,
  ): Promise<AdminIntegrityCaseResponseDTO> {
    const result = await this.repo.createIntegrityCase({
      userId: dto.user_id,
      sourceEventId: dto.source_event_id ?? null,
      eventType: dto.event_type,
      reasonCode: dto.reason_code ?? null,
      riskLevel: dto.risk_level,
      summary: dto.summary ?? null,
      details: dto.details ?? null,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_INTEGRITY_CASE_CREATED',
      entity: 'IntegrityCase',
      entityId: result.caseId,
      after: {
        status: result.status,
        user_id: result.userId,
      },
    });

    return this.toAdminIntegrityCaseResponse(result);
  }

  async adminResolveIntegrityCase(
    actorUserId: string,
    caseId: string,
    dto: ResolveIntegrityCaseDTO,
  ): Promise<AdminIntegrityCaseResponseDTO> {
    const integrityCase = await this.repo.getIntegrityCaseById(caseId);

    if (!integrityCase) {
      throw new NotFoundException(`Integrity case ${caseId} was not found.`);
    }

    if (
      dto.status !== IntegrityCaseStatus.resolved_valid &&
      dto.status !== IntegrityCaseStatus.resolved_invalid
    ) {
      throw new BadRequestException(
        'Integrity cases can only be resolved as resolved_valid or resolved_invalid.',
      );
    }

    if (
      integrityCase.status === IntegrityCaseStatus.resolved_valid ||
      integrityCase.status === IntegrityCaseStatus.resolved_invalid
    ) {
      throw new BadRequestException('Integrity case is already resolved.');
    }

    const result = await this.repo.resolveIntegrityCase({
      actorUserId,
      caseId,
      status: dto.status,
      rationale: dto.rationale,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_INTEGRITY_CASE_RESOLVED',
      entity: 'IntegrityCase',
      entityId: caseId,
      before: {
        status: integrityCase.status,
      },
      after: {
        status: dto.status,
      },
    });

    return this.toAdminIntegrityCaseResponse(result);
  }

  private buildLeaderboardEntries(
    participants: GamificationParticipantProfile[],
    totals: LeaderboardTotalRecord[],
    rankingProfiles: RankingProfileRecord[],
  ): LeaderboardEntryResponseDTO[] {
    const totalXpByUserId = new Map<string, number>(
      totals.map((row) => [row.user_id, row.total_xp]),
    );
    const rankingProfileByUserId = new Map<string, RankingProfileRecord>(
      rankingProfiles.map((profile) => [profile.user_id, profile]),
    );

    const orderedEntries = participants
      .flatMap((participant) => {
        const rankingProfile = rankingProfileByUserId.get(participant.user_id);

        if (this.shouldHideLeaderboardParticipant(rankingProfile)) {
          return [];
        }

        return [
          {
            user_id: participant.user_id,
            display_name: this.resolveLeaderboardDisplayName(
              participant,
              rankingProfile,
            ),
            avatar_url:
              rankingProfile?.visibility === RankingVisibility.anonymous ||
              rankingProfile?.governance_status ===
                RankingGovernanceStatus.anonymized_by_user
                ? null
                : participant.avatar_url,
            total_xp: totalXpByUserId.get(participant.user_id) ?? 0,
          },
        ];
      })
      .sort(
        (left, right) =>
          right.total_xp - left.total_xp ||
          left.display_name.localeCompare(right.display_name) ||
          left.user_id.localeCompare(right.user_id),
      );

    const rankPositions = getCompetitionRankPositions(
      orderedEntries,
      (entry) => entry.total_xp,
    );
    return orderedEntries.map((entry, index) => ({
        ...entry,
        rank_position: rankPositions[index],
      }));
  }

  private toMasteryResponse(
    record: MuscleMasteryProgress,
  ): MuscleMasteryResponseDTO {
    return {
      id: record.id,
      user_id: record.user_id,
      muscle_group: record.muscle_group,
      total_volume_kg: record.total_volume_kg.toFixed(2),
      xp_points: record.xp_points,
      rank: record.rank,
      rank_display: formatMasteryRankDisplay(record.rank, record.xp_points),
      last_ranked_at: record.last_ranked_at?.toISOString() ?? null,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toRankingProfileResponse(
    profile: RankingProfileRecord,
  ): RankingProfileResponseDTO {
    return {
      user_id: profile.user_id,
      visibility: profile.visibility,
      governance_status: profile.governance_status,
      display_alias: profile.display_alias,
      updated_at: profile.updated_at.toISOString(),
    };
  }

  private toSeasonStandingResponse(
    userId: string,
    standing: ActiveSeasonStandingRecord | null,
  ): SeasonStandingResponseDTO {
    return {
      user_id: userId,
      season: standing?.season
        ? {
            id: standing.season.id,
            title: standing.season.title,
            status: standing.season.status,
            starts_at: standing.season.starts_at.toISOString(),
            ends_at: standing.season.ends_at.toISOString(),
          }
        : null,
      season_points: standing?.season_points ?? 0,
      rank_position: standing?.rank_position ?? null,
      is_hidden: standing?.is_hidden ?? false,
      is_disqualified: standing?.is_disqualified ?? false,
      last_earned_at: standing?.last_earned_at?.toISOString() ?? null,
    };
  }

  private toMilestoneProgressResponse(
    milestone: MilestoneProgressRecord,
  ): MilestoneProgressResponseDTO {
    const progress = milestone.user_progress[0] ?? null;
    const icon = resolveProgressionIcon({
      assetKey: milestone.icon_asset_key,
      defaultIconKey: DEFAULT_MILESTONE_ICON_KEY,
      iconKey: milestone.icon_key,
      kind: milestone.icon_kind,
    });
    const targetValue = this.readMilestoneTargetValue(
      milestone.condition_payload,
    );
    const rawProgressValue = progress?.progress_value ?? 0;
    const progressValue =
      progress?.status === MilestoneProgressStatus.unlocked ||
      progress?.status === MilestoneProgressStatus.claimed
        ? Math.max(rawProgressValue, targetValue)
        : rawProgressValue;

    return {
      milestone_definition_id: milestone.id,
      key: milestone.key,
      title: milestone.title,
      description: milestone.description ?? null,
      category: milestone.category,
      trigger_type: milestone.trigger_type,
      condition_payload: this.toJsonObject(milestone.condition_payload),
      verification_policy: milestone.verification_policy,
      evidence_requirement: milestone.evidence_requirement,
      target_value: targetValue,
      progress_value: progressValue,
      progress_percent: Math.min(
        100,
        Math.round((Math.min(progressValue, targetValue) / targetValue) * 100),
      ),
      status: progress?.status ?? MilestoneProgressStatus.in_progress,
      is_hidden: milestone.is_hidden,
      reward_payload: this.toJsonObject(milestone.reward_payload),
      icon_kind: icon.iconKind,
      icon_key: icon.iconKey,
      icon_asset_key: icon.iconAssetKey,
      unlocked_at: progress?.unlocked_at?.toISOString() ?? null,
      claimed_at: progress?.claimed_at?.toISOString() ?? null,
      updated_at: progress?.updated_at?.toISOString() ?? null,
    };
  }

  private toAchievementReviewResponse(
    record: AchievementReviewRecord,
  ): AchievementReviewResponseDTO {
    const memberName = this.formatUserName(record.user);
    const memberInitials = this.buildInitials(memberName);
    const memberEmail =
      record.user.auth_identities.find((identity) => identity.is_primary)
        ?.identifier ??
      record.user.auth_identities[0]?.identifier ??
      'No email on file';
    const targetValue = this.readMilestoneTargetValue(
      record.milestone_definition.condition_payload,
    );
    const progressValue =
      record.status === MilestoneProgressStatus.unlocked ||
      record.status === MilestoneProgressStatus.claimed
        ? Math.max(record.progress_value, targetValue)
        : record.progress_value;
    const metric = this.readMilestoneMetric(
      record.milestone_definition.trigger_type,
      record.milestone_definition.condition_payload,
    );
    const isClaimed = record.status === MilestoneProgressStatus.claimed;

    return {
      id: record.id,
      member_id: record.user_id,
      member_name: memberName,
      member_initials: memberInitials,
      member_email: memberEmail,
      badge_label: record.milestone_definition.title,
      proof_caption: `Unlocked from ${progressValue}/${targetValue} ${metric} progress in the local database.`,
      proof_image_url: this.buildMilestoneProofPreview(
        memberInitials,
        record.milestone_definition.title,
      ),
      status: isClaimed ? 'Approved' : 'Pending',
      submitted_at: (record.unlocked_at ?? record.created_at).toISOString(),
      reviewed_at: record.claimed_at?.toISOString(),
      reviewer_notes: isClaimed ? 'Claimed by the member.' : '',
    };
  }

  private toAdminMilestoneDefinitionResponse(
    record: AdminMilestoneDefinitionRecord,
  ): AdminMilestoneDefinitionResponseDTO {
    const icon = resolveProgressionIcon({
      assetKey: record.icon_asset_key,
      defaultIconKey: DEFAULT_MILESTONE_ICON_KEY,
      iconKey: record.icon_key,
      kind: record.icon_kind,
    });
    return {
      id: record.id,
      key: record.key,
      title: record.title,
      description: record.description ?? null,
      category: record.category,
      trigger_type: record.trigger_type,
      status: record.status,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      condition_payload: this.toJsonObject(record.condition_payload),
      reward_payload: this.toJsonObject(record.reward_payload),
      icon_kind: icon.iconKind,
      icon_key: icon.iconKey,
      icon_asset_key: icon.iconAssetKey,
      is_active: record.is_active,
      is_hidden: record.is_hidden,
      sort_order: record.sort_order,
      progress_count: record._count.user_progress,
      unlocked_count: record.unlocked_count,
      pending_review_count: 0,
      starts_at: record.starts_at?.toISOString() ?? null,
      ends_at: record.ends_at?.toISOString() ?? null,
      archived_at: record.archived_at?.toISOString() ?? null,
      archived_by_user_id: record.archived_by_user_id,
      created_by_user_id: record.created_by_user_id,
      updated_by_user_id: record.updated_by_user_id,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toMilestoneEvidenceSubmissionResponse(
    record: MilestoneEvidenceSubmissionRecord,
  ): MilestoneEvidenceSubmissionResponseDTO {
    const memberName = this.formatUserName(record.user);
    const memberEmail =
      record.user.auth_identities.find((identity) => identity.is_primary)
        ?.identifier ??
      record.user.auth_identities[0]?.identifier ??
      null;

    return {
      id: record.id,
      user_id: record.user_id,
      milestone_definition_id: record.milestone_definition_id,
      milestone_key: record.milestone_definition.key,
      milestone_title: record.milestone_definition.title,
      member_name: memberName,
      member_initials: this.buildInitials(memberName),
      member_email: memberEmail,
      status: record.status,
      evidence_type: record.evidence_type,
      file_url: record.file_url,
      file_key: record.file_key,
      mime_type: record.mime_type,
      size_bytes: record.size_bytes,
      original_filename: record.original_filename,
      caption: record.caption,
      reviewer_notes: record.reviewer_notes,
      reviewed_at: record.reviewed_at?.toISOString() ?? null,
      reviewed_by_user_id: record.reviewed_by_user_id,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private async normalizeMilestoneDefinitionInput(
    actorUserId: string,
    dto: AdminMilestoneDefinitionDTO,
  ) {
    const startsAt = this.parseOptionalDate(dto.starts_at, 'starts_at');
    const endsAt = this.parseOptionalDate(dto.ends_at, 'ends_at');

    if (startsAt && endsAt && startsAt > endsAt) {
      throw new BadRequestException('starts_at must be before ends_at.');
    }

    if (!MILESTONE_KEY_PATTERN.test(dto.key)) {
      throw new BadRequestException(
        'key must be lowercase kebab-case, for example first-weighted-lift.',
      );
    }

    const evidenceRequirement = MilestoneEvidenceRequirement.none;
    const verificationPolicy = MilestoneVerificationPolicy.auto;

    this.validateMilestoneDefinitionContract(
      dto.condition_payload,
      verificationPolicy,
      evidenceRequirement,
    );
    const icon = await this.normalizeProgressionIconInput({
      actorUserId,
      assetKey: dto.icon_asset_key,
      defaultIconKey: DEFAULT_MILESTONE_ICON_KEY,
      iconKey: dto.icon_key,
      iconKind: dto.icon_kind,
    });

    return {
      category: dto.category,
      conditionPayload: dto.condition_payload ?? null,
      description: dto.description ?? null,
      endsAt,
      evidenceRequirement,
      iconAssetKey: icon.iconAssetKey,
      iconKey: icon.iconKey,
      iconKind: icon.iconKind,
      isHidden: dto.is_hidden ?? false,
      key: dto.key,
      rewardPayload: dto.reward_payload ?? null,
      sortOrder: dto.sort_order ?? 0,
      startsAt,
      status: dto.status ?? MilestoneDefinitionStatus.active,
      title: dto.title,
      triggerType: dto.trigger_type,
      verificationPolicy,
    };
  }

  private async normalizeProgressionIconInput(input: {
    actorUserId: string;
    assetKey?: string | null;
    defaultIconKey: string;
    iconKey?: string | null;
    iconKind?: ProgressionIconKind | null;
  }) {
    const iconKind = input.iconKind ?? ProgressionIconKind.library;
    const iconKey = input.iconKey?.trim() || null;
    const assetKey = input.assetKey?.trim() || null;

    if (iconKind === ProgressionIconKind.library) {
      if (assetKey) {
        throw new BadRequestException(
          'Library progression icons cannot include icon_asset_key.',
        );
      }
      const resolvedIconKey = iconKey ?? input.defaultIconKey;
      if (!isAllowedProgressionLibraryIconKey(resolvedIconKey)) {
        throw new BadRequestException(
          'icon_key must be an allowlisted progression library icon.',
        );
      }
      return resolveProgressionIcon({
        defaultIconKey: input.defaultIconKey,
        iconKey: resolvedIconKey,
        kind: ProgressionIconKind.library,
      });
    }

    if (!assetKey) {
      throw new BadRequestException(
        'Custom progression icons require icon_asset_key.',
      );
    }
    if (iconKey) {
      throw new BadRequestException(
        'Custom progression icons cannot include icon_key.',
      );
    }

    await this.filesService.assertUserOwnedRasterImage(
      assetKey,
      input.actorUserId,
    );
    return resolveProgressionIcon({
      assetKey,
      defaultIconKey: input.defaultIconKey,
      kind: ProgressionIconKind.custom,
    });
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date.`);
    }

    return parsed;
  }

  private validateMilestoneDefinitionContract(
    conditionPayload: Record<string, unknown> | null | undefined,
    verificationPolicy: MilestoneVerificationPolicy,
    evidenceRequirement: MilestoneEvidenceRequirement,
  ): void {
    const hasComposite =
      Array.isArray(conditionPayload?.all) ||
      Array.isArray(conditionPayload?.any);
    const hasTarget =
      typeof conditionPayload?.target === 'number' ||
      typeof conditionPayload?.value === 'number' ||
      typeof conditionPayload?.min === 'number' ||
      typeof conditionPayload?.max === 'number';

    if (!conditionPayload || (!hasComposite && !hasTarget)) {
      throw new BadRequestException(
        'condition_payload must include target, value, min/max, all, or any.',
      );
    }

    if (
      verificationPolicy === MilestoneVerificationPolicy.auto &&
      evidenceRequirement !== MilestoneEvidenceRequirement.none
    ) {
      throw new BadRequestException(
        'evidence_requirement requires manual_required, auto_then_review, or staff_attested verification.',
      );
    }

    if (
      verificationPolicy !== MilestoneVerificationPolicy.auto &&
      evidenceRequirement === MilestoneEvidenceRequirement.none
    ) {
      throw new BadRequestException(
        'manual milestone verification must require image, video, or image_or_video evidence.',
      );
    }
  }

  private toIntegritySummaryResponse(
    userId: string,
    summary: IntegritySummaryRecord,
  ): IntegritySummaryResponseDTO {
    return {
      user_id: userId,
      risk_level: summary.profile?.risk_level ?? IntegrityRiskLevel.low,
      open_case_count: summary.profile?.open_case_count ?? 0,
      last_flagged_at: summary.profile?.last_flagged_at?.toISOString() ?? null,
      last_resolved_at:
        summary.profile?.last_resolved_at?.toISOString() ?? null,
      recent_cases: summary.recentCases.map((record) => ({
        id: record.id,
        status: record.status,
        summary: record.summary ?? null,
        opened_at: record.opened_at.toISOString(),
        resolved_at: record.resolved_at?.toISOString() ?? null,
      })),
    };
  }

  private toAdminOverviewResponse(
    record: AdminGamificationOverviewRecord,
  ): AdminGamificationOverviewResponseDTO {
    const standingByUserId = new Map(
      (record.activeSeason?.standings ?? []).map((standing) => [
        standing.user_id,
        standing,
      ]),
    );

    return {
      generated_at: new Date().toISOString(),
      active_season: record.activeSeason
        ? {
            id: record.activeSeason.id,
            title: record.activeSeason.title,
            status: record.activeSeason.status,
            rules_version: record.activeSeason.rules_version,
            auto_start_next: record.activeSeason.auto_start_next,
            starts_at: record.activeSeason.starts_at.toISOString(),
            ends_at: record.activeSeason.ends_at.toISOString(),
            activated_at:
              record.activeSeason.activated_at?.toISOString() ?? null,
            closed_at: record.activeSeason.closed_at?.toISOString() ?? null,
            archived_at: record.activeSeason.archived_at?.toISOString() ?? null,
            standing_count: record.activeSeason.standings.length,
            hidden_count: record.activeSeason.standings.filter(
              (standing) => standing.is_hidden,
            ).length,
            disqualified_count: record.activeSeason.standings.filter(
              (standing) => standing.is_disqualified,
            ).length,
          }
        : null,
      integrity: {
        open_case_count: record.openCaseCount,
        escalated_case_count: record.escalatedCaseCount,
        high_risk_profile_count: record.highRiskProfileCount,
        cases: record.integrityCases.map((integrityCase) => ({
          case_id: integrityCase.id,
          user_id: integrityCase.user_id,
          member_name: this.formatUserName(integrityCase.user),
          status: integrityCase.status,
          risk_level: this.resolveIntegrityCaseRisk(
            integrityCase.integrity_events,
          ),
          summary: integrityCase.summary,
          opened_at: integrityCase.opened_at.toISOString(),
          evidence_event_count: integrityCase.integrity_events.length,
        })),
      },
      rankings: {
        governed_profile_count: record.governedRankingCount,
        hidden_profile_count: record.hiddenRankingCount,
        disqualified_profile_count: record.disqualifiedRankingCount,
        profiles: record.rankingProfiles.map((profile) => {
          const standing = standingByUserId.get(profile.user_id);

          return {
            user_id: profile.user_id,
            member_name: this.formatUserName(profile.user),
            visibility: profile.visibility,
            governance_status: profile.governance_status,
            display_alias: profile.display_alias,
            admin_note: profile.admin_note,
            season_is_hidden: standing?.is_hidden ?? false,
            season_is_disqualified: standing?.is_disqualified ?? false,
            updated_at: profile.updated_at.toISOString(),
          };
        }),
      },
      audit: {
        recent_correction_count: record.recentCorrectionCount,
        recent_actions: record.recentModerationActions.map((action) => ({
          id: action.id,
          action_type: action.action_type,
          target_user_id: action.target_user_id,
          target_name: this.formatUserName(action.target_user),
          rationale: action.rationale,
          created_at: action.created_at.toISOString(),
          progression_grant_id: action.progression_grant_id,
          integrity_case_id: action.integrity_case_id,
          season_id: action.season_id,
        })),
      },
    };
  }

  private toAdminSeasonListItemResponse(
    season: AdminSeasonListRecord,
  ): AdminGamificationSeasonListItemDTO {
    return {
      id: season.id,
      title: season.title,
      status: season.status,
      rules_version: season.rules_version,
      auto_start_next: season.auto_start_next,
      starts_at: season.starts_at.toISOString(),
      ends_at: season.ends_at.toISOString(),
      activated_at: season.activated_at?.toISOString() ?? null,
      closed_at: season.closed_at?.toISOString() ?? null,
      archived_at: season.archived_at?.toISOString() ?? null,
      standing_count: season.standings.length,
      hidden_count: season.standings.filter((standing) => standing.is_hidden)
        .length,
      disqualified_count: season.standings.filter(
        (standing) => standing.is_disqualified,
      ).length,
    };
  }

  private toAdminSeasonStandingResponse(
    standing: AdminSeasonStandingRecord,
  ): AdminSeasonStandingRowDTO {
    const topMuscle = [...standing.user.muscle_mastery].sort(
      (left, right) => right.xp_points - left.xp_points,
    )[0];
    const rankingProfile = standing.user.ranking_profile;
    const milestoneUnlockedCount = standing.user.milestone_progress.filter(
      (progress) =>
        progress.status === MilestoneProgressStatus.unlocked ||
        progress.status === MilestoneProgressStatus.claimed,
    ).length;
    const milestoneClaimedCount = standing.user.milestone_progress.filter(
      (progress) => progress.status === MilestoneProgressStatus.claimed,
    ).length;

    return {
      user_id: standing.user_id,
      member_name: this.formatUserName(standing.user),
      display_alias: rankingProfile?.display_alias ?? null,
      season_id: standing.season_id,
      season_title: standing.season.title,
      season_status: standing.season.status,
      season_points: standing.season_points,
      rank_position: standing.rank_position,
      total_xp: standing.user.progression_profile?.total_xp ?? 0,
      top_muscle: topMuscle?.muscle_group ?? null,
      top_muscle_xp: topMuscle?.xp_points ?? 0,
      milestone_unlocked_count: milestoneUnlockedCount,
      milestone_claimed_count: milestoneClaimedCount,
      visibility: rankingProfile?.visibility ?? RankingVisibility.public,
      governance_status:
        rankingProfile?.governance_status ?? RankingGovernanceStatus.normal,
      is_hidden: standing.is_hidden,
      is_disqualified: standing.is_disqualified,
      last_earned_at: standing.last_earned_at?.toISOString() ?? null,
    };
  }

  private toAdminSeasonGovernanceResponse(
    result: SeasonStatusUpdateResult,
  ): AdminSeasonGovernanceResponseDTO {
    return {
      season_id: result.seasonId,
      title: result.title,
      status: result.status,
      auto_start_next: result.autoStartNext,
      activated_at: result.activatedAt?.toISOString() ?? null,
      closed_at: result.closedAt?.toISOString() ?? null,
      archived_at: result.archivedAt?.toISOString() ?? null,
    };
  }

  private toMuscleLeaderboardResponse(
    row: MuscleLeaderboardRecord,
    currentUserId?: string,
  ): MuscleLeaderboardRowDTO {
    return {
      rank_position: row.rankPosition,
      user_id: row.userId,
      display_name: row.displayName,
      avatar_url: row.avatarUrl,
      muscle_key: row.muscleKey,
      scope: row.seasonId ? 'season' : 'lifetime',
      xp_points: row.xpPoints,
      icon_kind: row.iconKind,
      icon_key: row.iconKey,
      icon_asset_key: row.iconAssetKey,
      season_id: row.seasonId,
      season_title: row.seasonTitle,
      last_earned_at: row.lastEarnedAt?.toISOString() ?? null,
      ...(currentUserId
        ? { is_current_user: row.userId === currentUserId }
        : {}),
    };
  }

  private toSeasonHistoryResponse(
    season: SeasonHistoryRecord,
  ): SeasonHistorySummaryDTO {
    return {
      season_id: season.seasonId,
      title: season.title,
      starts_at: season.startsAt.toISOString(),
      ends_at: season.endsAt.toISOString(),
      closed_at: season.closedAt?.toISOString() ?? null,
      top_performers: season.topPerformers.map((performer) => ({
        rank_position: performer.rankPosition,
        user_id: performer.userId,
        display_name: performer.displayName,
        season_points: performer.seasonPoints,
      })),
    };
  }

  private validateSeasonWindow(startsAt: Date, endsAt: Date): void {
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException('Season end must be after its start.');
    }
  }

  private toAdminProgressionGrantResponse(
    result: GrantModerationResult,
  ): AdminProgressionGrantResponseDTO {
    return {
      grant_id: result.grantId,
      user_id: result.userId,
      grant_status: result.grantStatus,
      moderation_action_type:
        result.grantStatus === 'voided'
          ? 'void_progression_grant'
          : 'restore_progression_grant',
      moderation_action_id: result.moderationActionId,
      total_xp: result.totalXp,
      current_season_points: result.currentSeasonPoints,
    };
  }

  private toAdminRankingOverrideResponse(
    result: RankingOverrideResult,
  ): AdminRankingOverrideResponseDTO {
    return {
      user_id: result.userId,
      visibility: result.visibility,
      governance_status: result.governanceStatus,
      display_alias: result.displayAlias,
      admin_note: result.adminNote,
      season_is_hidden: result.seasonIsHidden,
      season_is_disqualified: result.seasonIsDisqualified,
      moderation_action_id: result.moderationActionId,
    };
  }

  private toAdminIntegrityCaseResponse(
    result: IntegrityCaseMutationResult,
  ): AdminIntegrityCaseResponseDTO {
    return {
      case_id: result.caseId,
      user_id: result.userId,
      status: result.status,
      risk_level: result.riskLevel,
      open_case_count: result.openCaseCount,
      summary: result.summary,
      moderation_action_id: result.moderationActionId,
    };
  }

  private toProgressionProfileResponse(
    userId: string,
    profile: ProgressionProfileRecord | null,
  ): ProgressionProfileResponseDTO {
    return {
      user_id: userId,
      total_xp: profile?.total_xp ?? 0,
      current_streak: profile?.current_streak ?? 0,
      longest_streak: profile?.longest_streak ?? 0,
      current_season_points: profile?.current_season_points ?? 0,
      ranking_visibility:
        profile?.user.ranking_profile?.visibility ?? RankingVisibility.public,
      ranking_governance_status:
        profile?.user.ranking_profile?.governance_status ??
        RankingGovernanceStatus.normal,
      integrity_risk_level:
        profile?.user.integrity_profile?.risk_level ?? IntegrityRiskLevel.low,
      active_season: profile?.active_season
        ? {
            id: profile.active_season.id,
            title: profile.active_season.title,
            status: profile.active_season.status,
            starts_at: profile.active_season.starts_at.toISOString(),
            ends_at: profile.active_season.ends_at.toISOString(),
          }
        : null,
      last_progressed_at: profile?.last_progressed_at?.toISOString() ?? null,
      created_at: profile?.created_at?.toISOString() ?? null,
      updated_at: profile?.updated_at?.toISOString() ?? null,
    };
  }

  private toProgressionSourceSummaryResponse(
    record: ProgressionSourceEventRecord,
  ): ProgressionSourceSummaryResponseDTO {
    const sourceContext = toJsonObject(record.source_context);
    const correlation = toJsonObject(sourceContext?.correlation);
    const validationMetadata = toJsonObject(sourceContext?.validation_metadata);

    return {
      id: record.id,
      source_type: record.source_type,
      source_id: record.source_id,
      source_status: record.source_status,
      occurred_at: toNullableString(sourceContext?.occurred_at),
      recorded_at: toNullableString(sourceContext?.recorded_at),
      processed_at: record.processed_at?.toISOString() ?? null,
      validation_state: toNullableString(sourceContext?.validation_state),
      terminal_state: toNullableString(sourceContext?.terminal_state),
      eligibility_state: toNullableString(sourceContext?.eligibility_state),
      integrity_state: toNullableString(sourceContext?.integrity_state),
      producer_runtime: toNullableString(sourceContext?.producer_runtime),
      session_id: toNullableString(correlation?.session_id),
      pose_session_id: toNullableString(correlation?.pose_session_id),
      pose_session_ids: toStringArray(correlation?.pose_session_ids),
      exercise_log_ids: toStringArray(correlation?.exercise_log_ids),
      linked_source_ids: toStringArray(correlation?.linked_source_ids),
      source_quality_notes: toStringArray(
        validationMetadata?.source_quality_notes,
      ),
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  computeDeltas(
    logs: WorkoutSessionExerciseSummary[],
  ): Map<string, MuscleMasteryDelta> {
    const deltas = new Map<string, MuscleMasteryDelta>();

    for (const log of logs) {
      const delta = calculateWorkoutProgressionDelta({
        repsCompleted: log.repsCompleted,
        repsAiCounted: log.repsAiCounted,
        weightKg: log.weightKg,
      });
      if (delta.xp <= 0) {
        continue;
      }

      const current = deltas.get(log.muscleGroupHint) ?? {
        xp: 0,
        volumeKg: new Prisma.Decimal(0),
      };
      deltas.set(log.muscleGroupHint, {
        xp: current.xp + delta.xp,
        volumeKg: current.volumeKg.plus(delta.volumeKg),
      });
    }

    return deltas;
  }

  private toWorkoutSourceContext(
    event: WorkoutSessionCompletedEvent,
  ): Prisma.InputJsonObject {
    return {
      event_type: event.eventType,
      event_version: event.eventVersion,
      source_type: event.sourceType,
      source_id: event.sourceId,
      source_revision: event.sourceRevision,
      idempotency_key: event.idempotencyKey,
      user_id: event.userId,
      occurred_at: event.occurredAt,
      recorded_at: event.recordedAt,
      producer_system: event.producerSystem,
      producer_runtime: event.producerRuntime,
      terminal_state: event.terminalState,
      eligibility_state: event.eligibilityState,
      integrity_state: event.integrityState,
      validation_state: event.validationState,
      producer_context: {
        app_surface: event.producerContext.appSurface,
        producer_version: event.producerContext.producerVersion,
        runtime_context: event.producerContext.runtimeContext,
      },
      correlation: {
        session_id: event.correlation.sessionId,
        pose_session_id: event.correlation.poseSessionId,
        pose_session_ids: event.correlation.poseSessionIds,
        plan_id: event.correlation.planId,
        exercise_log_ids: event.correlation.exerciseLogIds,
        linked_source_ids: event.correlation.linkedSourceIds,
      },
      performance_summary: {
        duration_seconds: event.performanceSummary.durationSeconds,
        exercise_log_count: event.performanceSummary.exerciseLogCount,
        total_volume_kg: event.performanceSummary.totalVolumeKg,
        exercise_summaries: event.performanceSummary.exerciseSummaries.map(
          (summary) => ({
            exercise_log_id: summary.exerciseLogId,
            exercise_id: summary.exerciseId,
            exercise_name_snapshot: summary.exerciseNameSnapshot,
            muscle_group_hint: summary.muscleGroupHint,
            set_number: summary.setNumber,
            reps_completed: summary.repsCompleted,
            reps_ai_counted: summary.repsAiCounted,
            weight_kg: summary.weightKg,
            duration_seconds: summary.durationSeconds,
            pose_session_id: summary.poseSessionId,
          }),
        ),
      },
      validation_metadata: {
        has_pose_evidence: event.validationMetadata.hasPoseEvidence,
        has_manual_weight_input: event.validationMetadata.hasManualWeightInput,
        contains_flagged_sets: event.validationMetadata.containsFlaggedSets,
        correction_origin: event.validationMetadata.correctionOrigin,
        source_quality_notes: event.validationMetadata.sourceQualityNotes,
      },
    } satisfies Prisma.InputJsonObject;
  }

  private toPoseSourceStatus(
    event: PoseSessionFinalizedEvent,
  ): ProgressionSourceStatus {
    if (event.terminalState === 'invalidated') {
      return ProgressionSourceStatus.invalidated;
    }

    if (
      event.terminalState === 'rejected' ||
      event.eligibilityState === 'blocked'
    ) {
      return ProgressionSourceStatus.blocked;
    }

    if (
      event.terminalState === 'flagged' ||
      event.eligibilityState === 'review_required' ||
      event.integrityState === 'suspicious'
    ) {
      return ProgressionSourceStatus.reduced;
    }

    return ProgressionSourceStatus.applied;
  }

  private toPoseIntegrityRiskLevel(
    event: PoseSessionFinalizedEvent,
  ): IntegrityRiskLevel {
    if (
      event.terminalState === 'rejected' ||
      event.qualitySummary.sessionQualityState === 'invalid' ||
      event.policyInputs.progressionDisposition === 'hold_for_review'
    ) {
      return IntegrityRiskLevel.high;
    }

    if (
      event.integrityState === 'suspicious' ||
      event.qualitySummary.integrityMarkers.length > 0 ||
      event.qualitySummary.sessionQualityState === 'degraded' ||
      event.policyInputs.progressionDisposition === 'cautionary' ||
      event.policyInputs.reviewRecommended === true
    ) {
      return IntegrityRiskLevel.medium;
    }

    return IntegrityRiskLevel.low;
  }

  private async reconcileWorkoutSourceFromPose(
    event: PoseSessionFinalizedEvent,
  ): Promise<void> {
    const sessionId = event.correlation.sessionId;
    const requiresReview =
      event.integrityState === 'suspicious' ||
      event.terminalState === 'flagged' ||
      event.terminalState === 'rejected' ||
      event.eligibilityState === 'review_required';

    if (!sessionId || !requiresReview) {
      return;
    }

    const reviewNotes = Array.from(
      new Set([
        'pose_session_requires_review',
        ...event.policyInputs.reviewRequiredMarkers.map(
          (marker) => `pose_review_marker:${marker}`,
        ),
        ...event.qualitySummary.integrityMarkers.map(
          (marker) => `pose_integrity_marker:${marker}`,
        ),
        ...(event.qualitySummary.sessionQualityReasons ?? []).map(
          (reason) => `pose_quality_reason:${reason}`,
        ),
        ...(event.policyInputs.integrityReasonCodes ?? []).map(
          (reason) => `pose_integrity_reason:${reason}`,
        ),
      ]),
    );

    const reconciliation = await this.repo.reconcileWorkoutSourceReviewFromPose(
      {
        userId: event.userId,
        sessionId,
        poseSessionId: event.sourceId,
        recordedAt: new Date(event.recordedAt),
        reviewNotes,
      },
    );

    if (!reconciliation.integrityEventId) {
      return;
    }

    this.emitAudit({
      action: 'workout.session.reconciled_from_pose',
      entity: 'progression_source_event',
      entityId: sessionId,
      userId: event.userId,
      after: {
        source_id: sessionId,
        pose_session_id: event.sourceId,
        integrity_event_id: reconciliation.integrityEventId,
        source_status: reconciliation.sourceStatus,
      },
    });
  }

  private toPoseSourceContext(
    event: PoseSessionFinalizedEvent,
  ): Prisma.InputJsonObject {
    return {
      event_type: event.eventType,
      event_version: event.eventVersion,
      source_type: event.sourceType,
      source_id: event.sourceId,
      source_revision: event.sourceRevision,
      idempotency_key: event.idempotencyKey,
      user_id: event.userId,
      occurred_at: event.occurredAt,
      recorded_at: event.recordedAt,
      producer_system: event.producerSystem,
      producer_runtime: event.producerRuntime,
      terminal_state: event.terminalState,
      eligibility_state: event.eligibilityState,
      integrity_state: event.integrityState,
      producer_context: {
        app_surface: event.producerContext.appSurface,
        producer_version: event.producerContext.producerVersion,
        runtime_context: event.producerContext.runtimeContext,
      },
      correlation: {
        session_id: event.correlation.sessionId,
        pose_session_id: event.correlation.poseSessionId,
        pose_session_ids: event.correlation.poseSessionIds,
        plan_id: event.correlation.planId,
        exercise_log_ids: event.correlation.exerciseLogIds,
        linked_source_ids: event.correlation.linkedSourceIds,
      },
      detection_summary: {
        exercise_hint: event.detectionSummary.exerciseHint,
        detected_exercise_name: event.detectionSummary.detectedExerciseName,
        candidate_exercises: event.detectionSummary.candidateExercises,
        classification_source: event.detectionSummary.classificationSource,
        classification_confidence:
          event.detectionSummary.classificationConfidence,
        average_confidence: event.detectionSummary.averageConfidence,
        matched_profile_id: event.detectionSummary.matchedProfileId,
        equipment_context: event.detectionSummary.equipmentContext ?? null,
        equipment_source: event.detectionSummary.equipmentSource ?? null,
        equipment_confidence:
          event.detectionSummary.equipmentConfidence ?? null,
        equipment_conflicts: event.detectionSummary.equipmentConflicts ?? [],
        movement_contract_snapshot: event.detectionSummary
          .movementContractSnapshot
          ? ({
              ...event.detectionSummary.movementContractSnapshot,
            } as unknown as Prisma.InputJsonObject)
          : null,
      },
      rep_evidence_summary: {
        final_rep_count: event.repEvidenceSummary.finalRepCount,
        dominant_joint: event.repEvidenceSummary.dominantJoint,
        oscillating_joints: event.repEvidenceSummary.oscillatingJoints,
        raw_angle_data_count: event.repEvidenceSummary.rawAngleDataCount,
        raw_angle_data_reference:
          event.repEvidenceSummary.rawAngleDataReference,
        form_feedback: event.repEvidenceSummary.formFeedback,
      },
      quality_summary: {
        camera_facing_mode: event.qualitySummary.cameraFacingMode,
        landmark_schema: event.qualitySummary.landmarkSchema,
        subject_locked: event.qualitySummary.subjectLocked,
        subject_lock_confidence: event.qualitySummary.subjectLockConfidence,
        reliable_frame_count: event.qualitySummary.reliableFrameCount,
        reliable_frame_ratio: event.qualitySummary.reliableFrameRatio ?? null,
        session_quality_state:
          event.qualitySummary.sessionQualityState ?? 'stable',
        session_quality_reasons:
          event.qualitySummary.sessionQualityReasons ?? [],
        fallback_used: event.qualitySummary.fallbackUsed,
        degraded_reason: event.qualitySummary.degradedReason,
        integrity_markers: event.qualitySummary.integrityMarkers,
      },
      policy_inputs: {
        weight_input_kg: event.policyInputs.weightInputKg,
        manual_entry_present: event.policyInputs.manualEntryPresent,
        review_required_markers: event.policyInputs.reviewRequiredMarkers,
        integrity_reason_codes: event.policyInputs.integrityReasonCodes ?? [],
        progression_disposition:
          event.policyInputs.progressionDisposition ?? 'normal',
        review_recommended: event.policyInputs.reviewRecommended ?? false,
      },
    } satisfies Prisma.InputJsonObject;
  }

  async upsertMastery(
    userId: string,
    muscleGroup: string,
    delta: MuscleMasteryDelta,
  ): Promise<MuscleMasteryProgress> {
    const mastery = await this.repo.upsertMuscleMasteryProgress({
      userId,
      muscleGroup,
      xpDelta: delta.xp,
      volumeKgDelta: delta.volumeKg,
    });
    const nextRank = this.evaluateRank(
      mastery.xp_points,
      mastery.total_volume_kg,
    );

    if (!isHigherMasteryRank(nextRank, mastery.rank)) {
      return mastery;
    }

    const rankedAt = new Date();
    const updated = await this.repo.updateMuscleMasteryRank({
      masteryId: mastery.id,
      rank: nextRank,
      rankedAt,
    });

    this.emitRankUp({
      userId,
      muscleGroup,
      oldRank: mastery.rank,
      newRank: nextRank,
      rankedAt: rankedAt.toISOString(),
    });

    return updated;
  }

  evaluateRank(
    xpPoints: number,
    totalVolumeKg: Prisma.Decimal | number,
  ): MasteryRank {
    return evaluateMasteryRank(xpPoints, totalVolumeKg);
  }

  private toWorkoutProgressionDeltas(
    deltas: Map<string, MuscleMasteryDelta>,
  ): WorkoutProgressionDeltaRecord[] {
    return Array.from(deltas.entries()).map(([muscleGroup, delta]) => ({
      muscleGroup,
      xpDelta: delta.xp,
      volumeKgDelta: delta.volumeKg,
    }));
  }

  private shouldHideLeaderboardParticipant(
    rankingProfile: RankingProfileRecord | undefined,
  ): boolean {
    if (!rankingProfile) {
      return false;
    }

    return (
      rankingProfile.visibility === RankingVisibility.private ||
      rankingProfile.governance_status ===
        RankingGovernanceStatus.hidden_by_user ||
      rankingProfile.governance_status ===
        RankingGovernanceStatus.hidden_by_admin ||
      rankingProfile.governance_status === RankingGovernanceStatus.disqualified
    );
  }

  private resolveLeaderboardDisplayName(
    participant: GamificationParticipantProfile,
    rankingProfile: RankingProfileRecord | undefined,
  ): string {
    if (
      rankingProfile?.visibility === RankingVisibility.anonymous ||
      rankingProfile?.governance_status ===
        RankingGovernanceStatus.anonymized_by_user
    ) {
      return rankingProfile.display_alias || DEFAULT_ANONYMOUS_DISPLAY_NAME;
    }

    return participant.display_name;
  }

  private formatUserName(user: {
    profile: { first_name: string; last_name: string } | null;
  }): string {
    const firstName = user.profile?.first_name.trim() ?? '';
    const lastName = user.profile?.last_name.trim() ?? '';
    return [firstName, lastName].filter(Boolean).join(' ') || 'FitTrack member';
  }

  private buildInitials(name: string): string {
    const initials = name
      .split(/\s+/g)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

    return initials || 'FT';
  }

  private buildMilestoneProofPreview(initials: string, badgeLabel: string) {
    const safeInitials = this.escapeSvgText(initials);
    const safeBadgeLabel = this.escapeSvgText(badgeLabel);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" fill="none"><rect width="320" height="200" rx="24" fill="#161616"/><rect x="18" y="18" width="284" height="164" rx="18" fill="#1F1F1F" stroke="#E87722" stroke-width="2"/><rect x="34" y="34" width="92" height="92" rx="20" fill="#E87722" opacity="0.22"/><text x="80" y="92" text-anchor="middle" fill="#E87722" font-size="28" font-family="Arial, sans-serif" font-weight="700">${safeInitials}</text><text x="34" y="152" fill="#FFFFFF" font-size="19" font-family="Arial, sans-serif" font-weight="700">${safeBadgeLabel}</text><text x="34" y="174" fill="#A1A1AA" font-size="12" font-family="Arial, sans-serif">Milestone proof generated from DB progress</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private escapeSvgText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private resolveIntegrityCaseRisk(
    events: { risk_level: IntegrityRiskLevel }[],
  ): IntegrityRiskLevel {
    return events.reduce(
      (highest, event) =>
        this.evaluateRisk(event.risk_level) > this.evaluateRisk(highest)
          ? event.risk_level
          : highest,
      IntegrityRiskLevel.low,
    );
  }

  private evaluateRisk(riskLevel: IntegrityRiskLevel): number {
    switch (riskLevel) {
      case IntegrityRiskLevel.high:
        return 3;
      case IntegrityRiskLevel.medium:
        return 2;
      default:
        return 1;
    }
  }

  private readMilestoneTargetValue(value: Prisma.JsonValue | null): number {
    const payload = this.toJsonObject(value);
    const rawTarget = payload?.target;

    if (typeof rawTarget !== 'number' || !Number.isFinite(rawTarget)) {
      return 1;
    }

    return Math.max(1, Math.floor(rawTarget));
  }

  private readMilestoneMetric(
    triggerType: string,
    value: Prisma.JsonValue | null,
  ): string {
    const payload = this.toJsonObject(value);
    const metric = typeof payload?.metric === 'string' ? payload.metric : null;

    if (metric) {
      return metric;
    }

    switch (triggerType) {
      case 'source_event':
        return 'completed_workout_sessions';
      case 'streak':
        return 'current_streak';
      case 'summary_threshold':
        return 'total_xp';
      default:
        return 'milestone';
    }
  }

  private toJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private async requireProgressionGrant(
    grantId: string,
  ): Promise<ProgressionGrantRecord> {
    const grant = await this.repo.getProgressionGrantById(grantId);

    if (!grant) {
      throw new NotFoundException(
        `Progression grant ${grantId} was not found.`,
      );
    }

    return grant;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }

  private emitRankUp(event: GamificationRankUpEvent): void {
    this.eventEmitter.emit(GAMIFICATION_RANK_UP_EVENT, event);
  }

  private emitAudit(event: {
    action: string;
    after?: Record<string, unknown>;
    before?: Record<string, unknown>;
    entity: string;
    entityId: string;
    userId: string | null;
  }): void {
    this.eventEmitter.emit('audit.log', {
      userId: event.userId,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      before: event.before,
      after: event.after,
    });
  }
}
