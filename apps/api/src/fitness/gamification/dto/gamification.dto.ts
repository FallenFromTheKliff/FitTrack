import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreatorState,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  MasteryRank,
  MilestoneCategory,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  ModerationActionType,
  ProgressionGrantStatus,
  ProgressionSourceStatus,
  ProgressionSourceType,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

import { TrimString } from '../../../common/validators/trim-string.decorator';
import { PaginationDTO } from '../../../user/dto/user-dto';

export class MasteryFilterDTO {
  @ApiPropertyOptional({ example: 'legs' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group?: string;

  @ApiPropertyOptional({ enum: MasteryRank, example: MasteryRank.gold })
  @IsOptional()
  @IsEnum(MasteryRank, {
    message: `rank must be one of: ${Object.values(MasteryRank).join(', ')}`,
  })
  rank?: MasteryRank;
}

export class MuscleMasteryResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'legs' })
  muscle_group: string;

  @ApiProperty({ example: '12500.00' })
  total_volume_kg: string;

  @ApiProperty({ example: 950 })
  xp_points: number;

  @ApiProperty({ enum: MasteryRank, example: MasteryRank.silver })
  rank: MasteryRank;

  @ApiProperty({ example: 'Silver' })
  rank_display: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-27T03:00:00.000Z',
    nullable: true,
  })
  last_ranked_at: string | null;

  @ApiProperty({ example: '2026-03-27T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T03:00:00.000Z' })
  updated_at: string;
}

export class LeaderboardEntryResponseDTO {
  @ApiProperty({ example: 1 })
  rank_position: number;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Track' })
  display_name: string;

  @ApiPropertyOptional({
    type: String,
    example: 'https://cdn.fittrack.test/avatars/user-1.png',
    nullable: true,
  })
  avatar_url: string | null;

  @ApiProperty({ example: 2750 })
  total_xp: number;
}

export class ProgressionActiveSeasonResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: 'Spring 2026' })
  title: string;

  @ApiProperty({ enum: SeasonStatus, example: SeasonStatus.active })
  status: SeasonStatus;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  starts_at: string;

  @ApiProperty({ example: '2026-06-30T23:59:59.000Z' })
  ends_at: string;
}

export class ProgressionProfileResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 2750 })
  total_xp: number;

  @ApiProperty({ example: 4 })
  current_streak: number;

  @ApiProperty({ example: 11 })
  longest_streak: number;

  @ApiProperty({ example: 580 })
  current_season_points: number;

  @ApiProperty({
    enum: RankingVisibility,
    example: RankingVisibility.public,
  })
  ranking_visibility: RankingVisibility;

  @ApiProperty({
    enum: RankingGovernanceStatus,
    example: RankingGovernanceStatus.normal,
  })
  ranking_governance_status: RankingGovernanceStatus;

  @ApiProperty({
    enum: IntegrityRiskLevel,
    example: IntegrityRiskLevel.low,
  })
  integrity_risk_level: IntegrityRiskLevel;

  @ApiPropertyOptional({
    type: () => ProgressionActiveSeasonResponseDTO,
    nullable: true,
  })
  active_season: ProgressionActiveSeasonResponseDTO | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  last_progressed_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  created_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  updated_at: string | null;
}

export class ProgressionSourceListFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({
    enum: ProgressionSourceType,
    example: ProgressionSourceType.workout_session_completed,
  })
  @IsOptional()
  @IsEnum(ProgressionSourceType, {
    message: `source_type must be one of: ${Object.values(ProgressionSourceType).join(', ')}`,
  })
  source_type?: ProgressionSourceType;

  @ApiPropertyOptional({
    enum: ProgressionSourceStatus,
    example: ProgressionSourceStatus.reduced,
  })
  @IsOptional()
  @IsEnum(ProgressionSourceStatus, {
    message: `source_status must be one of: ${Object.values(ProgressionSourceStatus).join(', ')}`,
  })
  source_status?: ProgressionSourceStatus;
}

export class ProgressionSourceSummaryResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({
    enum: ProgressionSourceType,
    example: ProgressionSourceType.workout_session_completed,
  })
  source_type: ProgressionSourceType;

  @ApiProperty({ example: 'session-1' })
  source_id: string;

  @ApiProperty({
    enum: ProgressionSourceStatus,
    example: ProgressionSourceStatus.applied,
  })
  source_status: ProgressionSourceStatus;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-27T03:00:00.000Z',
    nullable: true,
  })
  occurred_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-27T03:00:05.000Z',
    nullable: true,
  })
  recorded_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-27T03:00:05.000Z',
    nullable: true,
  })
  processed_at: string | null;

  @ApiPropertyOptional({ example: 'validated', nullable: true })
  validation_state: string | null;

  @ApiPropertyOptional({ example: 'accepted', nullable: true })
  terminal_state: string | null;

  @ApiPropertyOptional({ example: 'eligible', nullable: true })
  eligibility_state: string | null;

  @ApiPropertyOptional({ example: 'clean', nullable: true })
  integrity_state: string | null;

  @ApiPropertyOptional({ example: 'backend', nullable: true })
  producer_runtime: string | null;

  @ApiPropertyOptional({ example: 'session-1', nullable: true })
  session_id: string | null;

  @ApiPropertyOptional({ example: 'pose-1', nullable: true })
  pose_session_id: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['pose-1'] })
  pose_session_ids: string[];

  @ApiProperty({ type: String, isArray: true, example: ['log-1', 'log-2'] })
  exercise_log_ids: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['pose_session_finalized:pose-1'],
  })
  linked_source_ids: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['linked_pose_sessions_present'],
  })
  source_quality_notes: string[];

  @ApiProperty({ example: '2026-03-27T03:00:05.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T03:00:05.000Z' })
  updated_at: string;
}

export class RankingProfileResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({
    enum: RankingVisibility,
    example: RankingVisibility.public,
  })
  visibility: RankingVisibility;

  @ApiProperty({
    enum: RankingGovernanceStatus,
    example: RankingGovernanceStatus.normal,
  })
  governance_status: RankingGovernanceStatus;

  @ApiPropertyOptional({
    type: String,
    example: 'Anonymous Phoenix',
    nullable: true,
  })
  display_alias: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  updated_at: string | null;
}

export class UpdateRankingProfileDTO {
  @ApiProperty({
    enum: RankingVisibility,
    example: RankingVisibility.anonymous,
  })
  @IsEnum(RankingVisibility, {
    message: `visibility must be one of: ${Object.values(RankingVisibility).join(', ')}`,
  })
  visibility: RankingVisibility;

  @ApiPropertyOptional({
    example: 'Anonymous Phoenix',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'display_alias must be a string' })
  @MaxLength(100, {
    message: 'display_alias must not exceed 100 characters',
  })
  display_alias?: string | null;
}

export class SeasonStandingResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiPropertyOptional({
    type: () => ProgressionActiveSeasonResponseDTO,
    nullable: true,
  })
  season: ProgressionActiveSeasonResponseDTO | null;

  @ApiProperty({ example: 580 })
  season_points: number;

  @ApiPropertyOptional({
    type: Number,
    example: 4,
    nullable: true,
  })
  rank_position: number | null;

  @ApiProperty({ example: false })
  is_hidden: boolean;

  @ApiProperty({ example: false })
  is_disqualified: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  last_earned_at: string | null;
}

export class MilestoneProgressResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  milestone_definition_id: string;

  @ApiProperty({ example: 'first-workout-complete' })
  key: string;

  @ApiProperty({ example: 'First Workout Complete' })
  title: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Complete your first tracked workout session.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ enum: MilestoneCategory, example: MilestoneCategory.training })
  category: MilestoneCategory;

  @ApiProperty({
    enum: MilestoneTriggerType,
    example: MilestoneTriggerType.source_event,
  })
  trigger_type: MilestoneTriggerType;

  @ApiProperty({ example: 1 })
  target_value: number;

  @ApiProperty({ example: 1 })
  progress_value: number;

  @ApiProperty({ example: 100 })
  progress_percent: number;

  @ApiProperty({
    enum: MilestoneProgressStatus,
    example: MilestoneProgressStatus.unlocked,
  })
  status: MilestoneProgressStatus;

  @ApiProperty({ example: false })
  is_hidden: boolean;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { badge_tone: 'ember', icon: 'flame' },
  })
  reward_payload: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  unlocked_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:45:00.000Z',
    nullable: true,
  })
  claimed_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  updated_at: string | null;
}

