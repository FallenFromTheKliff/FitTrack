import {
  AppointmentStatus,
  AuthProvider,
  Prisma,
  PrismaClient,
  RelationshipStatus,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';
import { TEST_ACCOUNTS, seedId, type TestAccount } from './test-data/constants';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed coach feedback demos.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type DemoAccountKey =
  | 'coach-casey'
  | 'coach-ivy'
  | 'member-active'
  | 'member-premium';

type DemoUser = Awaited<ReturnType<typeof requireUserByAccountKey>>;
type DemoCoach = Awaited<ReturnType<typeof requireCoachByAccountKey>>;

type CompletedAppointmentSeed = {
  assessmentReport: string;
  coach: DemoCoach;
  coachFeedback: string;
  durationMinutes: number;
  key: string;
  member: DemoUser;
  memberNotes: string;
  scheduledAt: Date;
  sessionNotes: string;
  totalAmount: Prisma.Decimal;
};

function accountByKey(key: DemoAccountKey): TestAccount {
  const account = TEST_ACCOUNTS.find((candidate) => candidate.key === key);
  if (!account) {
    throw new Error(`Missing test account seed for key: ${key}`);
  }

  return account;
}

function phtDate(value: string) {
  return new Date(`${value}+08:00`);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function money(value: string) {
  return new Prisma.Decimal(value);
}

function fullName(user: DemoUser) {
  return [user.profile?.first_name, user.profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function requireUserByAccountKey(
  key: DemoAccountKey,
  expectedRole: UserRole,
) {
  const account = accountByKey(key);
  const identity = await prisma.authIdentity.findFirst({
    where: {
      identifier: account.email,
      provider: AuthProvider.email,
    },
    include: {
      user: {
        include: {
          coach_profile: true,
          profile: true,
        },
      },
    },
  });

  if (!identity) {
    throw new Error(
      `Run db:seed:live-credentials first; missing account ${account.email}.`,
    );
  }

  if (identity.user.role !== expectedRole) {
    throw new Error(
      `${account.email} must be a ${expectedRole} account, found ${identity.user.role}.`,
    );
  }

  return identity.user;
}

async function requireCoachByAccountKey(key: 'coach-casey' | 'coach-ivy') {
  const account = accountByKey(key);
  const user = await requireUserByAccountKey(key, UserRole.coach);
  const profile =
    user.coach_profile ??
    (await prisma.coachProfile.findFirst({
      where: { contact_email: account.email },
    }));

  if (!profile) {
    throw new Error(
      `Run db:seed:test:additive or db:repair:gym-operations first; missing coach profile for ${account.email}.`,
    );
  }

  return { account, profile, user };
}

async function ensureActiveRelationship(seed: {
  coach: DemoCoach;
  member: DemoUser;
  note: string;
}) {
  const existing = await prisma.coachClientRelationship.findFirst({
    where: {
      coach_id: seed.coach.profile.id,
      member_id: seed.member.id,
      status: { in: [RelationshipStatus.pending, RelationshipStatus.active] },
    },
    select: { id: true },
  });

  const data = {
    coach_id: seed.coach.profile.id,
    member_id: seed.member.id,
    notes: seed.note,
    started_at: phtDate('2026-05-18T08:00:00'),
    status: RelationshipStatus.active,
  };

  if (existing) {
    await prisma.coachClientRelationship.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.coachClientRelationship.create({
    data: {
      id: seedId(
        `coach-feedback-demo:relationship:${seed.coach.profile.id}:${seed.member.id}`,
      ),
      ...data,
    },
  });
}

async function upsertCompletedAppointment(seed: CompletedAppointmentSeed) {
  const completedAt = addMinutes(seed.scheduledAt, seed.durationMinutes);
  const gymRevenue = seed.totalAmount.mul(seed.coach.profile.gym_commission_pct).div(100);
  const coachEarnings = seed.totalAmount.sub(gymRevenue);

  return prisma.coachAppointment.upsert({
    where: { id: seedId(`coach-feedback-demo:appointment:${seed.key}`) },
    update: {
      assessment_report: seed.assessmentReport,
      balance_amount: money('0'),
      balance_paid_at: seed.scheduledAt,
      coach_earnings: coachEarnings,
      coach_feedback: seed.coachFeedback,
      coach_id: seed.coach.profile.id,
      completed_at: completedAt,
      downpayment_amount: seed.totalAmount,
      downpayment_paid_at: seed.scheduledAt,
      duration_minutes: seed.durationMinutes,
      gym_revenue: gymRevenue,
      member_notes: seed.memberNotes,
      scheduled_at: seed.scheduledAt,
      session_notes: seed.sessionNotes,
      status: AppointmentStatus.completed,
      total_amount: seed.totalAmount,
      user_id: seed.member.id,
    },
    create: {
      id: seedId(`coach-feedback-demo:appointment:${seed.key}`),
      assessment_report: seed.assessmentReport,
      balance_amount: money('0'),
      balance_paid_at: seed.scheduledAt,
      coach_earnings: coachEarnings,
      coach_feedback: seed.coachFeedback,
      coach_id: seed.coach.profile.id,
      completed_at: completedAt,
      downpayment_amount: seed.totalAmount,
      downpayment_paid_at: seed.scheduledAt,
      duration_minutes: seed.durationMinutes,
      gym_revenue: gymRevenue,
      member_notes: seed.memberNotes,
      scheduled_at: seed.scheduledAt,
      session_notes: seed.sessionNotes,
      status: AppointmentStatus.completed,
      total_amount: seed.totalAmount,
      user_id: seed.member.id,
    },
    include: {
      coach: true,
      review: true,
      user: { include: { profile: true } },
    },
  });
}

async function ensureReview(seed: {
  appointmentId: string;
  coach: DemoCoach;
  comment: string;
  member: DemoUser;
  rating: number;
}) {
  return prisma.coachReview.upsert({
    where: { appointment_id: seed.appointmentId },
    update: {
      coach_id: seed.coach.profile.id,
      comment: seed.comment,
      rating: seed.rating,
      reviewer_id: seed.member.id,
    },
    create: {
      id: seedId(`coach-feedback-demo:review:${seed.appointmentId}`),
      appointment_id: seed.appointmentId,
      coach_id: seed.coach.profile.id,
      comment: seed.comment,
      rating: seed.rating,
      reviewer_id: seed.member.id,
    },
  });
}

async function refreshCoachRating(coachId: string) {
  const aggregate = await prisma.coachReview.aggregate({
    _avg: { rating: true },
    _count: { _all: true },
    where: { coach_id: coachId },
  });

  await prisma.coachProfile.update({
    where: { id: coachId },
    data: {
      average_rating: money((aggregate._avg.rating ?? 0).toFixed(2)),
      rating_count: aggregate._count._all,
    },
  });
}

async function main() {
  const memberActive = await requireUserByAccountKey(
    'member-active',
    UserRole.member,
  );
  const memberPremium = await requireUserByAccountKey(
    'member-premium',
    UserRole.member,
  );
  const coachIvy = await requireCoachByAccountKey('coach-ivy');
  const coachCasey = await requireCoachByAccountKey('coach-casey');

  await ensureActiveRelationship({
    coach: coachIvy,
    member: memberActive,
    note: 'Demo relationship for member feedback and coach-visible session notes.',
  });
  await ensureActiveRelationship({
    coach: coachCasey,
    member: memberPremium,
    note: 'Demo relationship with an existing member review for the coach portal.',
  });

  const readySeeds: CompletedAppointmentSeed[] = [
    {
      assessmentReport:
        'Movement screen showed better hip control and steadier breathing cadence. Continue light mobility before loaded squats.',
      coach: coachIvy,
      coachFeedback:
        'Strong focus during the recovery block. Keep the slow nasal-breathing cadence and bring the same tempo into the next strength session.',
      durationMinutes: 50,
      key: 'ready:member-active:ivy:primary',
      member: memberActive,
      memberNotes: 'Feedback demo session waiting for member review.',
      scheduledAt: phtDate('2026-05-18T14:00:00'),
      sessionNotes:
        'Completed assisted mobility, core bracing checks, and cooldown breathing work.',
      totalAmount: money('780'),
    },
    {
      assessmentReport:
        'Second demo session kept as a fallback if the primary feedback slot has already been reviewed.',
      coach: coachIvy,
      coachFeedback:
        'Good control through the reset work. Next session should progress into balance drills before strength accessories.',
      durationMinutes: 45,
      key: 'ready:member-active:ivy:fallback',
      member: memberActive,
      memberNotes: 'Fallback feedback demo session waiting for member review.',
      scheduledAt: phtDate('2026-05-18T16:00:00'),
      sessionNotes: 'Completed mobility reset and breathing check.',
      totalAmount: money('780'),
    },
  ];

  const readyAppointments: Awaited<
    ReturnType<typeof upsertCompletedAppointment>
  >[] = [];
  for (const seed of readySeeds) {
    readyAppointments.push(await upsertCompletedAppointment(seed));
  }

  const alreadyReviewedAppointment = await upsertCompletedAppointment({
    assessmentReport:
      'Strength screen improved under load. Keep bracing before each rep and use the same warm-up structure next week.',
    coach: coachCasey,
    coachFeedback:
      'Excellent session pace. Your squat setup is cleaner now; continue bracing before descending and keep rests consistent.',
    durationMinutes: 60,
    key: 'reviewed:member-premium:casey',
    member: memberPremium,
    memberNotes: 'Reviewed demo session for coach feedback display.',
    scheduledAt: phtDate('2026-05-17T09:00:00'),
    sessionNotes:
      'Completed floor-first strength session, movement audit, and squat setup refinement.',
    totalAmount: money('850'),
  });

  await ensureReview({
    appointmentId: alreadyReviewedAppointment.id,
    coach: coachCasey,
    comment:
      'Coach Casey gave clear cues and helped me keep my form steady through the whole session.',
    member: memberPremium,
    rating: 5,
  });

  await refreshCoachRating(coachIvy.profile.id);
  await refreshCoachRating(coachCasey.profile.id);

  const readyForReview = readyAppointments.filter(
    (appointment) => !appointment.review,
  );

  console.log(
    JSON.stringify(
      {
        alreadyReviewed: {
          appointmentId: alreadyReviewedAppointment.id,
          coach: alreadyReviewedAppointment.coach.display_name,
          member: fullName(memberPremium),
          reviewVisibleToCoachAccount: coachCasey.account.email,
        },
        readyForMemberFeedback: readyForReview.map((appointment) => ({
          appointmentId: appointment.id,
          coach: appointment.coach.display_name,
          member: fullName(memberActive),
          memberAccount: accountByKey('member-active').email,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
