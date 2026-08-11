import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MasteryRank,
  MilestoneDefinitionStatus,
  MilestoneProgressStatus,
  Prisma,
  ProgressionGrantStatus,
  ProgressionGrantType,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
} from '@prisma/client';
import { parseGamificationBackfillOptions } from '../backfill-gamification';
import {
  buildGamificationBackfillPlan,
  type GamificationBackfillInput,
} from './gamification-backfill';

function buildInput(): GamificationBackfillInput {
  const now = new Date('2026-08-11T12:00:00.000Z');
  const activeSeason = {
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    id: 'season-active',
    starts_at: new Date('2026-08-01T00:00:00.000Z'),
    status: SeasonStatus.active,
  };

  return {
    grants: [
      {
        amount: 1_200,
        created_at: new Date('2026-08-10T10:00:00.000Z'),
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        muscle_group: 'Chest',
        season_id: activeSeason.id,
        user_id: 'user-1',
      },
      {
        amount: 900,
        created_at: new Date('2026-08-09T10:00:00.000Z'),
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        muscle_group: 'quads',
        season_id: activeSeason.id,
        user_id: 'user-1',
      },
      {
        amount: 400,
        created_at: new Date('2026-08-10T11:00:00.000Z'),
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.season_points,
        muscle_group: null,
        season_id: activeSeason.id,
        user_id: 'user-1',
      },
      {
        amount: 2_000,
        created_at: new Date('2026-08-08T10:00:00.000Z'),
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        muscle_group: 'core',
        season_id: activeSeason.id,
        user_id: 'user-2',
      },
      {
        amount: 900,
        created_at: new Date('2026-08-08T10:00:00.000Z'),
        grant_status: ProgressionGrantStatus.voided,
        grant_type: ProgressionGrantType.xp,
        muscle_group: 'core',
        season_id: activeSeason.id,
        user_id: 'user-3',
      },
    ],
    milestoneDefinitions: [
      {
        condition_payload: { metric: 'total_xp', target: 1_000 },
        id: 'milestone-exp',
        is_active: true,
        status: MilestoneDefinitionStatus.active,
      },
      {
        condition_payload: { metric: 'tracked_muscle_groups', target: 2 },
        id: 'milestone-muscles',
        is_active: true,
        status: MilestoneDefinitionStatus.active,
      },
    ],
    milestoneProgress: [
      {
        claimed_at: null,
        id: 'progress-existing',
        milestone_definition_id: 'milestone-exp',
        progress_payload: null,
        progress_value: 100,
        reward_granted_at: null,
        status: MilestoneProgressStatus.in_progress,
        unlocked_at: null,
        user_id: 'user-1',
      },
    ],
    muscleMastery: [
      {
        id: 'mastery-existing',
        last_ranked_at: null,
        muscle_group: 'chest',
        rank: MasteryRank.bronze,
        total_volume_kg: new Prisma.Decimal(500),
        user_id: 'user-1',
        xp_points: 800,
      },
    ],
    now,
    profiles: [
      {
        active_season_id: null,
        current_season_points: 40,
        current_streak: 2,
        last_progressed_at: null,
        longest_streak: 4,
        total_xp: 100,
        user_id: 'user-1',
      },
    ],
    rankingProfiles: [
      {
        governance_status: RankingGovernanceStatus.normal,
        user_id: 'user-1',
        visibility: RankingVisibility.private,
      },
    ],
    seasons: [activeSeason],
    seasonalStandings: [],
  };
}

test('backfill derives additive lifetime, seasonal, muscle, achievement, and ranking state', () => {
  const plan = buildGamificationBackfillPlan(buildInput());
  const profile = plan.profiles.find((row) => row.user_id === 'user-1');
  const chest = plan.muscleMastery.find(
    (row) => row.user_id === 'user-1' && row.muscle_group === 'chest',
  );
  const expProgress = plan.milestoneProgress.find(
    (row) =>
      row.user_id === 'user-1' &&
      row.milestone_definition_id === 'milestone-exp',
  );

  assert.equal(profile?.total_xp, 2_100);
  assert.equal(profile?.current_season_points, 400);
  assert.equal(profile?.active_season_id, 'season-active');
  assert.equal(chest?.xp_points, 1_200);
  assert.equal(chest?.rank, MasteryRank.silver);
  assert.equal(expProgress?.status, MilestoneProgressStatus.unlocked);
  assert.equal(plan.rankingProfiles[0]?.user_id, 'user-2');
  assert.equal(plan.seasonalStandings.length, 2);
  assert.equal(plan.report.usersConsidered, 2);
});

test('backfill plan is deterministic and never lowers existing EXP', () => {
  const input = buildInput();
  const first = buildGamificationBackfillPlan(input);
  const second = buildGamificationBackfillPlan(input);
  assert.deepEqual(second, first);

  const preserved = buildGamificationBackfillPlan({
    ...input,
    profiles: input.profiles.map((profile) => ({
      ...profile,
      total_xp: 5_000,
    })),
  });
  assert.equal(preserved.profiles[0]?.total_xp, 5_000);
});

test('backfill entrypoint defaults to dry-run and rejects ambiguous write flags', () => {
  assert.equal(
    parseGamificationBackfillOptions(['node', 'backfill']).dryRun,
    true,
  );
  assert.equal(
    parseGamificationBackfillOptions(['node', 'backfill', '--dry-run']).dryRun,
    true,
  );
  assert.equal(
    parseGamificationBackfillOptions(['node', 'backfill', '--apply']).dryRun,
    false,
  );
  assert.throws(() =>
    parseGamificationBackfillOptions([
      'node',
      'backfill',
      '--dry-run',
      '--apply',
    ]),
  );
});
