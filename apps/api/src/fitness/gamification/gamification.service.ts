import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  CreatorState,
  ExerciseReviewSubmissionStatus,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  type MasteryRank,
  MilestoneProgressStatus,
  type MuscleMasteryProgress,
  Prisma,
  ProgressionSourceStatus,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
} from '@prisma/client';

import { type PaginatedResult } from '../../common/base-repository/base-repository';
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
  AdminCreatorStateDTO,
  AdminCreatorStateResponseDTO,
  AdminGamificationOverviewResponseDTO,
  AdminGamificationSeasonListItemDTO,
  AdminGrantModerationDTO,
  AdminIntegrityCaseResponseDTO,
  AdminProgressionGrantResponseDTO,
  AdminRankingOverrideDTO,
  AdminRankingOverrideResponseDTO,
  AdminSeasonStandingFilterDTO,
  AdminSeasonStandingRowDTO,
  AdminSeasonGovernanceResponseDTO,
  AdminSeasonStatusDTO,
  IntegritySummaryResponseDTO,
  CreateIntegrityCaseDTO,
  LeaderboardEntryResponseDTO,
  MasteryFilterDTO,
  MilestoneListFilterDTO,
  MilestoneProgressResponseDTO,
  MuscleMasteryResponseDTO,
  ProgressionProfileResponseDTO,
  ProgressionSourceListFilterDTO,
  ProgressionSourceSummaryResponseDTO,
  RankingProfileResponseDTO,
  ResolveIntegrityCaseDTO,
  SeasonStandingResponseDTO,
  UpdateRankingProfileDTO,
} from './dto/gamification.dto';
import {
  evaluateMasteryRank,
  formatMasteryRankDisplay,
  isHigherMasteryRank,
} from './gamification.constants';
import {
  GAMIFICATION_RANK_UP_EVENT,
  type GamificationRankUpEvent,
} from './events/rank-up.event';
import {
  type LeaderboardTotalRecord,
  GamificationRepository,
  type ActiveSeasonStandingRecord,
  type AdminGamificationOverviewRecord,
  type AdminSeasonListRecord,
  type AdminSeasonStandingRecord,
  type CreatorStateUpdateResult,
  type GrantModerationResult,
  type IntegrityCaseMutationResult,
  type IntegritySummaryRecord,
  type MilestoneProgressRecord,
  type ProgressionSourceEventRecord,
  type ProgressionGrantRecord,
  type ProgressionProfileRecord,
  type RankingProfileRecord,
  type RankingOverrideResult,
  type SeasonStatusUpdateResult,
  type WorkoutProgressionDeltaRecord,
} from './gamification.repository';

export interface MuscleMasteryDelta {
  xp: number;
  volumeKg: Prisma.Decimal;
}

const DEFAULT_ANONYMOUS_DISPLAY_NAME = 'Anonymous Athlete';

const CREATOR_STATE_LABELS: Record<CreatorState, string> = {
  [CreatorState.none]: 'None',
  [CreatorState.candidate]: 'Candidate',
  [CreatorState.pending_review]: 'Pending review',
  [CreatorState.approved]: 'Approved',
  [CreatorState.suspended]: 'Suspended',
  [CreatorState.revoked]: 'Revoked',
};

const SEASON_STATUS_TRANSITIONS: Record<SeasonStatus, SeasonStatus[]> = {
  [SeasonStatus.draft]: [SeasonStatus.active, SeasonStatus.archived],
  [SeasonStatus.active]: [SeasonStatus.closed, SeasonStatus.archived],
  [SeasonStatus.closed]: [SeasonStatus.archived],
  [SeasonStatus.archived]: [],
};

