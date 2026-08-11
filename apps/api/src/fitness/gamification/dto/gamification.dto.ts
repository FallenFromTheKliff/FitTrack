import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreatorState,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  MasteryRank,
  MilestoneCategory,
  MilestoneDefinitionStatus,
  MilestoneEvidenceRequirement,
  MilestoneEvidenceSubmissionStatus,
  MilestoneEvidenceType,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  MilestoneVerificationPolicy,
  ModerationActionType,
  ProgressionIconKind,
  ProgressionGrantStatus,
  ProgressionSourceStatus,
  ProgressionSourceType,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
} from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsObject,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { TrimString } from '../../../common/validators/trim-string.decorator';
import { PaginationDTO } from '../../../user/dto/user-dto';

export class MasteryFilterDTO {
  @ApiPropertyOptional({ example: 'legs' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MinLength(1, { message: 'muscle_group must not be empty' })
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

export class AdminManualExpMemberFilterDTO {
  @ApiPropertyOptional({
    description: 'Member name or email. Results are limited to eligible members.',
    example: 'seed.member.active',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, {
    message: 'search must not exceed 100 characters',
  })
  search?: string;
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

export class LeaderboardFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ description: 'Opaque stable paging cursor.' })
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(600)
  cursor?: string;

  @ApiPropertyOptional({ description: 'Snapshot timestamp returned by the first page.' })
  @IsOptional()
  @IsDateString()
  snapshot?: string;
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

  @ApiPropertyOptional({ type: Object, nullable: true })
  condition_payload: Record<string, unknown> | null;

  @ApiPropertyOptional({
    enum: MilestoneVerificationPolicy,
    example: MilestoneVerificationPolicy.auto,
  })
  verification_policy?: MilestoneVerificationPolicy;

  @ApiPropertyOptional({
    enum: MilestoneEvidenceRequirement,
    example: MilestoneEvidenceRequirement.none,
  })
  evidence_requirement?: MilestoneEvidenceRequirement;

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

  @ApiProperty({ enum: ProgressionIconKind, example: ProgressionIconKind.library })
  icon_kind: ProgressionIconKind;

  @ApiPropertyOptional({ example: 'trophy', nullable: true })
  icon_key: string | null;

  @ApiPropertyOptional({ example: 'uploads/admin/2026/08/badge.png', nullable: true })
  icon_asset_key: string | null;

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

export class AchievementReviewResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  member_id: string;

  @ApiProperty({ example: 'Casey Reyes' })
  member_name: string;

  @ApiProperty({ example: 'CR' })
  member_initials: string;

  @ApiProperty({ example: 'member.active@fittrack.com' })
  member_email: string;

  @ApiProperty({ example: 'First Workout Complete' })
  badge_label: string;

  @ApiProperty({
    example:
      'Unlocked from 1/1 completed_workout_sessions progress in the local database.',
  })
  proof_caption: string;

  @ApiProperty({
    example: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D...',
  })
  proof_image_url: string;

  @ApiProperty({
    enum: ['Pending', 'Approved', 'Rejected'],
    example: 'Pending',
  })
  status: 'Pending' | 'Approved' | 'Rejected';

  @ApiProperty({ example: '2026-04-23T09:30:00.000Z' })
  submitted_at: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-24T09:30:00.000Z',
  })
  reviewed_at?: string;

  @ApiPropertyOptional({ example: 'Claimed by the member.' })
  reviewer_notes?: string;
}

export class MilestoneEvidenceSubmissionResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  milestone_definition_id: string;

  @ApiPropertyOptional({ example: 'first-workout-complete' })
  milestone_key?: string;

  @ApiPropertyOptional({ example: 'First Workout Complete' })
  milestone_title?: string;

  @ApiPropertyOptional({ example: 'Casey Reyes', nullable: true })
  member_name?: string | null;

  @ApiPropertyOptional({ example: 'CR', nullable: true })
  member_initials?: string | null;

  @ApiPropertyOptional({
    example: 'member.active@fittrack.com',
    nullable: true,
  })
  member_email?: string | null;

  @ApiProperty({
    enum: MilestoneEvidenceSubmissionStatus,
    example: MilestoneEvidenceSubmissionStatus.pending,
  })
  status: MilestoneEvidenceSubmissionStatus;

  @ApiProperty({
    enum: MilestoneEvidenceType,
    example: MilestoneEvidenceType.image,
  })
  evidence_type: MilestoneEvidenceType;

  @ApiProperty({ example: 'https://cdn.fittrack.test/milestone-proof.png' })
  file_url: string;

  @ApiPropertyOptional({
    example: 'milestone-evidence/2026/05/proof.png',
    nullable: true,
  })
  file_key: string | null;

  @ApiProperty({ example: 'image/png' })
  mime_type: string;

  @ApiProperty({ example: 458120 })
  size_bytes: number;

  @ApiPropertyOptional({ example: 'proof.png', nullable: true })
  original_filename: string | null;

  @ApiPropertyOptional({ example: 'Coach signed lift log.', nullable: true })
  caption: string | null;

  @ApiPropertyOptional({ example: 'Clear evidence.', nullable: true })
  reviewer_notes: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-05-22T09:30:00.000Z',
    nullable: true,
  })
  reviewed_at: string | null;

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    nullable: true,
  })
  reviewed_by_user_id: string | null;

  @ApiProperty({ example: '2026-05-22T09:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-05-22T09:00:00.000Z' })
  updated_at: string;
}

export class AdminMilestoneDefinitionResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiProperty({ example: 'first-workout-complete' })
  key: string;

  @ApiProperty({ example: 'First Workout Complete' })
  title: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Complete your first tracked workout.',
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

  @ApiProperty({
    enum: MilestoneDefinitionStatus,
    example: MilestoneDefinitionStatus.active,
  })
  status: MilestoneDefinitionStatus;

  @ApiProperty({
    enum: MilestoneVerificationPolicy,
    example: MilestoneVerificationPolicy.auto,
  })
  verification_policy: MilestoneVerificationPolicy;

  @ApiProperty({
    enum: MilestoneEvidenceRequirement,
    example: MilestoneEvidenceRequirement.none,
  })
  evidence_requirement: MilestoneEvidenceRequirement;

  @ApiPropertyOptional({ type: Object, nullable: true })
  condition_payload: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  reward_payload: Record<string, unknown> | null;

  @ApiProperty({ enum: ProgressionIconKind, example: ProgressionIconKind.library })
  icon_kind: ProgressionIconKind;

  @ApiPropertyOptional({ example: 'trophy', nullable: true })
  icon_key: string | null;

  @ApiPropertyOptional({ example: 'uploads/admin/2026/08/badge.png', nullable: true })
  icon_asset_key: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: false })
  is_hidden: boolean;

  @ApiProperty({ example: 10 })
  sort_order: number;

  @ApiProperty({ example: 128 })
  progress_count: number;

  @ApiProperty({ example: 72 })
  unlocked_count: number;

  @ApiProperty({ example: 4 })
  pending_review_count: number;

  @ApiPropertyOptional({
    type: String,
    example: '2026-05-01T00:00:00.000Z',
    nullable: true,
  })
  starts_at: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-06-01T00:00:00.000Z',
    nullable: true,
  })
  ends_at: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  archived_at: string | null;

  @ApiPropertyOptional({ nullable: true })
  archived_by_user_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  created_by_user_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  updated_by_user_id: string | null;

  @ApiProperty({ example: '2026-05-22T09:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-05-22T09:00:00.000Z' })
  updated_at: string;
}

export class AdminMilestoneDefinitionFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'workout' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(120, { message: 'search must not exceed 120 characters' })
  search?: string;

  @ApiPropertyOptional({ enum: MilestoneDefinitionStatus })
  @IsOptional()
  @IsEnum(MilestoneDefinitionStatus, {
    message: `status must be one of: ${Object.values(MilestoneDefinitionStatus).join(', ')}`,
  })
  status?: MilestoneDefinitionStatus;

  @ApiPropertyOptional({ enum: MilestoneCategory })
  @IsOptional()
  @IsEnum(MilestoneCategory, {
    message: `category must be one of: ${Object.values(MilestoneCategory).join(', ')}`,
  })
  category?: MilestoneCategory;

  @ApiPropertyOptional({ enum: MilestoneTriggerType })
  @IsOptional()
  @IsEnum(MilestoneTriggerType, {
    message: `trigger_type must be one of: ${Object.values(MilestoneTriggerType).join(', ')}`,
  })
  trigger_type?: MilestoneTriggerType;

  @ApiPropertyOptional({ enum: MilestoneVerificationPolicy })
  @IsOptional()
  @IsEnum(MilestoneVerificationPolicy, {
    message: `verification_policy must be one of: ${Object.values(MilestoneVerificationPolicy).join(', ')}`,
  })
  verification_policy?: MilestoneVerificationPolicy;

  @ApiPropertyOptional({ enum: MilestoneEvidenceRequirement })
  @IsOptional()
  @IsEnum(MilestoneEvidenceRequirement, {
    message: `evidence_requirement must be one of: ${Object.values(MilestoneEvidenceRequirement).join(', ')}`,
  })
  evidence_requirement?: MilestoneEvidenceRequirement;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'include_archived must be a boolean' })
  include_archived?: boolean;

  @ApiPropertyOptional({
    enum: ['created_at', 'updated_at', 'title', 'sort_order'],
    example: 'updated_at',
  })
  @IsOptional()
  @IsIn(['created_at', 'updated_at', 'title', 'sort_order'], {
    message: 'sort must be one of: created_at, updated_at, title, sort_order',
  })
  sort?: 'created_at' | 'updated_at' | 'title' | 'sort_order';
}

