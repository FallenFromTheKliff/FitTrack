import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { minimumUsersForPreservedTesters } from './accounts';
import type { PreservedTesterSource } from './preserved-testers';
import type {
  DynamicSeedConfig,
  MemberCohort,
  ScenarioDimensionCounts,
  SeedCredential,
} from './types';

export const DYNAMIC_SEED_MANIFEST_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  '.artifacts',
  'dynamic-seed-manifest.json',
);

export const MODEL_DELEGATES = [
  'user',
  'accountDeletionRequest',
  'authIdentity',
  'refreshToken',
  'otpVerification',
  'userProfile',
  'appFeedback',
  'progressMetric',
  'notificationPreference',
  'attendanceLog',
  'membershipPlan',
  'membershipCatalogSettings',
  'subscription',
  'membershipCard',
  'payment',
  'commerceCheckoutHold',
  'amenity',
  'facilityFloorPlanMedia',
  'amenityBooking',
  'amenityFeedback',
  'coachProfile',
  'coachSpecialty',
  'coachProfileSpecialty',
  'coachAppointment',
  'recurringCoachingPlan',
  'recurringCoachingScheduleItem',
  'recurringCoachingBillingCycle',
  'coachReview',
  'coachAvailabilitySlot',
  'coachClientRelationship',
  'exerciseCatalog',
  'muscleDefinition',
  'trainingPlan',
  'trainingScheduleDay',
  'planExercise',
  'workoutSession',
  'coachWorkoutAssignment',
  'exerciseLog',
  'poseExerciseProfile',
  'poseSession',
  'muscleMasteryProgress',
  'progressionSourceEvent',
  'progressionGrantLedger',
  'userProgressionProfile',
  'seasonDefinition',
  'seasonalStanding',
  'seasonalMuscleStanding',
  'milestoneDefinition',
  'userMilestoneProgress',
  'milestoneEvidenceSubmission',
  'rankingProfile',
  'integrityProfile',
  'integrityCase',
  'integrityEvent',
  'moderationActionRecord',
  'tdeeProfile',
  'macroTarget',
  'nutritionLog',
  'retailProduct',
  'saleTransaction',
  'saleTransactionItem',
  'gymEquipmentItem',
  'equipmentWriteOff',
  'aiChatSession',
  'aiChatMessage',
  'aiInteractionLog',
  'notification',
  'gymEquipment',
  'auditLog',
  'gymChatSession',
  'gymChatMessage',
  'gymChatInteractionLog',
  'gymOperatingHour',
  'gymSpecialSchedule',
  'gymFaqEntry',
  'businessInsightRun',
] as const;

export type ModelCoverageStatus =
  | 'seeded'
  | 'intentionally-empty'
  | 'derived'
  | 'external-only';

export type DynamicSeedIntegrityStatus = 'passed' | 'failed';

const DERIVED_MODEL_DELEGATES = new Set<string>([
  'progressionSourceEvent',
  'progressionGrantLedger',
  'userProgressionProfile',
  'seasonalStanding',
  'seasonalMuscleStanding',
  'userMilestoneProgress',
  'macroTarget',
  'saleTransactionItem',
  'aiInteractionLog',
  'notification',
  'gymChatInteractionLog',
  'businessInsightRun',
]);

export type DynamicSeedIntegrityViolation = {
  category: string;
  detail: string;
};

export const MODEL_COVERAGE: Record<
  (typeof MODEL_DELEGATES)[number],
  ModelCoverageStatus
> = Object.fromEntries(
  MODEL_DELEGATES.map((delegate) => [
    delegate,
    DERIVED_MODEL_DELEGATES.has(delegate) ? 'derived' : 'seeded',
  ]),
) as Record<(typeof MODEL_DELEGATES)[number], ModelCoverageStatus>;

export type DynamicSeedCoverageCategory = {
  modelCount: number;
  models: string[];
  rowCount: number;
};

export type DynamicSeedCoverageSummary = {
  derived: DynamicSeedCoverageCategory;
  externalOnly: DynamicSeedCoverageCategory;
  intentionallyEmpty: DynamicSeedCoverageCategory;
  seeded: DynamicSeedCoverageCategory;
  totalModelCount: number;
  totalRowCount: number;
};

