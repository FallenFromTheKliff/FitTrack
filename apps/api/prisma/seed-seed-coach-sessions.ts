import {
  AppointmentStatus,
  AuthProvider,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RelationshipStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { TEST_ACCOUNTS, seedId } from './test-data/constants';
import {
  COACH_SESSION_FIXTURE_SCENARIOS,
  coachSessionFixtureDate,
  coachSessionRelationshipId,
} from './coach-session-fixture';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function money(value: number | string) {
  return new Prisma.Decimal(value);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function fixedTime(value: string) {
  return new Date(`1970-01-01T${value}.000Z`);
}

async function userByEmail(email: string, expectedRole: UserRole) {
  const identity = await prisma.authIdentity.findFirst({
    where: { identifier: email, provider: AuthProvider.email },
    include: {
      user: {
        include: {
          coach_profile: true,
          membership_card: true,
          profile: true,
        },
      },
    },
  });

  if (!identity) {
    throw new Error(`Missing seeded account: ${email}`);
  }
  if (identity.user.role !== expectedRole) {
    throw new Error(`${email} must be ${expectedRole}, found ${identity.user.role}`);
  }

  return identity.user;
}

async function main() {
  const coachAccount = TEST_ACCOUNTS.find((account) => account.key === 'coach');
  if (!coachAccount) {
    throw new Error('Missing seed.coach account constant.');
  }

  const coachUser = await userByEmail(coachAccount.email, UserRole.coach);
  await prisma.user.update({
    where: { id: coachUser.id },
    data: { status: UserStatus.active },
  });

  const coachProfile = await prisma.coachProfile.upsert({
    where: { user_id: coachUser.id },
    update: {
      display_name: 'Ridge Coach',
      contact_email: coachAccount.email,
      contact_phone: coachAccount.phone,
      specialization: 'Conditioning, mobility, strength foundations',
      certification: 'NASM-CPT',
      hourly_rate: money(900),
      gym_commission_pct: money(20),
      is_available_for_booking: true,
    },
    create: {
      id: seedId('seed-coach-sessions:coach-profile'),
      user_id: coachUser.id,
      display_name: 'Ridge Coach',
      contact_email: coachAccount.email,
      contact_phone: coachAccount.phone,
      specialization: 'Conditioning, mobility, strength foundations',
      certification: 'NASM-CPT',
      hourly_rate: money(900),
      gym_commission_pct: money(20),
      average_rating: money('4.80'),
      rating_count: 1,
      is_available_for_booking: true,
    },
  });

  const slots = [
    { day: 1, start: '07:00:00', end: '11:00:00' },
    { day: 2, start: '07:00:00', end: '11:00:00' },
    { day: 3, start: '13:00:00', end: '17:00:00' },
    { day: 4, start: '16:00:00', end: '20:00:00' },
    { day: 5, start: '07:00:00', end: '11:00:00' },
    { day: 6, start: '09:00:00', end: '12:00:00' },
  ];

  for (const slot of slots) {
    await prisma.coachAvailabilitySlot.upsert({
      where: { id: seedId(`seed-coach-sessions:slot:${slot.day}:${slot.start}`) },
      update: {
        coach_id: coachProfile.id,
        day_of_week: slot.day,
        start_time: fixedTime(slot.start),
        end_time: fixedTime(slot.end),
        is_active: true,
      },
      create: {
        id: seedId(`seed-coach-sessions:slot:${slot.day}:${slot.start}`),
        coach_id: coachProfile.id,
        day_of_week: slot.day,
        start_time: fixedTime(slot.start),
        end_time: fixedTime(slot.end),
        is_active: true,
      },
    });
  }

  const members = await Promise.all([
    userByEmail('seed.member.active@fittrack.com', UserRole.member),
    userByEmail('seed.member.premium@fittrack.com', UserRole.member),
    userByEmail('seed.member.pending@fittrack.com', UserRole.member),
    userByEmail('seed.member.expired@fittrack.com', UserRole.member),
  ]);
  if (members.some((member) => !member.profile || !member.membership_card)) {
    throw new Error(
      'Ridge coach fixture members must have seeded profiles and membership cards.',
    );
  }
  const verifier = await userByEmail('seed.staff@fittrack.com', UserRole.staff);
  const fixtureAnchor = new Date();
  const relationshipStartedAt = new Date(fixtureAnchor);
  relationshipStartedAt.setUTCDate(relationshipStartedAt.getUTCDate() - 14);

  const seeds = [
    {
      ...COACH_SESSION_FIXTURE_SCENARIOS[0],
      member: members[0],
      notes: 'Completed demo session with member feedback visible.',
      coachFeedback: 'Great control today. Keep the same warm-up and progress the next conditioning block carefully.',
      assessmentReport: 'Assessment: better pacing, cleaner bracing, and improved movement confidence.',
      review: 'Coach Ridge gave clear cues and helped me understand the next steps.',
      rating: 5,
    },
    {
      ...COACH_SESSION_FIXTURE_SCENARIOS[1],
      member: members[1],
      notes: 'Completed demo session waiting for member feedback.',
      coachFeedback: 'Strong effort throughout the session. Next target is cleaner control under fatigue.',
      assessmentReport: 'Assessment: endurance is improving; keep recovery walks after strength days.',
    },
    {
      ...COACH_SESSION_FIXTURE_SCENARIOS[2],
      member: members[2],
      notes: 'Upcoming confirmed session for coach schedule demo.',
      coachFeedback: null,
      assessmentReport: null,
    },
    {
      ...COACH_SESSION_FIXTURE_SCENARIOS[3],
      member: members[3],
      notes: 'Coach accepted; waiting for member payment.',
      coachFeedback: null,
      assessmentReport: null,
    },
    {
      ...COACH_SESSION_FIXTURE_SCENARIOS[4],
      member: members[0],
      notes: 'New request waiting for coach approval.',
      coachFeedback: null,
      assessmentReport: null,
    },
    {
      ...COACH_SESSION_FIXTURE_SCENARIOS[5],
      member: members[1],
      notes: 'No-show session for status display.',
      coachFeedback: null,
      assessmentReport: 'No-show recorded for demo scheduling analytics.',
    },
  ];

  const totalAmount = money(900);
  const downpaymentAmount = money(450);
  const gymRevenue = money(180);
  const coachEarnings = money(720);

  for (const seed of seeds) {
    const appointmentId = seedId(`seed-coach-sessions:appointment:${seed.key}`);
    const scheduledAt = coachSessionFixtureDate(fixtureAnchor, seed);
    const existingActiveRelationship =
      await prisma.coachClientRelationship.findFirst({
        where: {
          coach_id: coachProfile.id,
          member_id: seed.member.id,
          status: RelationshipStatus.active,
        },
        orderBy: { created_at: 'asc' },
        select: { id: true },
      });
    const relationshipId = coachSessionRelationshipId(
      existingActiveRelationship?.id,
      seed.member.id,
    );
    const completed = seed.status === AppointmentStatus.completed;
    const paidEnough =
      seed.status === AppointmentStatus.completed ||
      seed.status === AppointmentStatus.confirmed ||
      seed.status === AppointmentStatus.no_show;

    await prisma.coachAppointment.upsert({
      where: { id: appointmentId },
      update: {
        user_id: seed.member.id,
        coach_id: coachProfile.id,
        status: seed.status,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        total_amount: totalAmount,
        downpayment_amount: downpaymentAmount,
        balance_amount: completed ? money(0) : downpaymentAmount,
        gym_revenue: completed ? gymRevenue : money(0),
        coach_earnings: completed ? coachEarnings : money(0),
        downpayment_paid_at: paidEnough ? scheduledAt : null,
        balance_paid_at: completed ? addMinutes(scheduledAt, 60) : null,
        completed_at: completed ? addMinutes(scheduledAt, 60) : null,
        no_show_at:
          seed.status === AppointmentStatus.no_show
            ? addMinutes(scheduledAt, 20)
            : null,
        member_notes: seed.notes,
        coach_feedback: seed.coachFeedback,
        assessment_report: seed.assessmentReport,
        session_notes: completed ? 'Seeded coach-visible demo session.' : null,
        cancelled_at: null,
        cancellation_reason: null,
      },
      create: {
        id: appointmentId,
        user_id: seed.member.id,
        coach_id: coachProfile.id,
        status: seed.status,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        total_amount: totalAmount,
        downpayment_amount: downpaymentAmount,
        balance_amount: completed ? money(0) : downpaymentAmount,
        gym_revenue: completed ? gymRevenue : money(0),
        coach_earnings: completed ? coachEarnings : money(0),
        downpayment_paid_at: paidEnough ? scheduledAt : null,
        balance_paid_at: completed ? addMinutes(scheduledAt, 60) : null,
        completed_at: completed ? addMinutes(scheduledAt, 60) : null,
        no_show_at:
          seed.status === AppointmentStatus.no_show
            ? addMinutes(scheduledAt, 20)
            : null,
        member_notes: seed.notes,
        coach_feedback: seed.coachFeedback,
        assessment_report: seed.assessmentReport,
        session_notes: completed ? 'Seeded coach-visible demo session.' : null,
      },
    });

    await prisma.coachClientRelationship.upsert({
      where: {
        id: relationshipId,
      },
      update: {
        coach_id: coachProfile.id,
        member_id: seed.member.id,
        status: RelationshipStatus.active,
        notes: 'Seeded relationship for coach session demo.',
      },
      create: {
        id: relationshipId,
        coach_id: coachProfile.id,
        member_id: seed.member.id,
        status: RelationshipStatus.active,
        started_at: relationshipStartedAt,
        notes: 'Seeded relationship for coach session demo.',
      },
    });

    if (paidEnough || seed.status === AppointmentStatus.pending_payment) {
      await prisma.payment.upsert({
        where: { id: seedId(`seed-coach-sessions:payment:${seed.key}`) },
        update: {
          user_id: seed.member.id,
          payable_type: 'coaching',
          payable_id: appointmentId,
          payment_stage: completed ? PaymentStage.full : PaymentStage.downpayment,
          amount: completed ? totalAmount : downpaymentAmount,
          provider: PaymentProvider.cash,
          idempotency_key: `seed-coach-sessions:${seed.key}`,
          status:
            seed.status === AppointmentStatus.pending_payment
              ? PaymentStatus.pending
              : PaymentStatus.completed,
          verified_by:
            seed.status === AppointmentStatus.pending_payment
              ? null
              : verifier.id,
          verified_at:
            seed.status === AppointmentStatus.pending_payment
              ? null
              : addMinutes(scheduledAt, 5),
        },
        create: {
          id: seedId(`seed-coach-sessions:payment:${seed.key}`),
          user_id: seed.member.id,
          payable_type: 'coaching',
          payable_id: appointmentId,
          payment_stage: completed ? PaymentStage.full : PaymentStage.downpayment,
          amount: completed ? totalAmount : downpaymentAmount,
          provider: PaymentProvider.cash,
          idempotency_key: `seed-coach-sessions:${seed.key}`,
          status:
            seed.status === AppointmentStatus.pending_payment
              ? PaymentStatus.pending
              : PaymentStatus.completed,
          verified_by:
            seed.status === AppointmentStatus.pending_payment
              ? null
              : verifier.id,
          verified_at:
            seed.status === AppointmentStatus.pending_payment
              ? null
              : addMinutes(scheduledAt, 5),
        },
      });
    }

    if (seed.review) {
      await prisma.coachReview.upsert({
        where: { appointment_id: appointmentId },
        update: {
          coach_id: coachProfile.id,
          reviewer_id: seed.member.id,
          rating: seed.rating ?? 5,
          comment: seed.review,
        },
        create: {
          id: seedId(`seed-coach-sessions:review:${seed.key}`),
          appointment_id: appointmentId,
          coach_id: coachProfile.id,
          reviewer_id: seed.member.id,
          rating: seed.rating ?? 5,
          comment: seed.review,
        },
      });
    }
  }

  const aggregate = await prisma.coachReview.aggregate({
    where: { coach_id: coachProfile.id },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.coachProfile.update({
    where: { id: coachProfile.id },
    data: {
      average_rating: money((aggregate._avg.rating ?? 4.8).toFixed(2)),
      rating_count: aggregate._count._all,
    },
  });

  const sessions = await prisma.coachAppointment.findMany({
    where: { coach_id: coachProfile.id },
    orderBy: { scheduled_at: 'desc' },
    select: {
      id: true,
      status: true,
      scheduled_at: true,
      user: {
        select: {
          profile: { select: { first_name: true, last_name: true } },
        },
      },
    },
    take: 10,
  });

  console.log(
    JSON.stringify(
      {
        coachAccount: coachAccount.email,
        coachProfileId: coachProfile.id,
        visibleSessionCount: sessions.length,
        sessions: sessions.map((session) => ({
          id: session.id,
          status: session.status,
          scheduledAt: session.scheduled_at.toISOString(),
          member: [session.user.profile?.first_name, session.user.profile?.last_name]
            .filter(Boolean)
            .join(' '),
        })),
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
