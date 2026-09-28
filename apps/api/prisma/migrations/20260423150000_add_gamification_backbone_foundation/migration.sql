-- CreateEnum
CREATE TYPE "ProgressionSourceType" AS ENUM (
    'workout_session_completed',
    'workout_session_invalidated',
    'pose_session_finalized',
    'pose_session_flagged',
    'rep_log_accepted',
    'rep_log_rejected',
    'moderation_action'
);

-- CreateEnum
CREATE TYPE "ProgressionSourceStatus" AS ENUM (
    'pending',
    'applied',
    'blocked',
    'reduced',
    'voided',
    'invalidated'
);

-- CreateEnum
CREATE TYPE "ProgressionGrantType" AS ENUM (
    'xp',
    'season_points',
    'streak_credit',
    'penalty'
);

-- CreateEnum
CREATE TYPE "ProgressionGrantStatus" AS ENUM (
    'applied',
    'voided'
);

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM (
    'draft',
    'active',
    'closed',
    'archived'
);

-- CreateEnum
CREATE TYPE "MilestoneCategory" AS ENUM (
    'training',
    'consistency',
    'season',
    'creator',
    'governance'
);

-- CreateEnum
CREATE TYPE "MilestoneTriggerType" AS ENUM (
    'source_event',
    'summary_threshold',
    'streak',
    'manual'
);

-- CreateEnum
CREATE TYPE "MilestoneProgressStatus" AS ENUM (
    'in_progress',
    'unlocked',
    'claimed'
);

-- CreateEnum
CREATE TYPE "RankingVisibility" AS ENUM (
    'public',
    'anonymous',
    'private'
);

-- CreateEnum
CREATE TYPE "RankingGovernanceStatus" AS ENUM (
    'normal',
    'hidden_by_user',
    'anonymized_by_user',
    'hidden_by_admin',
    'disqualified'
);

-- CreateEnum
CREATE TYPE "IntegrityRiskLevel" AS ENUM (
    'low',
    'medium',
    'high'
);

-- CreateEnum
CREATE TYPE "IntegrityCaseStatus" AS ENUM (
    'open',
    'under_review',
    'resolved_valid',
    'resolved_invalid',
    'escalated'
);

-- CreateEnum
CREATE TYPE "CreatorState" AS ENUM (
    'none',
    'candidate',
    'pending_review',
    'approved',
    'suspended',
    'revoked'
);

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM (
    'void_progression_grant',
    'restore_progression_grant',
    'hide_from_rankings',
    'disqualify_active_season',
    'approve_creator',
    'suspend_creator',
    'revoke_creator',
    'resolve_integrity_case_valid',
    'resolve_integrity_case_invalid'
);