export function buildModelCoverageSummary(
  counts: Record<string, number>,
): DynamicSeedCoverageSummary {
  const summary: DynamicSeedCoverageSummary = {
    derived: { modelCount: 0, models: [], rowCount: 0 },
    externalOnly: { modelCount: 0, models: [], rowCount: 0 },
    intentionallyEmpty: { modelCount: 0, models: [], rowCount: 0 },
    seeded: { modelCount: 0, models: [], rowCount: 0 },
    totalModelCount: MODEL_DELEGATES.length,
    totalRowCount: 0,
  };

  for (const delegate of MODEL_DELEGATES) {
    const status = MODEL_COVERAGE[delegate];
    const rowCount = counts[delegate] ?? 0;
    const categoryKey =
      status === 'external-only'
        ? 'externalOnly'
        : status === 'intentionally-empty'
          ? 'intentionallyEmpty'
          : status;
    const category = summary[categoryKey];
    category.models.push(delegate);
    category.modelCount += 1;
    category.rowCount += rowCount;
    summary.totalRowCount += rowCount;
  }

  for (const category of [
    summary.seeded,
    summary.derived,
    summary.intentionallyEmpty,
    summary.externalOnly,
  ]) {
    category.models.sort();
  }

  return summary;
}

export type DynamicSeedIntegritySummary = {
  actuals: Record<string, number>;
  caps: Record<string, number>;
  checks: number;
  cohorts: Record<
    MemberCohort,
    {
      actual: number;
      target: number;
      actuals: Record<string, number>;
      caps: Record<string, number>;
    }
  >;
  scenarioMatrix: Record<string, string>;
  roleCounts: Record<string, number>;
  scenarioCounts: ScenarioDimensionCounts;
  status: DynamicSeedIntegrityStatus;
  summary: Record<string, number>;
  targets: Record<string, number>;
  violations: DynamicSeedIntegrityViolation[];
};

export type DynamicSeedManifest = {
  config: {
    anchorDate: string;
    bookingDensity: string;
    coachActiveRate: number;
    coachFormerRate: number;
    coachPausedRate: number;
    exerciseHistory: number;
    historyEndDate: string;
    historyMonths: number;
    historyStartDate: string;
    mode: string;
    pendingPaymentRate: number;
    seed: number;
    sessionDensity: string;
    splitPresetsPerMember: number;
    target: string;
    users: number;
    extraUsers?: number;
    preservedTesterUsers?: number;
    workoutDensity: string;
  };
  counts: Record<string, number>;
  credentials: SeedCredential[];
  integrity: DynamicSeedIntegritySummary;
  modelCoverage: typeof MODEL_COVERAGE;
  coverage: DynamicSeedCoverageSummary;
  manifestPath: string;
  notableIds: Record<string, string>;
  roleCounts: Record<string, number>;
  scenarioCounts: ScenarioDimensionCounts;
  runAt: string;
};

function isCurrentDynamicSeedManifest(
  value: unknown,
): value is DynamicSeedManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const manifest = value as Partial<DynamicSeedManifest>;
  const integrityStatus = manifest.integrity?.status;
  return (
    typeof manifest.runAt === 'string' &&
    (integrityStatus === 'passed' || integrityStatus === 'failed') &&
    Boolean(manifest.config) &&
    Boolean(manifest.counts) &&
    Boolean(manifest.modelCoverage)
  );
}

const noSuccessfulManifestError = (reason: string) =>
  new Error(
    `[dynamic-seed][report] FAILED: no successful current manifest is available (${reason}). ` +
      'Run the realistic local seed successfully before requesting an integrity report.',
  );

export async function invalidateDynamicSeedManifest(
  manifestPath = DYNAMIC_SEED_MANIFEST_PATH,
) {
  try {
    await unlink(manifestPath);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function readCurrentDynamicSeedManifest(
  manifestPath = DYNAMIC_SEED_MANIFEST_PATH,
): Promise<DynamicSeedManifest> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      throw noSuccessfulManifestError(
        'the manifest is missing or was invalidated',
      );
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw noSuccessfulManifestError('the manifest is not valid JSON');
  }
  if (!isCurrentDynamicSeedManifest(parsed)) {
    throw noSuccessfulManifestError(
      'the manifest does not record a current passed or failed seed',
    );
  }
  return parsed;
}