export class MilestoneListFilterDTO {
  @ApiPropertyOptional({
    example: true,
    description:
      'When true, the client is intentionally rendering locked milestone definitions.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'include_locked must be a boolean' })
  include_locked?: boolean;
}

export class IntegrityCaseSummaryResponseDTO {
  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  id: string;

  @ApiProperty({
    enum: IntegrityCaseStatus,
    example: IntegrityCaseStatus.under_review,
  })
  status: IntegrityCaseStatus;

  @ApiPropertyOptional({
    type: String,
    example: 'Rapid rep spikes were flagged for operator review.',
    nullable: true,
  })
  summary: string | null;

  @ApiProperty({ example: '2026-04-23T09:30:00.000Z' })
  opened_at: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T10:00:00.000Z',
    nullable: true,
  })
  resolved_at: string | null;
}

export class IntegritySummaryResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({
    enum: IntegrityRiskLevel,
    example: IntegrityRiskLevel.low,
  })
  risk_level: IntegrityRiskLevel;

  @ApiProperty({ example: 1 })
  open_case_count: number;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  last_flagged_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T10:00:00.000Z',
    nullable: true,
  })
  last_resolved_at: string | null;

  @ApiProperty({
    type: () => [IntegrityCaseSummaryResponseDTO],
  })
  recent_cases: IntegrityCaseSummaryResponseDTO[];
}

export class AdminGrantModerationDTO {
  @ApiProperty({
    example: 'Validated by operator review after investigating the session.',
  })
  @TrimString()
  @IsString({ message: 'rationale must be a string' })
  @MinLength(3, { message: 'rationale must be at least 3 characters' })
  @MaxLength(500, {
    message: 'rationale must not exceed 500 characters',
  })
  rationale: string;
}

export class AdminRankingOverrideDTO {
  @ApiProperty({
    enum: RankingGovernanceStatus,
    example: RankingGovernanceStatus.hidden_by_admin,
  })
  @IsEnum(RankingGovernanceStatus, {
    message: `governance_status must be one of: ${Object.values(RankingGovernanceStatus).join(', ')}`,
  })
  governance_status: RankingGovernanceStatus;