export class AdminMilestoneDefinitionDTO {
  @ApiProperty({ example: 'first-workout-complete' })
  @TrimString()
  @IsString({ message: 'key must be a string' })
  @MinLength(3, { message: 'key must be at least 3 characters' })
  @MaxLength(120, { message: 'key must not exceed 120 characters' })
  key: string;

  @ApiProperty({ example: 'First Workout Complete' })
  @TrimString()
  @IsString({ message: 'title must be a string' })
  @MinLength(3, { message: 'title must be at least 3 characters' })
  @MaxLength(160, { message: 'title must not exceed 160 characters' })
  title: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(1000, { message: 'description must not exceed 1000 characters' })
  description?: string | null;

  @ApiProperty({ enum: MilestoneCategory })
  @IsEnum(MilestoneCategory, {
    message: `category must be one of: ${Object.values(MilestoneCategory).join(', ')}`,
  })
  category: MilestoneCategory;

  @ApiProperty({ enum: MilestoneTriggerType })
  @IsEnum(MilestoneTriggerType, {
    message: `trigger_type must be one of: ${Object.values(MilestoneTriggerType).join(', ')}`,
  })
  trigger_type: MilestoneTriggerType;

  @ApiPropertyOptional({ enum: MilestoneDefinitionStatus })
  @IsOptional()
  @IsEnum(MilestoneDefinitionStatus, {
    message: `status must be one of: ${Object.values(MilestoneDefinitionStatus).join(', ')}`,
  })
  status?: MilestoneDefinitionStatus;

  @ApiPropertyOptional({ enum: MilestoneVerificationPolicy })
  @IsOptional()
  @IsEnum(MilestoneVerificationPolicy, {
    message: `verification_policy must be one of: ${Object.values(MilestoneVerificationPolicy).join(', ')}`,
  })
  verification_policy?: MilestoneVerificationPolicy;

  @ApiPropertyOptional({ enum: MilestoneEvidenceRequirement })
  @IsOptional()
  @IsEnum(MilestoneEvidenceRequirement, {
    message: `evidence_requirement must be one of: ${Object.values(MilestoneEvidenceRequirement).join(', ')}`,
  })
  evidence_requirement?: MilestoneEvidenceRequirement;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject({ message: 'condition_payload must be an object' })
  condition_payload?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject({ message: 'reward_payload must be an object' })
  reward_payload?: Record<string, unknown> | null;

  @ApiPropertyOptional({ enum: ProgressionIconKind, example: ProgressionIconKind.library })
  @IsOptional()
  @IsEnum(ProgressionIconKind)
  icon_kind?: ProgressionIconKind;