export async function buildModelCounts(prisma: PrismaClient) {
  const counts: Record<string, number> = {};
  const delegateSource = prisma as unknown as Record<
    string,
    { count: () => Promise<number> } | undefined
  >;

  const rows = await Promise.all(
    MODEL_DELEGATES.map(async (delegateName) => {
      const delegate = delegateSource[delegateName];
      return delegate
        ? ([delegateName, await delegate.count()] as const)
        : null;
    }),
  );
  for (const row of rows) {
    if (row) {
      counts[row[0]] = row[1];
    }
  }

  return counts;
}

export function manifestPopulationFields(config: DynamicSeedConfig) {
  const preservedTesterUsers = config.preservedTesterProfiles?.length ?? 0;
  return {
    extraUsers: preservedTesterUsers > 0 ? (config.extraUsers ?? 0) : 0,
    preservedTesterUsers,
  };
}

export function restoreManifestPopulation(
  config: DynamicSeedConfig,
  population: Pick<DynamicSeedManifest['config'], 'users' | 'extraUsers' | 'preservedTesterUsers'>,
  source: PreservedTesterSource | null,
) {
  const count = population.preservedTesterUsers ?? 0;
  const extras = population.extraUsers ?? 0;
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(extras) || extras < 0) {
    throw new Error('[dynamic-seed][report] invalid manifest population counts');
  }
  if (count > 0 && (!source || source.users.length !== count)) {
    throw new Error('[dynamic-seed][report] preserved tester source count does not match manifest');
  }
  config.preservedTesterProfiles = count > 0 ? source!.users : undefined;
  config.extraUsers = count > 0 ? extras : 0;
  config.realUserData = count > 0;
  config.users = minimumUsersForPreservedTesters(
    population.users,
    config.preservedTesterProfiles,
    config.extraUsers,
  );
  if (config.users !== population.users) {
    throw new Error('[dynamic-seed][report] account total does not match manifest');
  }
}

export async function writeDynamicSeedManifest(args: {
  config: DynamicSeedConfig;
  counts: Record<string, number>;
  credentials: SeedCredential[];
  integrity: DynamicSeedIntegritySummary;
  notableIds: Record<string, string>;
  roleCounts?: Record<string, number>;
  scenarioCounts?: ScenarioDimensionCounts;
}) {
  await mkdir(dirname(DYNAMIC_SEED_MANIFEST_PATH), { recursive: true });

  const manifest: DynamicSeedManifest = {
    config: {
      ...manifestPopulationFields(args.config),
      anchorDate: args.config.anchorDate.toISOString(),
      bookingDensity: args.config.bookingDensity,
      coachActiveRate: args.config.coachActiveRate,
      coachFormerRate: args.config.coachFormerRate,
      coachPausedRate: args.config.coachPausedRate,
      exerciseHistory: args.config.exerciseHistory,
      historyEndDate: args.config.historyEndDate.toISOString(),
      historyMonths: args.config.historyMonths,
      historyStartDate: args.config.historyStartDate.toISOString(),
      mode: args.config.mode,
      pendingPaymentRate: args.config.pendingPaymentRate,
      seed: args.config.seed,
      sessionDensity: args.config.sessionDensity,
      splitPresetsPerMember: args.config.splitPresetsPerMember,
      target: args.config.target,
      users: args.config.users,
      workoutDensity: args.config.workoutDensity,
    },
    counts: args.counts,
    credentials: args.credentials,
    integrity: args.integrity,
    manifestPath: DYNAMIC_SEED_MANIFEST_PATH,
    modelCoverage: MODEL_COVERAGE,
    coverage: buildModelCoverageSummary(args.counts),
    notableIds: args.notableIds,
    roleCounts: args.roleCounts ?? args.integrity.roleCounts,
    scenarioCounts: args.scenarioCounts ?? args.integrity.scenarioCounts,
    runAt: new Date().toISOString(),
  };

  await writeFile(
    DYNAMIC_SEED_MANIFEST_PATH,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  return manifest;
}