-- CreateTable
CREATE TABLE "season_definitions" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "SeasonStatus" NOT NULL DEFAULT 'draft',
    "rules_version" VARCHAR(50) NOT NULL DEFAULT 'v1',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "season_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_source_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" "ProgressionSourceType" NOT NULL,
    "source_id" VARCHAR(191) NOT NULL,
    "source_status" "ProgressionSourceStatus" NOT NULL DEFAULT 'pending',
    "source_context" JSONB,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progression_source_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "category" "MilestoneCategory" NOT NULL,
    "trigger_type" "MilestoneTriggerType" NOT NULL,
    "condition_payload" JSONB,
    "reward_payload" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "milestone_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progression_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active_season_id" UUID,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "current_season_points" INTEGER NOT NULL DEFAULT 0,
    "last_progressed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_progression_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "visibility" "RankingVisibility" NOT NULL DEFAULT 'public',
    "governance_status" "RankingGovernanceStatus" NOT NULL DEFAULT 'normal',
    "display_alias" VARCHAR(100),
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ranking_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "risk_level" "IntegrityRiskLevel" NOT NULL DEFAULT 'low',
    "open_case_count" INTEGER NOT NULL DEFAULT 0,
    "last_flagged_at" TIMESTAMPTZ(6),
    "last_resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integrity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state" "CreatorState" NOT NULL DEFAULT 'none',
    "last_state_changed_at" TIMESTAMPTZ(6),
    "admin_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasonal_standings" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "season_points" INTEGER NOT NULL DEFAULT 0,
    "rank_position" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_disqualified" BOOLEAN NOT NULL DEFAULT false,
    "last_earned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seasonal_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_milestone_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "milestone_definition_id" UUID NOT NULL,
    "status" "MilestoneProgressStatus" NOT NULL DEFAULT 'in_progress',
    "progress_value" INTEGER NOT NULL DEFAULT 0,
    "progress_payload" JSONB,
    "unlocked_at" TIMESTAMPTZ(6),
    "claimed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_milestone_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_cases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "IntegrityCaseStatus" NOT NULL DEFAULT 'open',
    "summary" VARCHAR(255),
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integrity_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_event_id" UUID,
    "integrity_case_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "reason_code" VARCHAR(100),
    "risk_level" "IntegrityRiskLevel" NOT NULL DEFAULT 'low',
    "details" JSONB,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integrity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_grant_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_event_id" UUID,
    "season_id" UUID,
    "grant_type" "ProgressionGrantType" NOT NULL,
    "grant_status" "ProgressionGrantStatus" NOT NULL DEFAULT 'applied',
    "amount" INTEGER NOT NULL,
    "muscle_group" VARCHAR(100),
    "reason" VARCHAR(255),
    "metadata" JSONB,
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progression_grant_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_action_records" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "target_user_id" UUID NOT NULL,
    "source_event_id" UUID,
    "progression_grant_id" UUID,
    "integrity_case_id" UUID,
    "season_id" UUID,
    "action_type" "ModerationActionType" NOT NULL,
    "rationale" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_action_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "season_definitions_status_starts_at_idx" ON "season_definitions"("status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "progression_source_events_source_type_source_id_key" ON "progression_source_events"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "progression_source_events_user_id_created_at_idx" ON "progression_source_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "progression_source_events_source_status_created_at_idx" ON "progression_source_events"("source_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_definitions_key_key" ON "milestone_definitions"("key");

-- CreateIndex
CREATE INDEX "milestone_definitions_category_is_active_idx" ON "milestone_definitions"("category", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_progression_profiles_user_id_key" ON "user_progression_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_progression_profiles_active_season_id_idx" ON "user_progression_profiles"("active_season_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_profiles_user_id_key" ON "ranking_profiles"("user_id");

-- CreateIndex
CREATE INDEX "ranking_profiles_visibility_governance_status_idx" ON "ranking_profiles"("visibility", "governance_status");

-- CreateIndex
CREATE UNIQUE INDEX "integrity_profiles_user_id_key" ON "integrity_profiles"("user_id");

-- CreateIndex
CREATE INDEX "integrity_profiles_risk_level_open_case_count_idx" ON "integrity_profiles"("risk_level", "open_case_count");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_user_id_key" ON "creator_profiles"("user_id");

-- CreateIndex
CREATE INDEX "creator_profiles_state_last_state_changed_at_idx" ON "creator_profiles"("state", "last_state_changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "seasonal_standings_season_id_user_id_key" ON "seasonal_standings"("season_id", "user_id");

-- CreateIndex
CREATE INDEX "seasonal_standings_season_id_season_points_idx" ON "seasonal_standings"("season_id", "season_points");

-- CreateIndex
CREATE INDEX "seasonal_standings_user_id_idx" ON "seasonal_standings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_milestone_progress_user_id_milestone_definition_id_key" ON "user_milestone_progress"("user_id", "milestone_definition_id");

-- CreateIndex
CREATE INDEX "user_milestone_progress_status_unlocked_at_idx" ON "user_milestone_progress"("status", "unlocked_at");

-- CreateIndex
CREATE INDEX "integrity_cases_user_id_status_opened_at_idx" ON "integrity_cases"("user_id", "status", "opened_at");

-- CreateIndex
CREATE INDEX "integrity_events_user_id_created_at_idx" ON "integrity_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "integrity_events_integrity_case_id_idx" ON "integrity_events"("integrity_case_id");

-- CreateIndex
CREATE INDEX "progression_grant_ledger_user_id_grant_type_created_at_idx" ON "progression_grant_ledger"("user_id", "grant_type", "created_at");

-- CreateIndex
CREATE INDEX "progression_grant_ledger_source_event_id_idx" ON "progression_grant_ledger"("source_event_id");

-- CreateIndex
CREATE INDEX "progression_grant_ledger_season_id_idx" ON "progression_grant_ledger"("season_id");

-- CreateIndex
CREATE INDEX "moderation_action_records_target_user_id_created_at_idx" ON "moderation_action_records"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_action_records_actor_user_id_created_at_idx" ON "moderation_action_records"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_action_records_action_type_created_at_idx" ON "moderation_action_records"("action_type", "created_at");

-- AddForeignKey
ALTER TABLE "progression_source_events" ADD CONSTRAINT "progression_source_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progression_profiles" ADD CONSTRAINT "user_progression_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progression_profiles" ADD CONSTRAINT "user_progression_profiles_active_season_id_fkey" FOREIGN KEY ("active_season_id") REFERENCES "season_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_profiles" ADD CONSTRAINT "ranking_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_profiles" ADD CONSTRAINT "integrity_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_standings" ADD CONSTRAINT "seasonal_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "season_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_standings" ADD CONSTRAINT "seasonal_standings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestone_progress" ADD CONSTRAINT "user_milestone_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestone_progress" ADD CONSTRAINT "user_milestone_progress_milestone_definition_id_fkey" FOREIGN KEY ("milestone_definition_id") REFERENCES "milestone_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_cases" ADD CONSTRAINT "integrity_cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_events" ADD CONSTRAINT "integrity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_events" ADD CONSTRAINT "integrity_events_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "progression_source_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_events" ADD CONSTRAINT "integrity_events_integrity_case_id_fkey" FOREIGN KEY ("integrity_case_id") REFERENCES "integrity_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_grant_ledger" ADD CONSTRAINT "progression_grant_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_grant_ledger" ADD CONSTRAINT "progression_grant_ledger_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "progression_source_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_grant_ledger" ADD CONSTRAINT "progression_grant_ledger_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "season_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_action_records" ADD CONSTRAINT "moderation_action_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_action_records" ADD CONSTRAINT "moderation_action_records_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_action_records" ADD CONSTRAINT "moderation_action_records_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "progression_source_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_action_records" ADD CONSTRAINT "moderation_action_records_progression_grant_id_fkey" FOREIGN KEY ("progression_grant_id") REFERENCES "progression_grant_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_action_records" ADD CONSTRAINT "moderation_action_records_integrity_case_id_fkey" FOREIGN KEY ("integrity_case_id") REFERENCES "integrity_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_action_records" ADD CONSTRAINT "moderation_action_records_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "season_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