  @ApiPropertyOptional({ example: 'trophy', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  icon_key?: string | null;

  @ApiPropertyOptional({ example: 'uploads/admin/2026/08/badge.png', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  icon_asset_key?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'is_hidden must be a boolean' })
  is_hidden?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt({ message: 'sort_order must be an integer' })
  @Min(0, { message: 'sort_order must be zero or greater' })
  @Max(100000, { message: 'sort_order must be 100000 or less' })
  sort_order?: number;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsString({ message: 'starts_at must be an ISO date string' })
  starts_at?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsString({ message: 'ends_at must be an ISO date string' })
  ends_at?: string | null;
}

export class SubmitMilestoneEvidenceDTO {
  @ApiProperty({ enum: MilestoneEvidenceType })
  @IsEnum(MilestoneEvidenceType, {
    message: `evidence_type must be one of: ${Object.values(MilestoneEvidenceType).join(', ')}`,
  })
  evidence_type: MilestoneEvidenceType;

  @ApiProperty({ example: 'https://cdn.fittrack.test/milestone-proof.mp4' })
  @TrimString()
  @IsString({ message: 'file_url must be a string' })
  @MaxLength(2000, { message: 'file_url must not exceed 2000 characters' })
  file_url: string;

  @ApiPropertyOptional({ example: 'milestone-evidence/2026/05/proof.mp4' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'file_key must be a string' })
  @MaxLength(500, { message: 'file_key must not exceed 500 characters' })
  file_key?: string | null;

  @ApiProperty({ example: 'video/mp4' })
  @TrimString()
  @IsString({ message: 'mime_type must be a string' })
  @MaxLength(100, { message: 'mime_type must not exceed 100 characters' })
  mime_type: string;

  @ApiProperty({ example: 10485760 })
  @IsInt({ message: 'size_bytes must be an integer' })
  @Min(1, { message: 'size_bytes must be greater than zero' })
  @Max(25 * 1024 * 1024, {
    message: 'size_bytes must be 25 MiB or smaller',
  })
  size_bytes: number;

  @ApiPropertyOptional({ example: 'proof.mp4' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'original_filename must be a string' })
  @MaxLength(255, {
    message: 'original_filename must not exceed 255 characters',
  })
  original_filename?: string | null;

  @ApiPropertyOptional({ example: 'Coach signed lift log.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'caption must be a string' })
  @MaxLength(1000, { message: 'caption must not exceed 1000 characters' })
  caption?: string | null;
}

export class AdminMilestoneEvidenceFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'casey' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(120, { message: 'search must not exceed 120 characters' })
  search?: string;

  @ApiPropertyOptional({ enum: MilestoneEvidenceSubmissionStatus })
  @IsOptional()
  @IsEnum(MilestoneEvidenceSubmissionStatus, {
    message: `status must be one of: ${Object.values(MilestoneEvidenceSubmissionStatus).join(', ')}`,
  })
  status?: MilestoneEvidenceSubmissionStatus;
}

export class ReviewMilestoneEvidenceDTO {
  @ApiProperty({
    enum: [
      MilestoneEvidenceSubmissionStatus.approved,
      MilestoneEvidenceSubmissionStatus.rejected,
    ],
    example: MilestoneEvidenceSubmissionStatus.approved,
  })
  @IsIn(
    [
      MilestoneEvidenceSubmissionStatus.approved,
      MilestoneEvidenceSubmissionStatus.rejected,
    ],
    {
      message: 'status must be approved or rejected',
    },
  )
  status: Extract<
    MilestoneEvidenceSubmissionStatus,
    'approved' | 'rejected'
  >;

  @ApiPropertyOptional({ example: 'Clear evidence.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reviewer_notes must be a string' })
  @MaxLength(1000, {
    message: 'reviewer_notes must not exceed 1000 characters',
  })
  reviewer_notes?: string | null;
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

export class AdminSeasonCreateDTO {
  @ApiProperty({ example: 'Season 2: Strength Cycle' })
  @TrimString()
  @IsString({ message: 'title must be a string' })
  @MinLength(3, { message: 'title must be at least 3 characters' })
  @MaxLength(120, { message: 'title must not exceed 120 characters' })
  title: string;

  @ApiPropertyOptional({
    example: 'A time-bounded competitive season.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string | null;

  @ApiPropertyOptional({ example: 'season-rules-v1' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'rules_version must be a string' })
  @MaxLength(100, {
    message: 'rules_version must not exceed 100 characters',
  })
  rules_version?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'starts_at must be a valid ISO date string' })
  starts_at: string;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'ends_at must be a valid ISO date string' })
  ends_at: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'auto_start_next must be a boolean' })
  auto_start_next?: boolean;
}

export class AdminSeasonUpdateDTO {
  @ApiPropertyOptional({ example: 'Season 2: Strength Cycle' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'title must be a string' })
  @MinLength(3, { message: 'title must be at least 3 characters' })
  @MaxLength(120, { message: 'title must not exceed 120 characters' })
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string | null;

  @ApiPropertyOptional({ example: 'season-rules-v1' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'rules_version must be a string' })
  @MaxLength(100, {
    message: 'rules_version must not exceed 100 characters',
  })
  rules_version?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'starts_at must be a valid ISO date string' })
  starts_at?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'ends_at must be a valid ISO date string' })
  ends_at?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'auto_start_next must be a boolean' })
  auto_start_next?: boolean;
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

export class AdminManualExpAllocationDTO {
  @ApiProperty({
    example: 75,
    description: 'EXP allocated to this muscle group.',
  })
  @Type(() => Number)
  @IsInt({ message: 'amount must be an integer' })
  @Min(1, { message: 'amount must be at least 1' })
  @Max(1000, { message: 'amount must not exceed 1000' })
  amount: number;