  @ApiPropertyOptional({
    example: 'Hidden after manual review of suspicious progression.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'rationale must be a string' })
  @MaxLength(500, {
    message: 'rationale must not exceed 500 characters',
  })
  rationale?: string | null;

  @ApiPropertyOptional({
    example: 'Keep hidden until the next moderation pass.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'admin_note must be a string' })
  @MaxLength(500, {
    message: 'admin_note must not exceed 500 characters',
  })
  admin_note?: string | null;
}

export class AdminSeasonStatusDTO {
  @ApiProperty({
    enum: SeasonStatus,
    example: SeasonStatus.closed,
  })
  @IsEnum(SeasonStatus, {
    message: `status must be one of: ${Object.values(SeasonStatus).join(', ')}`,
  })
  status: SeasonStatus;

  @ApiProperty({
    example: 'Season closed after final anomaly review.',
  })
  @TrimString()
  @IsString({ message: 'rationale must be a string' })
  @MinLength(3, { message: 'rationale must be at least 3 characters' })
  @MaxLength(500, {
    message: 'rationale must not exceed 500 characters',
  })
  rationale: string;
}

export class AdminCreatorStateDTO {
  @ApiProperty({
    enum: CreatorState,
    example: CreatorState.approved,
  })
  @IsEnum(CreatorState, {
    message: `state must be one of: ${Object.values(CreatorState).join(', ')}`,
  })
  state: CreatorState;

  @ApiProperty({
    example: 'Approved after repeated high-signal submissions.',
  })
  @TrimString()
  @IsString({ message: 'rationale must be a string' })
  @MinLength(3, { message: 'rationale must be at least 3 characters' })
  @MaxLength(500, {
    message: 'rationale must not exceed 500 characters',
  })
  rationale: string;

  @ApiPropertyOptional({
    example: 'Eligible for creator workflows; monitor next two submissions.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'admin_notes must be a string' })
  @MaxLength(500, {
    message: 'admin_notes must not exceed 500 characters',
  })
  admin_notes?: string | null;
}

export class CreateIntegrityCaseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  user_id: string;

  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: 'source_event_id must be a valid UUID' })
  source_event_id?: string | null;

  @ApiProperty({
    example: 'rep_pattern_anomaly',
  })
  @TrimString()
  @IsString({ message: 'event_type must be a string' })
  @MaxLength(100, {
    message: 'event_type must not exceed 100 characters',
  })
  event_type: string;

  @ApiPropertyOptional({
    example: 'unexpected_rep_spike',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason_code must be a string' })
  @MaxLength(100, {
    message: 'reason_code must not exceed 100 characters',
  })
  reason_code?: string | null;

  @ApiProperty({
    enum: IntegrityRiskLevel,
    example: IntegrityRiskLevel.medium,
  })
  @IsEnum(IntegrityRiskLevel, {
    message: `risk_level must be one of: ${Object.values(IntegrityRiskLevel).join(', ')}`,
  })
  risk_level: IntegrityRiskLevel;

  @ApiPropertyOptional({
    example:
      'Session confidence dropped while rep count continued to increase.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'summary must be a string' })
  @MaxLength(255, {
    message: 'summary must not exceed 255 characters',
  })
  summary?: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { confidence_avg: 0.21, suspected_reps: 18 },
  })
  @IsOptional()
  @IsObject({ message: 'details must be an object' })
  details?: Record<string, unknown> | null;
}

export class ResolveIntegrityCaseDTO {
  @ApiProperty({
    enum: IntegrityCaseStatus,
    example: IntegrityCaseStatus.resolved_invalid,
  })
  @IsEnum(IntegrityCaseStatus, {
    message: `status must be one of: ${Object.values(IntegrityCaseStatus).join(', ')}`,
  })
  status: IntegrityCaseStatus;

  @ApiProperty({
    example: 'Manual review confirmed the session should remain invalid.',
  })
  @TrimString()
  @IsString({ message: 'rationale must be a string' })
  @MinLength(3, { message: 'rationale must be at least 3 characters' })
  @MaxLength(500, {
    message: 'rationale must not exceed 500 characters',
  })
  rationale: string;
}

export class AdminProgressionGrantResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  grant_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({
    enum: ProgressionGrantStatus,
    example: ProgressionGrantStatus.voided,
  })
  grant_status: ProgressionGrantStatus;

  @ApiProperty({
    enum: ModerationActionType,
    example: ModerationActionType.void_progression_grant,
  })
  moderation_action_type: ModerationActionType;

  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  moderation_action_id: string;

  @ApiProperty({ example: 1200 })
  total_xp: number;

  @ApiProperty({ example: 340 })
  current_season_points: number;
}

export class AdminRankingOverrideResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({
    enum: RankingVisibility,
    example: RankingVisibility.public,
  })
  visibility: RankingVisibility;

  @ApiProperty({
    enum: RankingGovernanceStatus,
    example: RankingGovernanceStatus.hidden_by_admin,
  })
  governance_status: RankingGovernanceStatus;

  @ApiPropertyOptional({
    type: String,
    example: 'Anonymous Phoenix',
    nullable: true,
  })
  display_alias: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Keep hidden until the next moderation pass.',
    nullable: true,
  })
  admin_note: string | null;

  @ApiProperty({ example: true })
  season_is_hidden: boolean;

  @ApiProperty({ example: false })
  season_is_disqualified: boolean;

  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  moderation_action_id: string;
}

export class AdminIntegrityCaseResponseDTO {
  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  case_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({
    enum: IntegrityCaseStatus,
    example: IntegrityCaseStatus.open,
  })
  status: IntegrityCaseStatus;

  @ApiProperty({
    enum: IntegrityRiskLevel,
    example: IntegrityRiskLevel.medium,
  })
  risk_level: IntegrityRiskLevel;

  @ApiProperty({ example: 1 })
  open_case_count: number;

  @ApiPropertyOptional({
    type: String,
    example:
      'Session confidence dropped while rep count continued to increase.',
    nullable: true,
  })
  summary: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
  })
  moderation_action_id: string | null;
}

export class AdminSeasonGovernanceResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  season_id: string;

  @ApiProperty({ example: 'Spring 2026' })
  title: string;

  @ApiProperty({ enum: SeasonStatus, example: SeasonStatus.closed })
  status: SeasonStatus;

  @ApiPropertyOptional({
    type: String,
    example: '2026-06-30T23:59:59.000Z',
    nullable: true,
  })
  closed_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-07-02T00:00:00.000Z',
    nullable: true,
  })
  archived_at: string | null;
}

export class AdminCreatorStateResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  member_name: string;

  @ApiProperty({ enum: CreatorState, example: CreatorState.approved })
  state: CreatorState;

  @ApiProperty({ example: 'Approved' })
  state_label: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Eligible for creator workflows.',
    nullable: true,
  })
  admin_notes: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-24T00:00:00.000Z',
    nullable: true,
  })
  last_state_changed_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
  })
  moderation_action_id: string | null;
}

export class AdminGamificationSeasonSummaryDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: 'Spring 2026' })
  title: string;

  @ApiProperty({ enum: SeasonStatus, example: SeasonStatus.active })
  status: SeasonStatus;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  starts_at: string;

  @ApiProperty({ example: '2026-06-30T23:59:59.000Z' })
  ends_at: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-06-30T23:59:59.000Z',
    nullable: true,
  })
  closed_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-07-02T00:00:00.000Z',
    nullable: true,
  })
  archived_at: string | null;

  @ApiProperty({ example: 42 })
  standing_count: number;

  @ApiProperty({ example: 2 })
  hidden_count: number;

  @ApiProperty({ example: 1 })
  disqualified_count: number;
}

export class AdminGamificationSeasonListItemDTO extends AdminGamificationSeasonSummaryDTO {}

export class AdminSeasonStandingFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: '33333333-3333-4333-8333-333333333333' })
  @IsOptional()
  @IsUUID('4', { message: 'season_id must be a valid UUID' })
  season_id?: string;

  @ApiPropertyOptional({ example: 'chest' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_key must be a string' })
  @MaxLength(100, {
    message: 'muscle_key must not exceed 100 characters',
  })
  muscle_key?: string;

  @ApiPropertyOptional({ example: 'sera' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, {
    message: 'search must not exceed 100 characters',
  })
  search?: string;

  @ApiPropertyOptional({ enum: RankingVisibility })
  @IsOptional()
  @IsEnum(RankingVisibility, {
    message: `visibility must be one of: ${Object.values(RankingVisibility).join(', ')}`,
  })
  visibility?: RankingVisibility;

  @ApiPropertyOptional({ enum: RankingGovernanceStatus })
  @IsOptional()
  @IsEnum(RankingGovernanceStatus, {
    message: `governance_status must be one of: ${Object.values(RankingGovernanceStatus).join(', ')}`,
  })
  governance_status?: RankingGovernanceStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'include_archived must be a boolean' })
  include_archived?: boolean;
}

export class AdminSeasonStandingRowDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  member_name: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Anonymous Phoenix',
    nullable: true,
  })
  display_alias: string | null;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  season_id: string;

  @ApiProperty({ example: 'Spring 2026' })
  season_title: string;

  @ApiProperty({ enum: SeasonStatus, example: SeasonStatus.active })
  season_status: SeasonStatus;

  @ApiProperty({ example: 580 })
  season_points: number;

  @ApiPropertyOptional({ type: Number, example: 4, nullable: true })
  rank_position: number | null;

  @ApiProperty({ example: 2750 })
  total_xp: number;

  @ApiPropertyOptional({ type: String, example: 'chest', nullable: true })
  top_muscle: string | null;

  @ApiProperty({ example: 950 })
  top_muscle_xp: number;

  @ApiProperty({ example: 3 })
  milestone_unlocked_count: number;

  @ApiProperty({ example: 2 })
  milestone_claimed_count: number;

  @ApiProperty({ enum: RankingVisibility, example: RankingVisibility.public })
  visibility: RankingVisibility;

  @ApiProperty({
    enum: RankingGovernanceStatus,
    example: RankingGovernanceStatus.normal,
  })
  governance_status: RankingGovernanceStatus;

  @ApiProperty({ example: false })
  is_hidden: boolean;

  @ApiProperty({ example: false })
  is_disqualified: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  last_earned_at: string | null;
}

export class AdminGamificationIntegrityCaseDTO {
  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  case_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  member_name: string;

  @ApiProperty({ enum: IntegrityCaseStatus, example: IntegrityCaseStatus.open })
  status: IntegrityCaseStatus;

  @ApiProperty({ enum: IntegrityRiskLevel, example: IntegrityRiskLevel.high })
  risk_level: IntegrityRiskLevel;

  @ApiPropertyOptional({
    type: String,
    example: 'Rep pattern anomaly needs review.',
    nullable: true,
  })
  summary: string | null;

  @ApiProperty({ example: '2026-04-24T00:00:00.000Z' })
  opened_at: string;

  @ApiProperty({ example: 2 })
  evidence_event_count: number;
}

export class AdminGamificationIntegritySectionDTO {
  @ApiProperty({ example: 3 })
  open_case_count: number;

  @ApiProperty({ example: 1 })
  escalated_case_count: number;

  @ApiProperty({ example: 1 })
  high_risk_profile_count: number;

