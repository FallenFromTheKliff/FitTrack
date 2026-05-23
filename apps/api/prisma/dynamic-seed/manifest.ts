import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type { DynamicSeedConfig, SeedCredential } from './types';

export const DYNAMIC_SEED_MANIFEST_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  '.artifacts',
  'dynamic-seed-manifest.json',
);

const MODEL_DELEGATES = [
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
  'amenity',
  'facilityFloorPlanMedia',
  'amenityBooking',
  'amenityFeedback',
  'coachProfile',
  'coachAppointment',
  'recurringCoachingPlan',
  'recurringCoachingBillingCycle',
  'coachReview',
  'coachAvailabilitySlot',
  'coachClientRelationship',
  'exerciseCatalog',
  'muscleDefinition',
  'exerciseReviewSubmission',
  'trainingPlan',
  'trainingScheduleDay',
  'planExercise',
  'workoutSession',
  'exerciseLog',
  'poseExerciseProfile',
  'poseSession',
  'muscleMasteryProgress',
  'progressionSourceEvent',
  'progressionGrantLedger',
  'userProgressionProfile',
  'seasonDefinition',
  'seasonalStanding',
  'milestoneDefinition',
  'userMilestoneProgress',
  'milestoneEvidenceSubmission',
  'rankingProfile',
  'integrityProfile',
  'integrityCase',
  'integrityEvent',
  'creatorProfile',
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
  'gymPromotion',
  'gymFaqEntry',
  'businessInsightRun',
] as const;

export type DynamicSeedManifest = {
  config: {
    anchorDate: string;
    mode: string;
    seed: number;
    target: string;
    users: number;
  };
  counts: Record<string, number>;
  credentials: SeedCredential[];
  manifestPath: string;
  notableIds: Record<string, string>;
  runAt: string;
};

export async function buildModelCounts(prisma: PrismaClient) {
  const counts: Record<string, number> = {};
  const delegateSource = prisma as unknown as Record<
    string,
    { count: () => Promise<number> } | undefined
  >;

  for (const delegateName of MODEL_DELEGATES) {
    const delegate = delegateSource[delegateName];
    if (delegate) {
      counts[delegateName] = await delegate.count();
    }
  }

  return counts;
}

export async function writeDynamicSeedManifest(args: {
  config: DynamicSeedConfig;
  counts: Record<string, number>;
  credentials: SeedCredential[];
  notableIds: Record<string, string>;
}) {
  await mkdir(dirname(DYNAMIC_SEED_MANIFEST_PATH), { recursive: true });

  const manifest: DynamicSeedManifest = {
    config: {
      anchorDate: args.config.anchorDate.toISOString(),
      mode: args.config.mode,
      seed: args.config.seed,
      target: args.config.target,
      users: args.config.users,
    },
    counts: args.counts,
    credentials: args.credentials,
    manifestPath: DYNAMIC_SEED_MANIFEST_PATH,
    notableIds: args.notableIds,
    runAt: new Date().toISOString(),
  };

  await writeFile(
    DYNAMIC_SEED_MANIFEST_PATH,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  return manifest;
}