  @ApiProperty({
    example: 'legs',
  })
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MinLength(1, { message: 'muscle_group must not be empty' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group: string;
}

export class AdminManualExpGrantDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'user_id must be a UUID' })
  user_id: string;

  @ApiProperty({
    type: () => AdminManualExpAllocationDTO,
    isArray: true,
    minItems: 1,
    example: [
      { muscle_group: 'chest', amount: 75 },
      { muscle_group: 'triceps', amount: 40 },
    ],
  })
  @IsArray({ message: 'allocations must be an array' })
  @ArrayMinSize(1, { message: 'allocations must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => AdminManualExpAllocationDTO)
  allocations: AdminManualExpAllocationDTO[];

  @ApiProperty({
    example: 'Coach confirmed the member completed the post-session workout without camera tracking.',
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

  @ApiPropertyOptional({
    type: [String],
    example: [
      '66666666-6666-4666-8666-666666666666',
      '77777777-7777-4777-8777-777777777777',
    ],
  })
  grant_ids?: string[];

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

  @ApiProperty({ example: false })
  auto_start_next: boolean;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-01T00:00:00.000Z',
    nullable: true,
  })
  activated_at: string | null;

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

  @ApiProperty({ example: 'season-rules-v1' })
  rules_version: string;

  @ApiProperty({ example: false })
  auto_start_next: boolean;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  starts_at: string;

  @ApiProperty({ example: '2026-06-30T23:59:59.000Z' })
  ends_at: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-01T00:00:00.000Z',
    nullable: true,
  })
  activated_at: string | null;

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

export class MuscleLeaderboardFilterDTO extends PaginationDTO {
  @ApiProperty({ enum: ['lifetime', 'season'], example: 'season' })
  @IsIn(['lifetime', 'season'], {
    message: 'scope must be either lifetime or season',
  })
  scope: 'lifetime' | 'season';

  @ApiProperty({ example: 'chest' })
  @TrimString()
  @IsString({ message: 'muscle_key must be a string' })
  @MinLength(1, { message: 'muscle_key must not be empty' })
  @MaxLength(100, {
    message: 'muscle_key must not exceed 100 characters',
  })
  muscle_key: string;

  @ApiPropertyOptional({ example: '33333333-3333-4333-8333-333333333333' })
  @IsOptional()
  @IsUUID('4', { message: 'season_id must be a valid UUID' })
  season_id?: string;

  @ApiPropertyOptional({ description: 'Opaque stable paging cursor.' })
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(600)
  cursor?: string;

  @ApiPropertyOptional({ description: 'Snapshot timestamp returned by the first page.' })
  @IsOptional()
  @IsDateString()
  snapshot?: string;
}

export class AdminMuscleLeaderboardFilterDTO extends MuscleLeaderboardFilterDTO {
  @ApiPropertyOptional({ example: 'sera' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, {
    message: 'search must not exceed 100 characters',
  })
  search?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'include_hidden must be a boolean' })
  include_hidden?: boolean;
}

export class MuscleLeaderboardRowDTO {
  @ApiProperty({ example: 1 })
  rank_position: number;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  display_name: string;

  @ApiProperty({ example: 'chest' })
  muscle_key: string;

  @ApiProperty({ enum: ['lifetime', 'season'], example: 'season' })
  scope: 'lifetime' | 'season';

  @ApiProperty({ example: 950 })
  xp_points: number;

  @ApiProperty({ enum: ProgressionIconKind, example: ProgressionIconKind.library })
  icon_kind: ProgressionIconKind;

  @ApiPropertyOptional({ example: 'dumbbell', nullable: true })
  icon_key: string | null;

  @ApiPropertyOptional({ example: 'uploads/user/2026/08/icon.png', nullable: true })
  icon_asset_key: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatar_url: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  season_id: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Spring 2026',
    nullable: true,
  })
  season_title: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '2026-04-23T09:30:00.000Z',
    nullable: true,
  })
  last_earned_at: string | null;

  @ApiPropertyOptional({ example: true })
  is_current_user?: boolean;
}

export class SeasonTopPerformerDTO {
  @ApiProperty({ example: 1 })
  rank_position: number;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Member' })
  display_name: string;

  @ApiProperty({ example: 580 })
  season_points: number;
}

export class SeasonHistorySummaryDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  season_id: string;

  @ApiProperty({ example: 'Spring 2026' })
  title: string;

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

  @ApiProperty({ type: () => [SeasonTopPerformerDTO] })
  top_performers: SeasonTopPerformerDTO[];
}

export class SeasonTopPerformerFilterDTO {
  @ApiPropertyOptional({ enum: [3, 10], example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([3, 10], { message: 'limit must be either 3 or 10' })
  limit?: 3 | 10;
}

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

  @ApiProperty({ type: Number, example: 4 })
  rank_position: number;

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
