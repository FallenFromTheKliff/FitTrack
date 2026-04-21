import { config } from 'dotenv';

import {
  ExerciseCategory,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { localEnvFilePath } from '../env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to bootstrap exercise review submissions.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const REVIEW_SUBMISSION_SEEDS = [
  {
    id: '4fca2a3e-2d6f-4d0b-b692-6df8f3f56501',
    title: 'Rotational press pattern',
    sourceLabel: 'submitted client',
    queueTag: 'needs match',
    summary: 'Client trace / detected unknown movement',
    proposedName: 'Standing rotational press',
    category: ExerciseCategory.strength,
    muscleGroup: 'shoulders',
    description:
      'Standing press pattern with torso rotation and controlled deceleration through the shoulder line.',
    instructions:
      'Brace the core, rotate through the torso, then press while keeping the shoulder stacked and the return controlled.',
    matchHint: 'landmine press',
    evidenceBars: [24, 38, 62, 34, 28, 18],
  },
  {
    id: '4fca2a3e-2d6f-4d0b-b692-6df8f3f56502',
    title: 'Band-resisted hinge pulse',
    sourceLabel: 'movement trace available',
    queueTag: 'reviewable',
    summary: 'Custom hinge variation recorded by mobile tracker',
    proposedName: 'Band-resisted hinge pulse',
    category: ExerciseCategory.strength,
    muscleGroup: 'glutes',
    description:
      'Short-range hinge pulses against elastic resistance with emphasis on glute lockout and posture control.',
    instructions:
      'Anchor the band securely, hinge with a neutral spine, then pulse through the top range without shrugging.',
    matchHint: 'banded good morning',
    evidenceBars: [18, 32, 51, 55, 36, 22],
  },
  {
    id: '4fca2a3e-2d6f-4d0b-b692-6df8f3f56503',
    title: 'Single-leg hold variation',
    sourceLabel: 'asymmetry surfaced',
    queueTag: 'edge case',
    summary: 'Balance-focused custom hold with unilateral stability bias',
    proposedName: 'Single-leg balance hold',
    category: ExerciseCategory.balance,
    muscleGroup: 'core',
    description:
      'Static single-leg hold that emphasizes hip control, trunk alignment, and slow corrective balance reactions.',
    instructions:
      'Keep the standing knee soft, square the hips, and hold the trunk upright while resisting sway.',
    matchHint: 'single-leg reach hold',
    evidenceBars: [14, 18, 43, 27, 21, 30],
  },
  {
    id: '4fca2a3e-2d6f-4d0b-b692-6df8f3f56504',
    title: 'Overhead cable chop',
    sourceLabel: 'compare against library',
    queueTag: 'compare',
    summary: 'Rotational cable movement with diagonal power pattern',
    proposedName: 'Overhead cable chop',
    category: ExerciseCategory.strength,
    muscleGroup: 'core',
    description:
      'Diagonal pull pattern that trains rotational force transfer from the trunk through the upper body.',
    instructions:
      'Set the shoulders down, drive through the torso, and finish the diagonal pull without collapsing the ribs.',
    matchHint: 'cable wood chop',
    evidenceBars: [22, 26, 58, 49, 30, 20],
  },
];

async function main() {
  const members = await prisma.user.findMany({
    where: { role: UserRole.member },
    orderBy: { created_at: 'asc' },
    take: REVIEW_SUBMISSION_SEEDS.length,
    select: { id: true },
  });

  if (!members.length) {
    throw new Error(
      'No member accounts were found. Seed members before bootstrapping exercise review submissions.',
    );
  }

  const poseSessions = await prisma.poseSession.findMany({
    where: {
      user_id: { in: members.map((member) => member.id) },
    },
    orderBy: { created_at: 'desc' },
    select: { id: true, user_id: true },
  });

  const poseSessionByUser = new Map<string, string>();
  for (const session of poseSessions) {
    if (!poseSessionByUser.has(session.user_id)) {
      poseSessionByUser.set(session.user_id, session.id);
    }
  }

  for (const [index, seed] of REVIEW_SUBMISSION_SEEDS.entries()) {
    const member = members[index % members.length];
    const poseSessionId = poseSessionByUser.get(member.id) ?? null;

    await prisma.exerciseReviewSubmission.upsert({
      where: { id: seed.id },
      update: {
        user_id: member.id,
        pose_session_id: poseSessionId,
        title: seed.title,
        source_label: seed.sourceLabel,
        queue_tag: seed.queueTag,
        summary: seed.summary,
        proposed_name: seed.proposedName,
        category: seed.category,
        muscle_group: seed.muscleGroup,
        description: seed.description,
        instructions: seed.instructions,
        match_hint: seed.matchHint,
        evidence_bars: seed.evidenceBars,
        status: 'pending',
        trigger_label: 'unknown after 3 reps',
        origin_label: 'client custom',
        published_exercise_id: null,
        review_notes: null,
        reviewed_at: null,
      },
      create: {
        id: seed.id,
        user_id: member.id,
        pose_session_id: poseSessionId,
        title: seed.title,
        source_label: seed.sourceLabel,
        queue_tag: seed.queueTag,
        summary: seed.summary,
        proposed_name: seed.proposedName,
        category: seed.category,
        muscle_group: seed.muscleGroup,
        description: seed.description,
        instructions: seed.instructions,
        match_hint: seed.matchHint,
        evidence_bars: seed.evidenceBars,
        status: 'pending',
        trigger_label: 'unknown after 3 reps',
        origin_label: 'client custom',
      },
    });
  }

  console.log(
    `[exercise-review] ensured ${REVIEW_SUBMISSION_SEEDS.length} exercise review submissions`,
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
