import { config } from 'dotenv';

import {
  AuthProvider,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { localEnvFilePath } from '../env-path';
import { TEST_ACCOUNTS, seedId } from './test-data/constants';
import { EXERCISE_REVIEW_SUBMISSION_SEEDS } from './test-data/exercise-review-submission-seeds';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to bootstrap exercise review submissions.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function analyticsAt(args: { daysAgo: number; hour: number }) {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - args.daysAgo);
  target.setUTCHours(args.hour, 0, 0, 0);
  return target;
}

async function main() {
  const creatorAccounts = TEST_ACCOUNTS.filter(
    (account) =>
      account.role === UserRole.member &&
      EXERCISE_REVIEW_SUBMISSION_SEEDS.some(
        (seed) => seed.creatorKey === account.key,
      ),
  );
  const identities = await prisma.authIdentity.findMany({
    where: {
      identifier: { in: creatorAccounts.map((account) => account.email) },
      provider: AuthProvider.email,
    },
    select: { identifier: true, user_id: true },
  });
  const userIdByAccountKey = new Map<string, string>();

  for (const account of creatorAccounts) {
    const identity = identities.find((item) => item.identifier === account.email);
    if (identity) userIdByAccountKey.set(account.key, identity.user_id);
  }

  if (userIdByAccountKey.size === 0) {
    throw new Error(
      'No seeded creator accounts were found. Seed members before bootstrapping exercise review submissions.',
    );
  }

  const bicepExercise = await prisma.exerciseCatalog.findFirst({
    where: { name: 'Dumbbell Bicep Curl' },
    select: { id: true },
  });

  for (const seed of EXERCISE_REVIEW_SUBMISSION_SEEDS) {
    const userId = userIdByAccountKey.get(seed.creatorKey);
    if (!userId) continue;

    await prisma.exerciseReviewSubmission.upsert({
      where: { id: seedId(`exercise-review:${seed.key}`) },
      update: {
        category: seed.category,
        created_at: analyticsAt({ daysAgo: seed.daysAgo, hour: seed.hour }),
        description: seed.description,
        evidence_bars: seed.evidenceBars as Prisma.InputJsonValue,
        hand_shape_profile: {
          exerciseRequirement:
            seed.category === ExerciseCategory.strength ? 'grip_optional' : 'none',
          targetLockGesture: 'rock_sign',
        } as Prisma.InputJsonValue,
        instructions: seed.instructions,
        match_hint: seed.matchHint ?? null,
        movement_profile: {
          movementType:
            seed.category === ExerciseCategory.balance ? 'static_hold' : 'dynamic_rep',
          rigSource: 'seeded_creator_capture',
          thresholds: { downAngle: 145, tolerance: 18, upAngle: 92 },
        } as Prisma.InputJsonValue,
        muscle_group: seed.muscleGroup,
        muscle_targets: seed.muscleTargets as Prisma.InputJsonValue,
        origin_label: seed.originLabel,
        pose_session_id: null,
        proposed_name: seed.proposedName,
        published_exercise_id:
          seed.status === ExerciseReviewSubmissionStatus.published
            ? bicepExercise?.id ?? null
            : null,
        queue_tag: seed.queueTag,
        reviewed_at:
          seed.status === ExerciseReviewSubmissionStatus.pending
            ? null
            : analyticsAt({ daysAgo: seed.reviewedDaysAgo ?? 1, hour: seed.hour }),
        review_notes: seed.reviewNotes ?? null,
        source_label: seed.sourceLabel,
        status: seed.status,
        summary: seed.summary,
        title: seed.title,
        trigger_label: seed.triggerLabel,
        user_id: userId,
      },
      create: {
        id: seedId(`exercise-review:${seed.key}`),
        category: seed.category,
        created_at: analyticsAt({ daysAgo: seed.daysAgo, hour: seed.hour }),
        description: seed.description,
        evidence_bars: seed.evidenceBars as Prisma.InputJsonValue,
        hand_shape_profile: {
          exerciseRequirement:
            seed.category === ExerciseCategory.strength ? 'grip_optional' : 'none',
          targetLockGesture: 'rock_sign',
        } as Prisma.InputJsonValue,
        instructions: seed.instructions,
        match_hint: seed.matchHint ?? null,
        movement_profile: {
          movementType:
            seed.category === ExerciseCategory.balance ? 'static_hold' : 'dynamic_rep',
          rigSource: 'seeded_creator_capture',
          thresholds: { downAngle: 145, tolerance: 18, upAngle: 92 },
        } as Prisma.InputJsonValue,
        muscle_group: seed.muscleGroup,
        muscle_targets: seed.muscleTargets as Prisma.InputJsonValue,
        origin_label: seed.originLabel,
        pose_session_id: null,
        proposed_name: seed.proposedName,
        published_exercise_id:
          seed.status === ExerciseReviewSubmissionStatus.published
            ? bicepExercise?.id ?? null
            : null,
        queue_tag: seed.queueTag,
        reviewed_at:
          seed.status === ExerciseReviewSubmissionStatus.pending
            ? null
            : analyticsAt({ daysAgo: seed.reviewedDaysAgo ?? 1, hour: seed.hour }),
        review_notes: seed.reviewNotes ?? null,
        source_label: seed.sourceLabel,
        status: seed.status,
        summary: seed.summary,
        title: seed.title,
        trigger_label: seed.triggerLabel,
        user_id: userId,
      },
    });
  }

  console.log(
    `[exercise-review] ensured ${EXERCISE_REVIEW_SUBMISSION_SEEDS.length} exercise review submissions`,
  );
}

main()
  .catch((error) => {
    console.error('[exercise-review] bootstrap failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