const ADMIN_RANKING_GOVERNANCE_STATUSES = new Set<RankingGovernanceStatus>([
  RankingGovernanceStatus.normal,
  RankingGovernanceStatus.hidden_by_admin,
  RankingGovernanceStatus.disqualified,
]);

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
    dto: PaginationDTO,
  ): Promise<PaginatedResult<LeaderboardEntryResponseDTO>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
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
    const start = (page - 1) * limit;

    return {
      data: leaderboard.slice(start, start + limit),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
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

    if (!progress || progress.status === MilestoneProgressStatus.in_progress) {
      throw new BadRequestException(
        'Milestone must be unlocked before it can be claimed.',
      );
    }

    if (progress.status === MilestoneProgressStatus.claimed) {
      return this.toMilestoneProgressResponse(milestone);
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

  async listAdminSeasons(): Promise<AdminGamificationSeasonListItemDTO[]> {
    const seasons = await this.repo.listAdminSeasons({ includeArchived: true });
    return seasons.map((season) => this.toAdminSeasonListItemResponse(season));
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

  async adminUpdateCreatorState(
    actorUserId: string,
    targetUserId: string,
    dto: AdminCreatorStateDTO,
  ): Promise<AdminCreatorStateResponseDTO> {
    const result = await this.repo.updateCreatorState({
      actorUserId,
      targetUserId,
      state: dto.state,
      rationale: dto.rationale,
      adminNotes: dto.admin_notes ?? null,
    });

    this.emitAudit({
      userId: actorUserId,
      action: 'GAMIFICATION_CREATOR_STATE_UPDATED',
      entity: 'CreatorProfile',
      entityId: targetUserId,
      after: {
        admin_notes: dto.admin_notes ?? null,
        rationale: dto.rationale,
        state: dto.state,
      },
    });

    return this.toAdminCreatorStateResponse(result);
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

    return participants
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
            avatar_url: participant.avatar_url,
            total_xp: totalXpByUserId.get(participant.user_id) ?? 0,
          },
        ];
      })
      .sort(
        (left, right) =>
          right.total_xp - left.total_xp ||
          left.display_name.localeCompare(right.display_name) ||
          left.user_id.localeCompare(right.user_id),
      )
      .map((entry, index) => ({
        ...entry,
        rank_position: index + 1,
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
      target_value: targetValue,
      progress_value: progressValue,
      progress_percent: Math.min(
        100,
        Math.round((Math.min(progressValue, targetValue) / targetValue) * 100),
      ),
      status: progress?.status ?? MilestoneProgressStatus.in_progress,
      is_hidden: milestone.is_hidden,
      reward_payload: this.toJsonObject(milestone.reward_payload),
      unlocked_at: progress?.unlocked_at?.toISOString() ?? null,
      claimed_at: progress?.claimed_at?.toISOString() ?? null,
      updated_at: progress?.updated_at?.toISOString() ?? null,
    };
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
            starts_at: record.activeSeason.starts_at.toISOString(),
            ends_at: record.activeSeason.ends_at.toISOString(),
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
      creators: {
        candidate_count: record.creatorCounts[CreatorState.candidate],
        pending_review_count: record.creatorCounts[CreatorState.pending_review],
        approved_count: record.creatorCounts[CreatorState.approved],
        suspended_count: record.creatorCounts[CreatorState.suspended],
        revoked_count: record.creatorCounts[CreatorState.revoked],
        profiles: record.creatorProfiles.map((profile) => ({
          user_id: profile.user_id,
          member_name: this.formatUserName(profile.user),
          state: profile.state,
          state_label: this.toCreatorStateLabel(profile.state),
          admin_notes: profile.admin_notes,
          submission_count: profile.user.exercise_review_submissions.length,
          published_submission_count:
            profile.user.exercise_review_submissions.filter(
              (submission) =>
                submission.status === ExerciseReviewSubmissionStatus.published,
            ).length,
          last_state_changed_at:
            profile.last_state_changed_at?.toISOString() ?? null,
        })),
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
      starts_at: season.starts_at.toISOString(),
      ends_at: season.ends_at.toISOString(),
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
      closed_at: result.closedAt?.toISOString() ?? null,
      archived_at: result.archivedAt?.toISOString() ?? null,
    };
  }

  private toAdminCreatorStateResponse(
    result: CreatorStateUpdateResult,
  ): AdminCreatorStateResponseDTO {
    return {
      user_id: result.userId,
      member_name: result.userName,
      state: result.state,
      state_label: this.toCreatorStateLabel(result.state),
      admin_notes: result.adminNotes,
      last_state_changed_at: result.lastStateChangedAt?.toISOString() ?? null,
      moderation_action_id: result.moderationActionId,
    };
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
      const repsCompleted = log.repsCompleted ?? log.repsAiCounted ?? 0;

      if (repsCompleted <= 0) {
        continue;
      }

      const current = deltas.get(log.muscleGroupHint) ?? {
        xp: 0,
        volumeKg: new Prisma.Decimal(0),
      };
      const parsedWeightKg = log.weightKg
        ? new Prisma.Decimal(log.weightKg)
        : null;
      const weightForXp = parsedWeightKg ?? new Prisma.Decimal(1);
      const volumeKg = (parsedWeightKg ?? new Prisma.Decimal(0)).times(
        repsCompleted,
      );
      const xp = weightForXp
        .times(repsCompleted)
        .dividedBy(10)
        .floor()
        .toNumber();

      deltas.set(log.muscleGroupHint, {
        xp: current.xp + Math.max(1, xp),
        volumeKg: current.volumeKg.plus(volumeKg),
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

  private toCreatorStateLabel(state: CreatorState): string {
    return CREATOR_STATE_LABELS[state];
  }

  private readMilestoneTargetValue(value: Prisma.JsonValue | null): number {
    const payload = this.toJsonObject(value);
    const rawTarget = payload?.target;

    if (typeof rawTarget !== 'number' || !Number.isFinite(rawTarget)) {
      return 1;
    }

    return Math.max(1, Math.floor(rawTarget));
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
