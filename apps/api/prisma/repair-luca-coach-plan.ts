import { randomUUID } from 'node:crypto';
import {
  AuthProvider,
  PlanSource,
  PrismaClient,
  RelationshipStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const LUCA_EMAIL = 'seed.member.premium@fittrack.com';
const SEED_COACH_EMAIL = 'seed.coach@fittrack.com';
const LUCA_PPL_TITLE = 'Active PPL Rest Split';
const mode = process.argv[2] ?? 'check';

if (mode !== 'check' && mode !== 'apply') {
  throw new Error('Usage: repair-luca-coach-plan.ts [check|apply]');
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to repair Luca's coach plan.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function loadState() {
  const [lucaIdentity, seedCoachIdentity] = await Promise.all([
    prisma.authIdentity.findFirst({
      where: {
        identifier: LUCA_EMAIL,
        provider: AuthProvider.email,
      },
      include: { user: true },
    }),
    prisma.authIdentity.findFirst({
      where: {
        identifier: SEED_COACH_EMAIL,
        provider: AuthProvider.email,
      },
      include: {
        user: {
          include: { coach_profile: true },
        },
      },
    }),
  ]);

  if (
    !lucaIdentity ||
    lucaIdentity.user.role !== UserRole.member ||
    lucaIdentity.user.status !== UserStatus.active
  ) {
    throw new Error('The active Luca demo member could not be found.');
  }

  if (
    !seedCoachIdentity ||
    seedCoachIdentity.user.role !== UserRole.coach ||
    seedCoachIdentity.user.status !== UserStatus.active ||
    !seedCoachIdentity.user.coach_profile
  ) {
    throw new Error('The active Seed Coach profile could not be found.');
  }

  const plans = await prisma.trainingPlan.findMany({
    where: {
      is_template: false,
      title: LUCA_PPL_TITLE,
      user_id: lucaIdentity.user.id,
    },
    orderBy: { updated_at: 'desc' },
    select: {
      coach_id: true,
      id: true,
      is_active: true,
      source: true,
    },
  });

  if (plans.length !== 1) {
    throw new Error(
      `Expected exactly one non-template Luca PPL plan, found ${plans.length}. Refusing to alter ambiguous data.`,
    );
  }

  const activeRelationships = await prisma.coachClientRelationship.findMany({
    where: {
      member_id: lucaIdentity.user.id,
      status: {
        in: [RelationshipStatus.active, RelationshipStatus.pending],
      },
    },
    orderBy: { updated_at: 'desc' },
    select: {
      coach_id: true,
      id: true,
      status: true,
    },
  });

  return {
    activeRelationships,
    luca: { id: lucaIdentity.user.id },
    plan: plans[0],
    seedCoach: {
      profileId: seedCoachIdentity.user.coach_profile.id,
      userId: seedCoachIdentity.user.id,
    },
  };
}

function isCorrect(state: Awaited<ReturnType<typeof loadState>>) {
  return (
    state.plan.coach_id === state.seedCoach.userId &&
    state.plan.is_active &&
    state.plan.source === PlanSource.coach_assigned &&
    state.activeRelationships.length === 1 &&
    state.activeRelationships[0].coach_id === state.seedCoach.profileId &&
    state.activeRelationships[0].status === RelationshipStatus.active
  );
}

function report(state: Awaited<ReturnType<typeof loadState>>, status: string) {
  console.log(
    JSON.stringify(
      {
        status,
        correct: isCorrect(state),
        plan: {
          coachId: state.plan.coach_id,
          id: state.plan.id,
          isActive: state.plan.is_active,
          source: state.plan.source,
        },
        activeRelationships: state.activeRelationships.map((relationship) => ({
          coachProfileId: relationship.coach_id,
          id: relationship.id,
          status: relationship.status,
        })),
      },
      null,
      2,
    ),
  );
}

async function applyRepair(state: Awaited<ReturnType<typeof loadState>>) {
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    // Convert the misplaced PPL record in place. That removes the AI-draft
    // classification without duplicating its schedule, completion history, or
    // exercise details.
    await transaction.trainingPlan.updateMany({
      where: {
        is_active: true,
        is_template: false,
        user_id: state.luca.id,
      },
      data: { is_active: false },
    });
    await transaction.trainingPlan.update({
      where: { id: state.plan.id },
      data: {
        coach_id: state.seedCoach.userId,
        is_active: true,
        source: PlanSource.coach_assigned,
      },
    });

    // Luca should have one current coach relationship. Preserve old history by
    // terminating any other active/pending relationship instead of deleting it.
    await transaction.coachClientRelationship.updateMany({
      where: {
        coach_id: { not: state.seedCoach.profileId },
        member_id: state.luca.id,
        status: {
          in: [RelationshipStatus.active, RelationshipStatus.pending],
        },
      },
      data: {
        ended_at: now,
        notes: 'Reassigned to Seed Coach for the local Luca demo.',
        status: RelationshipStatus.terminated,
      },
    });

    const seedCoachRelationships =
      await transaction.coachClientRelationship.findMany({
        where: {
          coach_id: state.seedCoach.profileId,
          member_id: state.luca.id,
        },
        orderBy: { updated_at: 'desc' },
      });
    const relationshipToActivate =
      seedCoachRelationships.find(
        (relationship) =>
          relationship.status === RelationshipStatus.active ||
          relationship.status === RelationshipStatus.pending,
      ) ?? seedCoachRelationships[0];

    if (relationshipToActivate) {
      await transaction.coachClientRelationship.update({
        where: { id: relationshipToActivate.id },
        data: {
          ended_at: null,
          notes: 'Active Seed Coach assignment for the local Luca demo.',
          started_at: relationshipToActivate.started_at ?? now,
          status: RelationshipStatus.active,
        },
      });
    } else {
      await transaction.coachClientRelationship.create({
        data: {
          coach_id: state.seedCoach.profileId,
          id: randomUUID(),
          member_id: state.luca.id,
          notes: 'Active Seed Coach assignment for the local Luca demo.',
          started_at: now,
          status: RelationshipStatus.active,
        },
      });
    }
  });
}

async function main() {
  const before = await loadState();
  if (mode === 'check') {
    report(before, 'CHECK');
    return;
  }

  if (!isCorrect(before)) {
    await applyRepair(before);
  }

  const after = await loadState();
  report(after, 'APPLIED');
  if (!isCorrect(after)) {
    throw new Error('Luca coach-plan repair did not reach its expected state.');
  }
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