  @ApiProperty({ type: () => [AdminGamificationIntegrityCaseDTO] })
  cases: AdminGamificationIntegrityCaseDTO[];
}

export class AdminGamificationRankingProfileDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  member_name: string;

  @ApiProperty({ enum: RankingVisibility, example: RankingVisibility.public })
  visibility: RankingVisibility;

  @ApiProperty({
    enum: RankingGovernanceStatus,
    example: RankingGovernanceStatus.hidden_by_admin,
  })
  governance_status: RankingGovernanceStatus;

  @ApiPropertyOptional({
    type: String,
    example: 'Anonymous Phoenix',
    nullable: true,
  })
  display_alias: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Hidden pending moderation.',
    nullable: true,
  })
  admin_note: string | null;

  @ApiProperty({ example: true })
  season_is_hidden: boolean;

  @ApiProperty({ example: false })
  season_is_disqualified: boolean;

  @ApiProperty({ example: '2026-04-24T00:00:00.000Z' })
  updated_at: string;
}

export class AdminGamificationRankingSectionDTO {
  @ApiProperty({ example: 5 })
  governed_profile_count: number;

  @ApiProperty({ example: 3 })
  hidden_profile_count: number;

  @ApiProperty({ example: 2 })
  disqualified_profile_count: number;

  @ApiProperty({ type: () => [AdminGamificationRankingProfileDTO] })
  profiles: AdminGamificationRankingProfileDTO[];
}

export class AdminGamificationCreatorProfileDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  member_name: string;

  @ApiProperty({ enum: CreatorState, example: CreatorState.candidate })
  state: CreatorState;

  @ApiProperty({ example: 'Candidate' })
  state_label: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Two clean custom submissions.',
    nullable: true,
  })
  admin_notes: string | null;

  @ApiProperty({ example: 4 })
  submission_count: number;

  @ApiProperty({ example: 2 })
  published_submission_count: number;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-24T00:00:00.000Z',
    nullable: true,
  })
  last_state_changed_at: string | null;
}

export class AdminGamificationCreatorSectionDTO {
  @ApiProperty({ example: 2 })
  candidate_count: number;

  @ApiProperty({ example: 1 })
  pending_review_count: number;

  @ApiProperty({ example: 4 })
  approved_count: number;

  @ApiProperty({ example: 1 })
  suspended_count: number;

  @ApiProperty({ example: 0 })
  revoked_count: number;

  @ApiProperty({ type: () => [AdminGamificationCreatorProfileDTO] })
  profiles: AdminGamificationCreatorProfileDTO[];
}

export class AdminGamificationAuditActionDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({
    enum: ModerationActionType,
    example: ModerationActionType.void_progression_grant,
  })
  action_type: ModerationActionType;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  target_user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  target_name: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Manual review confirmed the correction.',
    nullable: true,
  })
  rationale: string | null;

  @ApiProperty({ example: '2026-04-24T00:00:00.000Z' })
  created_at: string;

  @ApiPropertyOptional({
    type: String,
    example: '66666666-6666-4666-8666-666666666666',
    nullable: true,
  })
  progression_grant_id: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '88888888-8888-4888-8888-888888888888',
    nullable: true,
  })
  integrity_case_id: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  season_id: string | null;
}

export class AdminGamificationAuditSectionDTO {
  @ApiProperty({ example: 7 })
  recent_correction_count: number;

  @ApiProperty({ type: () => [AdminGamificationAuditActionDTO] })
  recent_actions: AdminGamificationAuditActionDTO[];
}

export class AdminGamificationOverviewResponseDTO {
  @ApiProperty({ example: '2026-04-24T00:00:00.000Z' })
  generated_at: string;

  @ApiPropertyOptional({
    type: () => AdminGamificationSeasonSummaryDTO,
    nullable: true,
  })
  active_season: AdminGamificationSeasonSummaryDTO | null;

  @ApiProperty({ type: () => AdminGamificationIntegritySectionDTO })
  integrity: AdminGamificationIntegritySectionDTO;

  @ApiProperty({ type: () => AdminGamificationRankingSectionDTO })
  rankings: AdminGamificationRankingSectionDTO;

  @ApiProperty({ type: () => AdminGamificationCreatorSectionDTO })
  creators: AdminGamificationCreatorSectionDTO;

  @ApiProperty({ type: () => AdminGamificationAuditSectionDTO })
  audit: AdminGamificationAuditSectionDTO;
}
