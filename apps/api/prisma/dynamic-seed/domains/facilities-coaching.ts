import {
  AppointmentStatus,
  BookingStatus,
  CoachScheduleType,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  EquipmentStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingSessionState,
  RelationshipStatus,
} from '@prisma/client';
import { seedExternalId, seedId } from '../ids';
import { daysFrom, fixedTime } from '../time';
import type { DynamicSeedContext } from '../types';
import {
  CANONICAL_AMENITIES,
  resolveCanonicalReferenceId,
} from '../../../../../packages/utils/fitness-catalog';
import {
  activityDateFor,
  futureDateFor,
  KeyedIntervalAllocator,
  memberAccessWindow,
  memberVolumeCount,
  bookingVolumeCount,
  isFormerCoachingMember,
  isMonthlyCoachingMember,
} from '../volumes';

const AMENITY_SEEDS = CANONICAL_AMENITIES;

type CheckoutHoldModel = {
  upsert(input: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<unknown>;
  update(input: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<unknown>;
};

type PaymentModel = {
  upsert(input: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Prisma.PaymentCreateManyInput;
  }): Promise<unknown>;
};

const COACH_SPECIALIZATIONS = [
  'Strength and Conditioning',
  'Mobility and Recovery',
  'Powerlifting Fundamentals',
  'Functional Fitness',
  'Body Recomposition',
  'Endurance Conditioning',
] as const;
const COACH_AVAILABILITY_PATTERNS: ReadonlyArray<{
  endTime: string;
  startTime: string;
  days: number[];
}> = [
  { days: [1, 2, 3, 4, 5], startTime: '06:00:00', endTime: '14:00:00' },
  { days: [1, 2, 3, 4, 5], startTime: '14:00:00', endTime: '22:00:00' },
  { days: [2, 3, 4, 5, 6], startTime: '08:00:00', endTime: '16:00:00' },
  { days: [1, 2, 3, 4, 5, 6], startTime: '16:00:00', endTime: '22:00:00' },
];

const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const DAY_MS = 24 * 60 * 60 * 1_000;

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function gymWallClock(value: Date) {
  return new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60_000);
}

function gymDateKey(value: Date) {
  return gymWallClock(value).toISOString().slice(0, 10);
}

function gymDateAt(value: Date, hour: number, minute = 0) {
  const wall = gymWallClock(value);
  wall.setUTCHours(hour, minute, 0, 0);
  return new Date(wall.getTime() - GYM_TIMEZONE_OFFSET_MINUTES * 60_000);
}

function shiftGymDate(value: Date, days: number) {
  const wall = gymWallClock(value);
  wall.setUTCDate(wall.getUTCDate() + days);
  return new Date(wall.getTime() - GYM_TIMEZONE_OFFSET_MINUTES * 60_000);
}

function gymMinutes(value: Date) {
  const wall = gymWallClock(value);
  return wall.getUTCHours() * 60 + wall.getUTCMinutes();
}

function clockMinutes(value: Date) {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function dateOnly(value: Date) {
  const wall = gymWallClock(value);
  wall.setUTCHours(0, 0, 0, 0);
  return new Date(wall.getTime() - GYM_TIMEZONE_OFFSET_MINUTES * 60_000);
}

function monthlyOfferForCoach(index: number, workload?: string) {
  if (workload === 'high') return { rate: 1_100, sessions: 12 };
  if (workload === 'low') return { rate: 700, sessions: 4 };
  return { rate: 900 + (index % 3) * 100, sessions: 8 };
}

function qualityRating(quality: string | undefined, index: number) {
  switch (quality) {
    case 'excellent':
      return 5;
    case 'good':
      return index % 3 === 0 ? 5 : 4;
    case 'average':
      return index % 2 === 0 ? 3 : 4;
    case 'poor':
      return index % 2 === 0 ? 1 : 2;
    default:
      return 4;
  }
}

function coachProfileIdFor(coachKey: string) {
  return seedId(`coach-profile:${coachKey}`);
}

async function seedAmenities(ctx: DynamicSeedContext) {
  for (const amenity of AMENITY_SEEDS) {
    const [gridColumn, gridRow, gridWidth, gridHeight] = amenity.grid;
    const desiredId = seedId(`amenity:${amenity.key}`);
    const existingById = await ctx.prisma.amenity.findUnique({
      where: { id: desiredId },
      select: { id: true },
    });
    const existingByName = await ctx.prisma.amenity.findFirst({
      where: { name: amenity.name },
      orderBy: { created_at: 'asc' },
      select: { id: true },
    });
    const resolvedId = resolveCanonicalReferenceId(
      desiredId,
      existingById,
      existingByName,
    );

    // Preserve an admin-created same-name row in additive mode. The rest of
    // this domain uses the actual resolved ID so bookings remain valid.
    const persisted =
      resolvedId !== desiredId
        ? existingByName!
        : existingById
          ? existingById
          : await ctx.prisma.amenity.create({
              data: {
                id: desiredId,
                capacity: amenity.capacity,
                description: amenity.description,
                display_order: amenity.displayOrder,
                floor_id: amenity.floorId,
                grid_column: gridColumn,
                grid_height: gridHeight,
                grid_row: gridRow,
                grid_width: gridWidth,
                hourly_rate: new Prisma.Decimal(amenity.hourlyRate),
                icon_key: amenity.iconKey,
                is_active: true,
                is_reservable: true,
                minimum_hours: amenity.minimumHours,
                name: amenity.name,
                requires_subscription: amenity.requiresSubscription,
                type: amenity.type,
              },
              select: { id: true },
            });

    if (persisted.id === desiredId) {
      await ctx.prisma.amenity.update({
        where: { id: desiredId },
        data: {
          capacity: amenity.capacity,
          description: amenity.description,
          display_order: amenity.displayOrder,
          floor_id: amenity.floorId,
          grid_column: gridColumn,
          grid_height: gridHeight,
          grid_row: gridRow,
          grid_width: gridWidth,
          hourly_rate: new Prisma.Decimal(amenity.hourlyRate),
          icon_key: amenity.iconKey,
          is_active: true,
          is_reservable: true,
          minimum_hours: amenity.minimumHours,
          name: amenity.name,
          requires_subscription: amenity.requiresSubscription,
          type: amenity.type,
        },
      });
    }
    ctx.state.amenityIds[amenity.key] = persisted.id;
  }

  for (const floorId of ['floor-1', 'floor-2', 'floor-3']) {
    await ctx.prisma.facilityFloorPlanMedia.upsert({
      where: { floor_id: floorId },
      update: {
        image_url: null,
      },
      create: {
        floor_id: floorId,
        image_url: null,
      },
    });
  }
}

async function seedCoachProfiles(ctx: DynamicSeedContext) {
  for (const [index, coachKey] of ctx.state.coachAccountKeys.entries()) {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === coachKey,
    );
    if (!account) continue;

    const userId = ctx.state.userIds[coachKey];
    const profileId = coachProfileIdFor(coachKey);
    const active = account.coachLifecycle === 'active';
    const offer = monthlyOfferForCoach(index, account.coachWorkload);
    ctx.state.coachProfileIds[coachKey] = profileId;
    const profileData = {
      average_rating: null,
      bio:
        index % 2 === 0
          ? 'Builds practical strength blocks, movement assessments, and member accountability systems.'
          : 'Focuses on mobility, conditioning, and sustainable return-to-training progressions.',
      certification:
        index % 2 === 0
          ? 'NASM-CPT, S&C Foundations'
          : 'ACE-CPT, Functional Training Specialist',
      contact_email: account.email,
      contact_phone: account.phone,
      display_name: `${account.firstName} ${account.lastName}`,
      gym_commission_pct: new Prisma.Decimal(20),
      hourly_rate: new Prisma.Decimal(450 + index * 20),
      is_available_for_booking: active,
      monthly_offer_active: active,
      monthly_offer_description: active
        ? 'A coach-led monthly plan scheduled around member and coach availability.'
        : null,
      monthly_rate: new Prisma.Decimal(offer.rate),
      monthly_session_count: offer.sessions,
      monthly_session_duration_minutes: 60,
      rating_count: 0,
      schedule_type:
        account.coachWorkload === 'high'
          ? CoachScheduleType.full_time
          : CoachScheduleType.part_time,
      specialization:
        COACH_SPECIALIZATIONS[index % COACH_SPECIALIZATIONS.length],
    };

    await ctx.prisma.coachProfile.upsert({
      where: { user_id: userId },
      update: profileData,
      create: { id: profileId, user_id: userId, ...profileData },
    });
  }

  const specialtyRows = COACH_SPECIALIZATIONS.map((label, index) => ({
    id: seedId(`coach-specialty:${index}`),
    normalized_label: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    display_label: label,
  }));
  for (const specialty of specialtyRows) {
    await ctx.prisma.coachSpecialty.upsert({
      where: { normalized_label: specialty.normalized_label },
      update: { display_label: specialty.display_label },
      create: specialty,
    });
  }
  await ctx.prisma.coachProfileSpecialty.createMany({
    data: ctx.state.coachAccountKeys.flatMap((coachKey, coachIndex) => {
      const firstSpecialty = specialtyRows[coachIndex % specialtyRows.length];
      const secondSpecialty =
        specialtyRows[(coachIndex + 1) % specialtyRows.length];
      return [firstSpecialty, secondSpecialty].map((specialty) => ({
        coach_profile_id: ctx.state.coachProfileIds[coachKey],
        specialty_id: specialty.id,
      }));
    }),
    skipDuplicates: true,
  });

  const availabilityRows = ctx.state.coachAccountKeys.flatMap(
    (coachKey, coachIndex) => {
      const account = ctx.state.accounts.find(
        (candidate) => candidate.key === coachKey,
      );
      if (account?.coachLifecycle !== 'active') return [];
      const pattern =
        COACH_AVAILABILITY_PATTERNS[
          coachIndex % COACH_AVAILABILITY_PATTERNS.length
        ];
      return pattern.days.map((dayOfWeek) => ({
        id: seedId(`coach-availability:${coachKey}:${dayOfWeek}`),
        coach_id: ctx.state.coachProfileIds[coachKey],
        day_of_week: dayOfWeek,
        end_time: fixedTime(pattern.endTime),
        is_active: true,
        start_time: fixedTime(pattern.startTime),
      }));
    },
  );

  // Additive runs can encounter slots left by an older scenario. Lifecycle is
  // authoritative: paused/former coaches must not retain active availability.
  const availabilityModel = ctx.prisma.coachAvailabilitySlot as unknown as {
    updateMany?: (input: {
      where: { coach_id: string };
      data: { is_active: boolean };
    }) => Promise<unknown>;
  };
  if (availabilityModel.updateMany) {
    for (const coachKey of ctx.state.coachAccountKeys) {
      const account = ctx.state.accounts.find(
        (candidate) => candidate.key === coachKey,
      );
      if (account?.coachLifecycle !== 'active') {
        await availabilityModel.updateMany({
          where: { coach_id: ctx.state.coachProfileIds[coachKey] },
          data: { is_active: false },
        });
      }
    }
  }

  await ctx.prisma.coachAvailabilitySlot.createMany({
    data: availabilityRows,
    skipDuplicates: true,
  });
}

async function seedRelationshipsPlansAndAppointments(ctx: DynamicSeedContext) {
  type CoachingPlanSeed = {
    account: (typeof ctx.state.accounts)[number];
    coachId: string;
    coachKey: string;
    durationMinutes: number;
    endDate: Date;
    memberId: string;
    memberKey: string;
    planId: string;
    planStart: Date;
    quotedAmount: Prisma.Decimal;
    sessionCount: number;
    status: RecurringCoachingPlanStatus;
  };

  const coachKeys = ctx.state.coachAccountKeys;
  const activeCoachKeys = coachKeys.filter(
    (key) =>
      ctx.state.accounts.find((account) => account.key === key)
        ?.coachLifecycle === 'active',
  );
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const holdRows: Prisma.CommerceCheckoutHoldCreateManyInput[] = [];
  const recurringPlanRows: Prisma.RecurringCoachingPlanCreateManyInput[] = [];
  const billingRows: Prisma.RecurringCoachingBillingCycleCreateManyInput[] = [];
  const appointmentRows: Prisma.CoachAppointmentCreateManyInput[] = [];
  const relationshipRows: Prisma.CoachClientRelationshipCreateManyInput[] = [];
  const reviewRows: Prisma.CoachReviewCreateManyInput[] = [];
  const plans: CoachingPlanSeed[] = [];
  const coachIntervals = new KeyedIntervalAllocator();
  let formerCoachCursor = 0;
  let historicalOneTimeCoachCursor = 0;
  let activeCoachCursor = 0;
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];
  const anchorDate = ctx.config.anchorDate;
  const maintenanceDay = gymDateKey(shiftGymDate(anchorDate, 14));
  const holidayDay = gymDateKey(shiftGymDate(anchorDate, 32));

  const coachPatternFor = (coachKey: string) => {
    const index = Math.max(0, coachKeys.indexOf(coachKey));
    return COACH_AVAILABILITY_PATTERNS[
      index % COACH_AVAILABILITY_PATTERNS.length
    ];
  };
  const preferredCoachHour = (coachKey: string) => {
    const pattern = coachPatternFor(coachKey);
    const startHour = Number(pattern.startTime.slice(0, 2));
    const endHour = Number(pattern.endTime.slice(0, 2));
    return Math.min(
      endHour - 1,
      startHour + Math.max(1, Math.floor((endHour - startHour) / 2)),
    );
  };
  const gymHoursFor = (day: number) =>
    day === 0
      ? { start: 8 * 60, end: 18 * 60 }
      : { start: 6 * 60, end: 22 * 60 };
  const isWithinGymHours = (start: Date, end: Date) => {
    const startWall = gymWallClock(start);
    if (gymDateKey(start) !== gymDateKey(end)) return false;
    const dateKey = gymDateKey(start);
    if (dateKey === maintenanceDay || dateKey === holidayDay) return false;
    const hours = gymHoursFor(startWall.getUTCDay());
    const startMinutes = gymMinutes(start);
    const endMinutes = gymMinutes(end);
    return startMinutes >= hours.start && endMinutes <= hours.end;
  };
  const hasCoachAvailability = (coachKey: string, start: Date, end: Date) => {
    const pattern = coachPatternFor(coachKey);
    const wall = gymWallClock(start);
    const endMinutes = gymMinutes(end);
    const startMinutes = gymMinutes(start);
    return (
      pattern.days.includes(wall.getUTCDay()) &&
      startMinutes >= clockMinutes(fixedTime(pattern.startTime)) &&
      endMinutes <= clockMinutes(fixedTime(pattern.endTime))
    );
  };
  const resolveAppointmentTime = (
    base: Date,
    coachKey: string,
    historical: boolean,
    memberId: string,
    durationMinutes: number,
    latestAllowed: Date,
  ) => {
    const preferredHour = preferredCoachHour(coachKey);
    for (let shift = 0; shift < 160; shift += 1) {
      const candidate = gymDateAt(shiftGymDate(base, shift), preferredHour);
      const end = new Date(candidate.getTime() + durationMinutes * 60_000);
      if (historical ? candidate >= anchorDate : candidate < anchorDate) {
        continue;
      }
      if (historical && candidate < addDays(anchorDate, -730)) continue;
      if (end > latestAllowed) continue;
      if (!isWithinGymHours(candidate, end)) continue;
      if (!hasCoachAvailability(coachKey, candidate, end)) continue;
      if (
        !coachIntervals.tryAllocateMany(
          [
            `coach:${ctx.state.coachProfileIds[coachKey]}`,
            `member:${memberId}`,
          ],
          candidate,
          end,
        )
      ) {
        continue;
      }
      return { end, start: candidate };
    }
    return null;
  };
  const splitAmount = (total: Prisma.Decimal, count: number, index: number) => {
    const cents = Math.round(Number(total) * 100);
    const base = Math.floor(cents / count);
    const remainder = cents - base * count;
    return new Prisma.Decimal(
      ((base + (index < remainder ? 1 : 0)) / 100).toFixed(2),
    );
  };
  const activeOrHistoricalMember = (memberKey: string) =>
    ctx.state.activeMemberKeys.includes(memberKey) ||
    ctx.state.historicalMemberKeys.includes(memberKey);

  for (const [index, memberKey] of memberKeys.entries()) {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === memberKey,
    );
    if (!account || !activeOrHistoricalMember(memberKey)) continue;
    const isOneTime = account.coachingProfile === 'one_time';
    const isRecurringActive = isMonthlyCoachingMember(ctx, memberKey);
    const isRecurringFormer = isFormerCoachingMember(ctx, memberKey);
    if (!isOneTime && !isRecurringActive && !isRecurringFormer) continue;

    const accessWindow = memberAccessWindow(ctx, memberKey);
    const historicalOnly = isRecurringFormer || accessWindow.historicalOnly;
    const coachKey =
      memberKey === 'member-active' || memberKey === 'member-premium'
        ? 'coach'
        : isRecurringFormer
          ? coachKeys[formerCoachCursor++ % Math.max(1, coachKeys.length)]
          : historicalOnly
            ? coachKeys[
                historicalOneTimeCoachCursor++ % Math.max(1, coachKeys.length)
              ]
            : activeCoachKeys[
                activeCoachCursor++ % Math.max(1, activeCoachKeys.length)
              ];
    if (!coachKey) continue;
    const coachId = ctx.state.coachProfileIds[coachKey];
    const memberId = ctx.state.userIds[memberKey];
    if (!coachId || !memberId) continue;
    const coachAccount = ctx.state.accounts.find(
      (candidate) => candidate.key === coachKey,
    );
    const offer = monthlyOfferForCoach(index, coachAccount?.coachWorkload);
    const recurring = isRecurringActive || isRecurringFormer;
    const durationMinutes = recurring ? 60 : 60;
    const planStart = recurring
      ? dateOnly(
          isRecurringFormer
            ? (accessWindow.startsAt ?? addDays(anchorDate, -180))
            : shiftGymDate(anchorDate, -14),
        )
      : null;
    const defaultEnd = isRecurringFormer
      ? addDays(anchorDate, -1)
      : addDays(anchorDate, 29);
    const rawEnd = recurring
      ? isRecurringFormer
        ? (accessWindow.expiresAt ?? defaultEnd)
        : (accessWindow.expiresAt ?? defaultEnd)
      : null;
    const planEnd = recurring
      ? dateOnly(
          rawEnd && rawEnd < anchorDate
            ? rawEnd
            : isRecurringFormer
              ? defaultEnd
              : rawEnd && rawEnd > addDays(anchorDate, 29)
                ? defaultEnd
                : (rawEnd ?? defaultEnd),
        )
      : null;
    if (recurring && (!planStart || !planEnd || planEnd <= planStart)) continue;
    const requestedCount = recurring
      ? Math.min(
          offer.sessions,
          Math.max(
            2,
            memberVolumeCount(
              ctx,
              memberKey,
              'appointments',
              ctx.config.sessionDensity,
            ),
          ),
        )
      : 1;
    const planId = seedId(`recurring-plan:${memberKey}`);
    const quotedAmount = new Prisma.Decimal(recurring ? offer.rate : 0);
    const relationshipStatus = recurring
      ? isRecurringFormer
        ? RelationshipStatus.terminated
        : RelationshipStatus.active
      : null;
    const relationshipStart = recurring
      ? planStart!
      : (accessWindow.startsAt ?? addDays(anchorDate, -14));
    const relationshipEnd =
      relationshipStatus === RelationshipStatus.terminated
        ? gymDateAt(planEnd!, 23, 59)
        : null;

    if (relationshipStatus) {
      relationshipRows.push({
        id: seedId(`coach-relationship:${coachKey}:${memberKey}`),
        coach_id: coachId,
        created_at: relationshipStart,
        ended_at: relationshipEnd,
        member_id: memberId,
        notes:
          relationshipStatus === RelationshipStatus.active
            ? 'Active relationship created by a paid recurring coaching enrollment.'
            : 'Terminated relationship retained for historical coaching records.',
        started_at: relationshipStart,
        status: relationshipStatus,
      });
    }

    if (recurring) {
      const plan: CoachingPlanSeed = {
        account,
        coachId,
        coachKey,
        durationMinutes,
        endDate: planEnd!,
        memberId,
        memberKey,
        planId,
        planStart: planStart!,
        quotedAmount,
        sessionCount: requestedCount,
        status: isRecurringFormer
          ? RecurringCoachingPlanStatus.completed
          : RecurringCoachingPlanStatus.active,
      };
      plans.push(plan);
      recurringPlanRows.push({
        id: planId,
        coach_id: coachId,
        completed_sessions: 0,
        created_by: adminId,
        duration_minutes: durationMinutes,
        end_date: plan.endDate,
        frequency: RecurringCoachingFrequency.monthly,
        member_id: memberId,
        preferred_days: [1 + (index % 5), 3 + (index % 3)],
        preferred_time: fixedTime(
          `${String(preferredCoachHour(coachKey)).padStart(2, '0')}:00:00`,
        ),
        quoted_amount: quotedAmount,
        start_date: plan.planStart,
        status: plan.status,
        total_sessions: requestedCount,
        coach_approved_at: relationshipStart,
      });
    }

    const appointmentCount = requestedCount;
    const historicalCount = recurring
      ? isRecurringFormer
        ? appointmentCount
        : Math.max(1, Math.floor(appointmentCount * 0.65))
      : accessWindow.historicalOnly || !accessWindow.hasAccess
        ? 1
        : 0;
    for (
      let appointmentIndex = 0;
      appointmentIndex < appointmentCount;
      appointmentIndex += 1
    ) {
      const historical = appointmentIndex < historicalCount;
      const base = historical
        ? (activityDateFor(
            ctx,
            memberKey,
            appointmentIndex,
            appointmentCount,
            9,
          ) ?? addDays(anchorDate, -30 - appointmentIndex * 7))
        : (futureDateFor(ctx, memberKey, appointmentIndex, 9) ??
          addDays(anchorDate, 2 + appointmentIndex * 3));
      const earliestAllowed = recurring
        ? gymDateAt(planStart!, 6)
        : (accessWindow.activityStart ?? addDays(anchorDate, -730));
      const currentCycleEnd =
        recurring && isRecurringActive
          ? gymDateAt(shiftGymDate(planStart!, 29), 21)
          : null;
      const latestAppointmentAt = recurring
        ? historical
          ? gymDateAt(planEnd!, 21)
          : currentCycleEnd && currentCycleEnd < gymDateAt(planEnd!, 21)
            ? currentCycleEnd
            : gymDateAt(planEnd!, 21)
        : historical
          ? (accessWindow.activityEnd ?? addDays(anchorDate, -1))
          : (accessWindow.expiresAt ?? addDays(anchorDate, 45));
      // Completed coaching must remain inside the member's actual activity
      // window.  A coach's preferred wall-clock hour can otherwise push an
      // appointment beyond an account whose access ends earlier that day,
      // which would create an invalid completed workout during reconciliation.
      const lifecycleBoundedLatestAppointmentAt =
        historical && accessWindow.activityEnd
          ? new Date(
              Math.min(
                latestAppointmentAt.getTime(),
                accessWindow.activityEnd.getTime(),
              ),
            )
          : latestAppointmentAt;
      const normalizedBase =
        base < earliestAllowed
          ? earliestAllowed
          : base > lifecycleBoundedLatestAppointmentAt
            ? recurring && !historical
              ? anchorDate
              : shiftGymDate(lifecycleBoundedLatestAppointmentAt, -1)
            : base;
      const latestAllowed = lifecycleBoundedLatestAppointmentAt;
      const allocated = resolveAppointmentTime(
        normalizedBase,
        coachKey,
        historical,
        memberId,
        durationMinutes,
        latestAllowed,
      );
      if (!allocated) continue;
      const qaFeedbackAppointment =
        memberKey === 'member-premium' && appointmentIndex === 1;
      const status = historical
        ? qaFeedbackAppointment
          ? AppointmentStatus.completed
          : appointmentIndex % 8 === 0
            ? AppointmentStatus.no_show
            : appointmentIndex % 5 === 0
              ? AppointmentStatus.cancelled
              : AppointmentStatus.completed
        : AppointmentStatus.confirmed;
      const appointmentId = seedId(
        `coach-appointment:${memberKey}:${appointmentIndex}`,
      );
      const totalAmount = recurring
        ? splitAmount(quotedAmount, appointmentCount, appointmentIndex)
        : new Prisma.Decimal(
            (450 + Math.max(0, coachKeys.indexOf(coachKey)) * 20).toFixed(2),
          );
      const paidAt = historical
        ? new Date(
            Math.max(
              allocated.start.getTime() - 2 * DAY_MS,
              relationshipStart.getTime(),
            ),
          )
        : daysFrom(anchorDate, -2, 10);
      const terminalAt =
        status === AppointmentStatus.completed
          ? new Date(allocated.end.getTime() + 5 * 60_000)
          : status === AppointmentStatus.no_show
            ? allocated.end
            : status === AppointmentStatus.cancelled
              ? new Date(allocated.start.getTime() - DAY_MS)
              : null;
      appointmentRows.push({
        id: appointmentId,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Assessment: improved hinge pattern and session adherence.'
            : null,
        balance_amount: new Prisma.Decimal(0),
        balance_paid_at: paidAt,
        coach_earnings: totalAmount.mul(new Prisma.Decimal('0.80')),
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member completed the prescribed block with strong pacing.'
            : null,
        coach_id: coachId,
        cancelled_at:
          status === AppointmentStatus.cancelled ? terminalAt : null,
        completed_at:
          status === AppointmentStatus.completed ? terminalAt : null,
        downpayment_amount: new Prisma.Decimal(0),
        downpayment_paid_at: null,
        duration_minutes: durationMinutes,
        gym_revenue: totalAmount.mul(new Prisma.Decimal('0.20')),
        is_free_session: false,
        member_notes:
          appointmentIndex === 1
            ? 'Wants extra shoulder mobility work.'
            : 'Member note for coach detail review.',
        no_show_at: status === AppointmentStatus.no_show ? terminalAt : null,
        recurring_plan_id: recurring ? planId : null,
        recurring_schedule_item_id: null,
        recurring_state: recurring
          ? status === AppointmentStatus.completed
            ? RecurringCoachingSessionState.completed
            : status === AppointmentStatus.cancelled ||
                status === AppointmentStatus.no_show
              ? RecurringCoachingSessionState.skipped
              : RecurringCoachingSessionState.generated
          : null,
        scheduled_at: allocated.start,
        session_notes:
          status === AppointmentStatus.completed
            ? 'Finished warm-up, main lift, and cooldown.'
            : null,
        status,
        total_amount: totalAmount,
        user_id: memberId,
        created_at: new Date(paidAt.getTime() - 60 * 60_000),
      });

      const holdId = seedId(
        `commerce-hold:coach:${memberKey}:${appointmentIndex}`,
      );
      const paymentId = seedId(
        `payment:commerce-hold:coach:${memberKey}:${appointmentIndex}`,
      );
      if (!recurring) {
        holdRows.push({
          id: holdId,
          user_id: memberId,
          coach_id: coachId,
          amenity_id: null,
          kind: CommerceCheckoutHoldKind.one_time,
          status: CommerceCheckoutHoldStatus.consumed,
          idempotency_key: seedExternalId(
            `commerce-hold:coach:${memberKey}:${appointmentIndex}`,
          ),
          payment_id: null,
          scheduled_at: allocated.start,
          ends_at: allocated.end,
          duration_minutes: durationMinutes,
          amount: totalAmount,
          currency: 'PHP',
          session_count: null,
          start_date: null,
          end_date: null,
          preferred_days: [],
          preferred_time: null,
          member_notes: 'Successful one-time coaching checkout.',
          expires_at: new Date(paidAt.getTime() + DAY_MS),
          consumed_at: paidAt,
          released_at: null,
          failure_reason: null,
          appointment_id: appointmentId,
          booking_id: null,
          subscription_id: null,
          membership_card_id: null,
          recurring_plan_id: null,
          membership_plan_id: null,
          created_at: new Date(paidAt.getTime() - 2 * 60 * 60_000),
        });
        paymentRows.push({
          id: paymentId,
          amount: totalAmount,
          currency: 'PHP',
          created_at: new Date(paidAt.getTime() - 60 * 60_000),
          gateway_event_id: seedExternalId(`gateway:${paymentId}`),
          gateway_metadata: {
            appointment_id: appointmentId,
            checkout_transition: 'succeeded',
            coaching_checkout_hold_id: holdId,
            hold_id: holdId,
            kind: CommerceCheckoutHoldKind.one_time,
            payment_id: paymentId,
            provider: PaymentProvider.paymongo,
            source: 'dynamic-seed',
          },
          idempotency_key: seedExternalId(
            `payment:commerce-hold:coach:${memberKey}:${appointmentIndex}`,
          ),
          payable_id: holdId,
          payable_type: PayableType.commerce_checkout_hold,
          payment_stage: PaymentStage.full,
          provider: PaymentProvider.paymongo,
          provider_ref: seedExternalId(
            `paymongo:commerce-hold:coach:${memberKey}:${appointmentIndex}`,
          ),
          status: PaymentStatus.completed,
          user_id: memberId,
          verified_at: paidAt,
          verified_by: null,
        });
      }
    }
  }

  // The monthly checkout creates the plan and its first paid billing cycle
  // through one consumed hold. Later cycles use the recurring-coaching
  // payable, matching PaymentRepository#createPaidCommerceProduct.
  for (const plan of plans) {
    const firstCyclePaymentId = seedId(
      `payment:commerce-hold:monthly:${plan.memberKey}`,
    );
    const firstHoldId = seedId(`commerce-hold:monthly:${plan.memberKey}`);
    const firstPaidAt =
      plan.status === RecurringCoachingPlanStatus.active
        ? daysFrom(anchorDate, -2, 10)
        : gymDateAt(plan.planStart, 11);
    holdRows.push({
      id: firstHoldId,
      user_id: plan.memberId,
      coach_id: plan.coachId,
      amenity_id: null,
      kind: CommerceCheckoutHoldKind.monthly,
      status: CommerceCheckoutHoldStatus.consumed,
      idempotency_key: seedExternalId(
        `commerce-hold:monthly:${plan.memberKey}`,
      ),
      payment_id: null,
      scheduled_at: null,
      ends_at: null,
      duration_minutes: plan.durationMinutes,
      amount: plan.quotedAmount,
      currency: 'PHP',
      session_count: plan.sessionCount,
      start_date: plan.planStart,
      end_date: plan.endDate,
      preferred_days: [1, 3],
      preferred_time: fixedTime('10:00:00'),
      member_notes: 'Successful monthly coaching checkout.',
      expires_at: new Date(firstPaidAt.getTime() + DAY_MS),
      consumed_at: firstPaidAt,
      released_at: null,
      failure_reason: null,
      appointment_id: null,
      booking_id: null,
      subscription_id: null,
      membership_card_id: null,
      recurring_plan_id: plan.planId,
      membership_plan_id: null,
      created_at: new Date(firstPaidAt.getTime() - 2 * 60 * 60_000),
    });
    paymentRows.push({
      id: firstCyclePaymentId,
      amount: plan.quotedAmount,
      currency: 'PHP',
      created_at: new Date(firstPaidAt.getTime() - 60 * 60_000),
      gateway_event_id: seedExternalId(`gateway:${firstCyclePaymentId}`),
      gateway_metadata: {
        checkout_transition: 'succeeded',
        coaching_checkout_hold_id: firstHoldId,
        hold_id: firstHoldId,
        kind: CommerceCheckoutHoldKind.monthly,
        payment_id: firstCyclePaymentId,
        provider: PaymentProvider.paymongo,
        recurring_plan_id: plan.planId,
        source: 'dynamic-seed',
      },
      idempotency_key: seedExternalId(
        `payment:commerce-hold:monthly:${plan.memberKey}`,
      ),
      payable_id: firstHoldId,
      payable_type: PayableType.commerce_checkout_hold,
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.paymongo,
      provider_ref: seedExternalId(
        `paymongo:commerce-hold:monthly:${plan.memberKey}`,
      ),
      status: PaymentStatus.completed,
      user_id: plan.memberId,
      verified_at: firstPaidAt,
      verified_by: null,
    });

    const cycleStart = plan.planStart;
    const cycleEnd = dateOnly(
      new Date(
        Math.min(
          shiftGymDate(cycleStart, 29).getTime(),
          plan.endDate.getTime(),
        ),
      ),
    );
    billingRows.push({
      id: seedId(`recurring-cycle:${plan.memberKey}:0`),
      amount: plan.quotedAmount,
      cycle_end_date: cycleEnd,
      cycle_start_date: cycleStart,
      due_date: cycleStart,
      grace_period_ends_at: new Date(firstPaidAt.getTime() + 7 * DAY_MS),
      paid_at: firstPaidAt,
      payment_id: firstCyclePaymentId,
      recurring_plan_id: plan.planId,
      status: RecurringCoachingBillingCycleStatus.paid,
    });
    let cycleIndex = 1;
    let nextStart = dateOnly(shiftGymDate(cycleStart, 30));
    while (
      nextStart < plan.endDate &&
      (plan.status !== RecurringCoachingPlanStatus.active ||
        nextStart < anchorDate)
    ) {
      const nextEnd = dateOnly(
        new Date(
          Math.min(
            shiftGymDate(nextStart, 29).getTime(),
            plan.endDate.getTime(),
          ),
        ),
      );
      const cyclePaymentId = seedId(
        `payment:recurring-coaching:${plan.memberKey}:${cycleIndex}`,
      );
      const cyclePaidAt = gymDateAt(nextStart, 11);
      billingRows.push({
        id: seedId(`recurring-cycle:${plan.memberKey}:${cycleIndex}`),
        amount: plan.quotedAmount,
        cycle_end_date: nextEnd,
        cycle_start_date: nextStart,
        due_date: nextStart,
        grace_period_ends_at: new Date(cyclePaidAt.getTime() + 7 * DAY_MS),
        paid_at: cyclePaidAt,
        payment_id: cyclePaymentId,
        recurring_plan_id: plan.planId,
        status: RecurringCoachingBillingCycleStatus.paid,
      });
      paymentRows.push({
        id: cyclePaymentId,
        amount: plan.quotedAmount,
        currency: 'PHP',
        created_at: new Date(cyclePaidAt.getTime() - 60 * 60_000),
        gateway_event_id: seedExternalId(`gateway:${cyclePaymentId}`),
        gateway_metadata: {
          cycle_id: seedId(`recurring-cycle:${plan.memberKey}:${cycleIndex}`),
          payment_id: cyclePaymentId,
          provider: PaymentProvider.paymongo,
          recurring_plan_id: plan.planId,
          source: 'recurring-coaching',
        },
        idempotency_key: seedExternalId(
          `payment:recurring-coaching:${plan.memberKey}:${cycleIndex}`,
        ),
        payable_id: seedId(`recurring-cycle:${plan.memberKey}:${cycleIndex}`),
        payable_type: PayableType.recurring_coaching,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.paymongo,
        provider_ref: seedExternalId(
          `paymongo:recurring-coaching:${plan.memberKey}:${cycleIndex}`,
        ),
        status: PaymentStatus.completed,
        user_id: plan.memberId,
        verified_at: cyclePaidAt,
        verified_by: null,
      });
      cycleIndex += 1;
      nextStart = dateOnly(shiftGymDate(nextStart, 30));
    }
  }

  await ctx.prisma.coachClientRelationship.createMany({
    data: relationshipRows,
    skipDuplicates: true,
  });
  await ctx.prisma.recurringCoachingPlan.createMany({
    data: recurringPlanRows,
    skipDuplicates: true,
  });

  const holdModel = ctx.prisma
    .commerceCheckoutHold as unknown as CheckoutHoldModel;
  for (const row of holdRows) {
    const update = { ...row };
    delete update.id;
    await holdModel.upsert({
      where: { id: row.id as string },
      update: update as Record<string, unknown>,
      create: row as Record<string, unknown>,
    });
  }
  await ctx.prisma.payment.createMany({
    data: paymentRows,
    skipDuplicates: true,
  });
  await ctx.prisma.recurringCoachingBillingCycle.createMany({
    data: billingRows,
    skipDuplicates: true,
  });
  await ctx.prisma.coachAppointment.createMany({
    data: appointmentRows,
    skipDuplicates: true,
  });
  for (const row of holdRows) {
    const payment = paymentRows.find((candidate) => {
      if (candidate.payable_id !== row.id) return false;
      return candidate.payable_type === PayableType.commerce_checkout_hold;
    });
    if (payment) {
      await holdModel.update({
        where: { id: row.id as string },
        data: {
          payment_id: payment.id,
        },
      });
    }
  }

  const appointmentsByPlan = new Map<string, number>();
  const completedByPlan = new Map<string, number>();
  for (const appointment of appointmentRows) {
    const planId = appointment.recurring_plan_id as string | null;
    if (!planId) continue;
    appointmentsByPlan.set(planId, (appointmentsByPlan.get(planId) ?? 0) + 1);
    if (appointment.status === AppointmentStatus.completed) {
      completedByPlan.set(planId, (completedByPlan.get(planId) ?? 0) + 1);
    }
  }
  await Promise.all(
    recurringPlanRows.map((plan) =>
      ctx.prisma.recurringCoachingPlan.update({
        where: { id: plan.id as string },
        data: {
          completed_sessions: completedByPlan.get(plan.id as string) ?? 0,
          total_sessions: appointmentsByPlan.get(plan.id as string) ?? 0,
        },
      }),
    ),
  );

  const completedAppointments = appointmentRows.filter(
    (appointment) => appointment.status === AppointmentStatus.completed,
  );
  const newActiveCoachKey = coachKeys.find((coachKey) => {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === coachKey,
    );
    return (
      account?.coachLifecycle === 'active' &&
      !account.pinned &&
      account.coachQuality !== 'excellent'
    );
  });
  for (const [coachIndex, coachKey] of coachKeys.entries()) {
    const coachId = ctx.state.coachProfileIds[coachKey];
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === coachKey,
    );
    const maxReviews =
      coachKey === newActiveCoachKey
        ? 0
        : account?.coachWorkload === 'high'
          ? 12
          : account?.coachWorkload === 'low'
            ? 2
            : 6;
    const coachAppointments = completedAppointments.filter(
      (appointment) => appointment.coach_id === coachId,
    );
    for (const [reviewIndex, appointment] of coachAppointments
      .slice(0, maxReviews)
      .entries()) {
      reviewRows.push({
        id: seedId(`coach-review:${appointment.id as string}`),
        appointment_id: appointment.id as string,
        coach_id: coachId,
        comment:
          reviewIndex % 2 === 0
            ? 'Coach gave clear cues and adjusted the session to my energy.'
            : 'Great accountability and realistic next steps.',
        created_at: new Date(
          (appointment.completed_at as Date).getTime() + 5 * 60 * 60_000,
        ),
        rating: qualityRating(account?.coachQuality, reviewIndex + coachIndex),
        reviewer_id: appointment.user_id,
      });
    }
  }
  await ctx.prisma.coachReview.createMany({
    data: reviewRows,
    skipDuplicates: true,
  });
  const reviewModel = ctx.prisma.coachReview as unknown as {
    findMany?: (
      input: unknown,
    ) => Promise<Array<{ coach_id: string; rating: number }>>;
  };
  const allReviews = reviewModel.findMany
    ? await reviewModel.findMany({
        select: { coach_id: true, rating: true },
      })
    : reviewRows.map((review) => ({
        coach_id: review.coach_id,
        rating: review.rating,
      }));
  const aggregateByCoach = new Map<string, { count: number; total: number }>();
  for (const review of allReviews) {
    const aggregate = aggregateByCoach.get(review.coach_id) ?? {
      count: 0,
      total: 0,
    };
    aggregate.count += 1;
    aggregate.total += Number(review.rating);
    aggregateByCoach.set(review.coach_id, aggregate);
  }
  for (const coachKey of coachKeys) {
    const coachId = ctx.state.coachProfileIds[coachKey];
    const aggregate = aggregateByCoach.get(coachId) ?? { count: 0, total: 0 };
    await ctx.prisma.coachProfile.upsert({
      where: { user_id: ctx.state.userIds[coachKey] },
      update: {
        average_rating: aggregate.count
          ? new Prisma.Decimal((aggregate.total / aggregate.count).toFixed(2))
          : null,
        rating_count: aggregate.count,
      },
      create: {
        id: coachId,
        user_id: ctx.state.userIds[coachKey],
        average_rating: aggregate.count
          ? new Prisma.Decimal((aggregate.total / aggregate.count).toFixed(2))
          : null,
        rating_count: aggregate.count,
      },
    });
  }

  const activeMemberId = ctx.state.userIds['member-active'];
  const premiumMemberId = ctx.state.userIds['member-premium'];
  const qaOneTimeAppointment = appointmentRows.find(
    (appointment) =>
      appointment.user_id === activeMemberId &&
      appointment.recurring_plan_id === null,
  );
  if (qaOneTimeAppointment) {
    ctx.notableIds.qaRidgeOneTimeAppointmentId = String(
      qaOneTimeAppointment.id,
    );
  }
  const qaMonthlyFutureSession = appointmentRows.find(
    (appointment) =>
      appointment.user_id === premiumMemberId &&
      appointment.recurring_plan_id ===
        seedId('recurring-plan:member-premium') &&
      appointment.status === AppointmentStatus.confirmed &&
      (appointment.scheduled_at as Date) >= anchorDate,
  );
  if (qaMonthlyFutureSession) {
    ctx.notableIds.qaRidgeMonthlyFutureSessionId = String(
      qaMonthlyFutureSession.id,
    );
  }
  const qaFeedbackAppointment = completedAppointments.find(
    (appointment) => appointment.user_id === premiumMemberId,
  );
  if (qaFeedbackAppointment) {
    ctx.notableIds.qaRidgeFeedbackSessionId = String(qaFeedbackAppointment.id);
  }
}

async function seedAmenityBookings(ctx: DynamicSeedContext) {
  type AmenityRow = {
    id: string;
    capacity: number;
    hourly_rate: Prisma.Decimal;
    minimum_hours: number | null;
    status: EquipmentStatus | null;
    is_active: boolean;
    is_mapped: boolean;
    is_reservable: boolean | null;
    requires_subscription: boolean;
  };
  type ExistingInterval = {
    amenity_id: string | null;
    starts_at: Date | null;
    scheduled_at?: Date | null;
    ends_at: Date | null;
    user_id: string | null;
    status?: BookingStatus | CommerceCheckoutHoldStatus;
  };

  const canonicalById = new Map(
    AMENITY_SEEDS.map((amenity) => [
      ctx.state.amenityIds[amenity.key] ?? seedId(`amenity:${amenity.key}`),
      amenity,
    ]),
  );
  const amenityIds = [...canonicalById.keys()];
  const [storedAmenities, existingBookings, existingHolds, appointments] =
    await Promise.all([
      ctx.prisma.amenity.findMany({
        where: { id: { in: amenityIds } },
        select: {
          capacity: true,
          hourly_rate: true,
          id: true,
          is_active: true,
          is_mapped: true,
          is_reservable: true,
          minimum_hours: true,
          requires_subscription: true,
          status: true,
        },
      }),
      ctx.prisma.amenityBooking.findMany({
        select: {
          amenity_id: true,
          ends_at: true,
          starts_at: true,
          status: true,
          user_id: true,
        },
      }),
      ctx.prisma.commerceCheckoutHold.findMany({
        where: { status: CommerceCheckoutHoldStatus.held },
        select: {
          amenity_id: true,
          ends_at: true,
          scheduled_at: true,
          status: true,
          user_id: true,
        },
      }),
      ctx.prisma.coachAppointment.findMany({
        select: {
          duration_minutes: true,
          scheduled_at: true,
          status: true,
          user_id: true,
        },
      }),
    ]);

  const storedById = new Map(
    (storedAmenities as AmenityRow[]).map((amenity) => [amenity.id, amenity]),
  );
  const amenities = AMENITY_SEEDS.map((canonical) => {
    const id =
      ctx.state.amenityIds[canonical.key] ?? seedId(`amenity:${canonical.key}`);
    const stored = storedById.get(id);
    return {
      ...canonical,
      id,
      capacity: stored?.capacity ?? canonical.capacity,
      hourlyRate: new Prisma.Decimal(
        stored?.hourly_rate ?? canonical.hourlyRate,
      ),
      minimumHours: Math.max(
        1,
        stored?.minimum_hours ?? canonical.minimumHours,
      ),
      status: stored?.status ?? null,
      isActive: stored?.is_active ?? true,
      isMapped: stored?.is_mapped ?? true,
      // Production treats a nullable `is_reservable` as blocked, so preserve
      // an existing null instead of silently making an admin-disabled row
      // bookable during additive seeding.
      isReservable: stored ? stored.is_reservable : true,
      requiresSubscription:
        stored?.requires_subscription ?? canonical.requiresSubscription,
    };
  });
  const amenityIntervals = new KeyedIntervalAllocator();
  const reserve = (row: ExistingInterval, durationMinutes?: number) => {
    const startsAt = row.starts_at ?? row.scheduled_at ?? null;
    if (!startsAt) return;
    const endsAt =
      row.ends_at ??
      (durationMinutes
        ? new Date(startsAt.getTime() + durationMinutes * 60_000)
        : null);
    if (!endsAt || endsAt <= startsAt) return;
    const keys = [`member:${row.user_id ?? 'unknown'}`];
    if (row.amenity_id) keys.push(`amenity:${row.amenity_id}`);
    amenityIntervals.tryAllocateMany(keys, startsAt, endsAt);
  };
  for (const row of existingBookings as ExistingInterval[]) reserve(row);
  for (const row of existingHolds as ExistingInterval[]) reserve(row);
  for (const appointment of appointments) {
    reserve(
      {
        amenity_id: null,
        ends_at: null,
        starts_at: appointment.scheduled_at,
        user_id: appointment.user_id,
      },
      appointment.duration_minutes,
    );
  }

  type OperatingHour = {
    day_of_week: number;
    opens_at: Date;
    closes_at: Date;
    is_closed: boolean;
    is_active: boolean;
  };
  type SpecialSchedule = {
    starts_on: Date;
    ends_on: Date;
    opens_at: Date | null;
    closes_at: Date | null;
    is_closed: boolean;
    is_active: boolean;
  };
  const optionalPrisma = ctx.prisma as unknown as {
    gymOperatingHour?: {
      findMany?: (input: unknown) => Promise<OperatingHour[]>;
    };
    gymSpecialSchedule?: {
      findMany?: (input: unknown) => Promise<SpecialSchedule[]>;
    };
  };
  const [operatingHours, specialSchedules] = await Promise.all([
    optionalPrisma.gymOperatingHour?.findMany
      ? optionalPrisma.gymOperatingHour.findMany({
          select: {
            closes_at: true,
            day_of_week: true,
            is_active: true,
            is_closed: true,
            opens_at: true,
          },
        })
      : Promise.resolve([]),
    optionalPrisma.gymSpecialSchedule?.findMany
      ? optionalPrisma.gymSpecialSchedule.findMany({
          select: {
            closes_at: true,
            ends_on: true,
            is_active: true,
            is_closed: true,
            opens_at: true,
            starts_on: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const minutesOfDay = (value: Date) =>
    value.getUTCHours() * 60 + value.getUTCMinutes();
  const defaultHours = (day: number) =>
    day === 0
      ? { opens: 8 * 60, closes: 18 * 60 }
      : { opens: 6 * 60, closes: 22 * 60 };
  const dateKey = (value: Date) => value.toISOString().slice(0, 10);
  const isWithinGymHours = (startsAt: Date, endsAt: Date) => {
    if (startsAt.toISOString().slice(0, 10) !== dateKey(endsAt)) return false;
    const day = startsAt.getUTCDay();
    const schedule = specialSchedules.find(
      (candidate) =>
        candidate.is_active &&
        dateKey(candidate.starts_on) <= dateKey(startsAt) &&
        dateKey(candidate.ends_on) >= dateKey(startsAt),
    );
    if (schedule?.is_closed) return false;
    const regular = operatingHours.find(
      (candidate) => candidate.is_active && candidate.day_of_week === day,
    );
    const fallback = defaultHours(day);
    const opens = schedule?.opens_at
      ? minutesOfDay(schedule.opens_at)
      : regular
        ? minutesOfDay(regular.opens_at)
        : fallback.opens;
    const closes = schedule?.closes_at
      ? minutesOfDay(schedule.closes_at)
      : regular
        ? minutesOfDay(regular.closes_at)
        : fallback.closes;
    if (schedule?.is_closed || regular?.is_closed) return false;
    return minutesOfDay(startsAt) >= opens && minutesOfDay(endsAt) <= closes;
  };

  const bookableAmenities = amenities.filter(
    (amenity) =>
      amenity.capacity > 0 &&
      amenity.isActive &&
      amenity.isMapped &&
      amenity.isReservable === true &&
      (amenity.status === null || amenity.status === EquipmentStatus.available),
  );
  // A preserved admin row can retain a canonical name while being intentionally
  // non-bookable (for example, capacity 0). Historical seed rows must not use
  // such a row either: a booking still needs a real production resource.
  const eligibleAmenities = amenities.filter((amenity) => amenity.capacity > 0);
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const staffId = ctx.state.userIds[ctx.state.staffKeys[0]];
  const bookingRows: Prisma.AmenityBookingCreateManyInput[] = [];
  const feedbackRows: Prisma.AmenityFeedbackCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const holdRows: Prisma.CommerceCheckoutHoldCreateManyInput[] = [];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const maxFuture = daysFrom(ctx.config.anchorDate, 30, 23, 59);

  memberKeys.forEach((memberKey, index) => {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === memberKey,
    );
    const bookingCount = bookingVolumeCount(
      ctx,
      memberKey,
      ctx.config.bookingDensity,
    );
    for (let bookingIndex = 0; bookingIndex < bookingCount; bookingIndex += 1) {
      const rowIndex = index + bookingIndex;
      const accessWindow = memberAccessWindow(ctx, memberKey);
      const forceUpcoming =
        memberKey === 'member-active' &&
        bookingIndex === 0 &&
        accessWindow.hasAccess;
      const forceHistorical =
        (memberKey === 'member-premium' && bookingIndex === 0) ||
        ((memberKey === 'member-frozen' || memberKey === 'member-expired') &&
          bookingIndex === 0);
      const historicalBooking =
        !forceUpcoming &&
        (accessWindow.historicalOnly ||
          forceHistorical ||
          bookingIndex < Math.max(1, Math.floor(bookingCount * 0.55)));
      const candidates = historicalBooking
        ? eligibleAmenities
        : bookableAmenities.filter(
            (amenity) =>
              !amenity.requiresSubscription ||
              account?.memberPersona === 'premium' ||
              account?.coachingProfile === 'recurring_active',
          );
      if (candidates.length === 0) continue;
      const amenity = candidates[rowIndex % candidates.length];
      const memberId = ctx.state.userIds[memberKey];
      const durationMinutes = amenity.minimumHours * 60;
      let startsAt = historicalBooking
        ? activityDateFor(
            ctx,
            memberKey,
            bookingIndex,
            bookingCount,
            8 + (rowIndex % 6),
          )
        : futureDateFor(ctx, memberKey, bookingIndex, 8 + (rowIndex % 6));
      if (!startsAt) continue;
      let allocated = false;
      for (let shift = 0; shift < 40; shift += 1) {
        const candidate = daysFrom(startsAt, shift, startsAt.getUTCHours());
        const candidateEnd = new Date(
          candidate.getTime() + durationMinutes * 60_000,
        );
        const latestAllowed = historicalBooking
          ? (accessWindow.activityEnd ??
            daysFrom(ctx.config.anchorDate, -1, 20))
          : new Date(
              Math.min(
                accessWindow.expiresAt?.getTime() ?? maxFuture.getTime(),
                maxFuture.getTime(),
              ),
            );
        if (candidateEnd > latestAllowed) break;
        if (
          !isWithinGymHours(candidate, candidateEnd) ||
          (!historicalBooking && candidate < ctx.config.anchorDate)
        ) {
          continue;
        }
        if (
          amenityIntervals.tryAllocateMany(
            [`amenity:${amenity.id}`, `member:${memberId}`],
            candidate,
            candidateEnd,
          )
        ) {
          startsAt = candidate;
          allocated = true;
          break;
        }
      }
      if (!allocated) continue;

      const status = !historicalBooking
        ? BookingStatus.confirmed
        : memberKey === 'member-frozen' && bookingIndex === 0
          ? BookingStatus.cancelled
          : memberKey === 'member-expired' && bookingIndex === 0
            ? BookingStatus.no_show
            : rowIndex % 9 === 0
              ? BookingStatus.no_show
              : rowIndex % 7 === 0
                ? BookingStatus.cancelled
                : BookingStatus.completed;
      const bookingId = seedId(`amenity-booking:${memberKey}:${bookingIndex}`);
      const holdId = seedId(
        `commerce-hold:venue-booking:${memberKey}:${bookingIndex}`,
      );
      const paymentId = seedId(
        `payment:amenity-booking:${memberKey}:${bookingIndex}`,
      );
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      const registrationFloor = account?.lifecycle?.registeredAt
        ? new Date(account.lifecycle.registeredAt.getTime() + 60_000)
        : daysFrom(ctx.config.anchorDate, -365);
      const paymentBase = historicalBooking
        ? daysFrom(startsAt, -2, 12)
        : daysFrom(ctx.config.anchorDate, -1, 12);
      const paymentAt = new Date(
        Math.max(paymentBase.getTime(), registrationFloor.getTime()),
      );
      const paymentVerifiedAt = new Date(paymentAt.getTime() + 2 * 60_000);
      const bookingCreatedAt = new Date(paymentAt.getTime() + 3 * 60_000);
      const holdCreatedAt = new Date(paymentAt.getTime() - 60_000);
      const holdExpiresAt = new Date(paymentAt.getTime() + 15 * 60_000);
      const maintenanceCancellation =
        status === BookingStatus.cancelled &&
        amenity.status === EquipmentStatus.maintenance;
      const cancellationReason =
        status === BookingStatus.cancelled
          ? maintenanceCancellation
            ? 'VENUE_MAINTENANCE'
            : 'MEMBER_REQUEST'
          : null;
      const totalAmount = amenity.hourlyRate
        .mul(durationMinutes)
        .div(60)
        .toDecimalPlaces(2);

      bookingRows.push({
        id: bookingId,
        amenity_id: amenity.id,
        balance_amount: new Prisma.Decimal(0),
        balance_paid_at: paymentVerifiedAt,
        cancelled_at:
          status === BookingStatus.cancelled
            ? daysFrom(startsAt, -1, 17)
            : null,
        cancellation_reason: cancellationReason,
        coach_id: null,
        completed_at: status === BookingStatus.completed ? endsAt : null,
        downpayment_amount: new Prisma.Decimal(0),
        downpayment_paid_at: paymentVerifiedAt,
        ends_at: endsAt,
        notes:
          status === BookingStatus.no_show
            ? 'No-show booking retained for admin filters.'
            : maintenanceCancellation
              ? 'Venue maintenance cancellation retained for operations history.'
              : 'Amenity booking retained for schedule review.',
        starts_at: startsAt,
        status,
        total_amount: totalAmount,
        user_id: memberId,
        created_at: bookingCreatedAt,
      });
      holdRows.push({
        id: holdId,
        user_id: memberId,
        coach_id: null,
        amenity_id: amenity.id,
        kind: CommerceCheckoutHoldKind.venue,
        status: CommerceCheckoutHoldStatus.consumed,
        idempotency_key: seedExternalId(
          `commerce-hold:venue-booking:${memberKey}:${bookingIndex}`,
        ),
        payment_id: null,
        scheduled_at: startsAt,
        ends_at: endsAt,
        duration_minutes: durationMinutes,
        amount: totalAmount,
        currency: 'PHP',
        session_count: null,
        start_date: null,
        end_date: null,
        preferred_days: [],
        preferred_time: null,
        member_notes: 'Seeded full PayMongo venue booking checkout.',
        expires_at: holdExpiresAt,
        consumed_at: paymentVerifiedAt,
        released_at: null,
        failure_reason: null,
        appointment_id: null,
        booking_id: bookingId,
        subscription_id: null,
        membership_card_id: null,
        recurring_plan_id: null,
        membership_plan_id: null,
        created_at: holdCreatedAt,
      });
      paymentRows.push({
        id: paymentId,
        amount: totalAmount,
        currency: 'PHP',
        created_at: paymentAt,
        gateway_event_id: seedExternalId(`gateway:${paymentId}`),
        gateway_metadata: {
          accountKey: memberKey,
          booking_id: bookingId,
          checkout_transition: 'completed_full_payment',
          coaching_checkout_hold_id: holdId,
          hold_id: holdId,
          kind: CommerceCheckoutHoldKind.venue,
          payment_id: paymentId,
          provider: PaymentProvider.paymongo,
          source: 'dynamic-seed',
        },
        idempotency_key: seedExternalId(
          `payment:amenity-booking:${memberKey}:${bookingIndex}`,
        ),
        payable_id: holdId,
        payable_type: PayableType.commerce_checkout_hold,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.paymongo,
        provider_ref: seedExternalId(`paymongo:${paymentId}`),
        rejection_reason: null,
        screenshot_url: null,
        status: PaymentStatus.completed,
        user_id: memberId,
        verified_at: paymentVerifiedAt,
        verified_by: null,
      });

      if (status === BookingStatus.completed) {
        feedbackRows.push({
          id: seedId(`amenity-feedback:${bookingId}`),
          amenity_id: amenity.id,
          comment:
            index % 2 === 0
              ? 'Facility was clean and staff helped us start on time.'
              : 'Smooth booking flow and helpful reminders.',
          created_at: daysFrom(startsAt, 0, startsAt.getUTCHours() + 1, 10),
          rating: 4 + (rowIndex % 2),
          user_id: memberId,
        });
      }
      if (status !== BookingStatus.confirmed && staffId) {
        auditRows.push({
          id: seedId(`audit:amenity-booking:${memberKey}:${bookingIndex}`),
          action:
            status === BookingStatus.completed
              ? 'BOOKING_COMPLETED'
              : 'BOOKING_CANCELLED',
          after: {
            cancellation_reason: cancellationReason,
            completed_at:
              status === BookingStatus.completed ? endsAt.toISOString() : null,
            no_show: status === BookingStatus.no_show,
            status,
          } as Prisma.InputJsonValue,
          before: { status: BookingStatus.confirmed } as Prisma.InputJsonValue,
          created_at:
            status === BookingStatus.completed
              ? endsAt
              : status === BookingStatus.no_show
                ? startsAt
                : daysFrom(startsAt, -1, 17),
          entity: 'AmenityBooking',
          entity_id: bookingId,
          ip_address: '127.0.0.30',
          user_id: staffId,
        });
      }
    }
  });

  await ctx.prisma.amenityBooking.createMany({
    data: bookingRows,
    skipDuplicates: true,
  });
  await ctx.prisma.amenityFeedback.createMany({
    data: feedbackRows,
    skipDuplicates: true,
  });

  const holdModel = ctx.prisma
    .commerceCheckoutHold as unknown as CheckoutHoldModel;
  const paymentModel = ctx.prisma.payment as unknown as PaymentModel;
  for (const row of paymentRows) {
    if (!row.id) continue;
    const update = { ...row };
    delete update.id;
    await paymentModel.upsert({
      where: { id: row.id },
      update: update as Record<string, unknown>,
      create: row,
    });
  }
  for (const row of holdRows) {
    if (!row.id) continue;
    const update = { ...row };
    delete update.id;
    await holdModel.upsert({
      where: { id: row.id },
      update: update as Record<string, unknown>,
      create: row as Record<string, unknown>,
    });
  }
  for (const row of holdRows) {
    if (!row.id) continue;
    await holdModel.update({
      where: { id: row.id },
      data: {
        payment_id:
          paymentRows.find((payment) => payment.payable_id === row.id)?.id ??
          null,
      },
    });
  }
  await ctx.prisma.auditLog.createMany({
    data: auditRows,
    skipDuplicates: true,
  });
}

export async function seedCheckoutHolds(ctx: DynamicSeedContext) {
  const holdPaymentRows: Prisma.PaymentCreateManyInput[] = [];
  const holdRows: Prisma.CommerceCheckoutHoldCreateManyInput[] = [];
  const fixedScenarios = [
    {
      accountKey: 'member-pending',
      amenityId: null,
      amount: new Prisma.Decimal('799'),
      expiresAt: daysFrom(ctx.config.anchorDate, -1, 12),
      failureReason:
        'PayMongo checkout expired before membership confirmation.',
      kind: CommerceCheckoutHoldKind.subscription,
      membershipPlanKey: 'starter-monthly',
      paymentStatus: PaymentStatus.failed,
      scheduledAt: null,
      status: CommerceCheckoutHoldStatus.expired,
    },
    {
      accountKey: 'member-unverified',
      amenityId: null,
      amount: new Prisma.Decimal('1999'),
      expiresAt: daysFrom(ctx.config.anchorDate, -2, 12),
      failureReason: 'Checkout expired before PayMongo confirmation.',
      kind: CommerceCheckoutHoldKind.subscription,
      membershipPlanKey: 'premium-coaching',
      paymentStatus: PaymentStatus.failed,
      scheduledAt: null,
      status: CommerceCheckoutHoldStatus.expired,
    },
    {
      accountKey: 'member-suspended',
      amenityId: null,
      amount: new Prisma.Decimal('900'),
      expiresAt: daysFrom(ctx.config.anchorDate, -4, 12),
      failureReason: 'PayMongo authorization failed; no product was created.',
      kind: CommerceCheckoutHoldKind.one_time,
      membershipPlanKey: null,
      paymentStatus: PaymentStatus.failed,
      scheduledAt: null,
      status: CommerceCheckoutHoldStatus.failed,
    },
    {
      accountKey: 'member-checkout-abandoned',
      amenityId: null,
      amount: new Prisma.Decimal('1999'),
      expiresAt: daysFrom(ctx.config.anchorDate, -3, 12),
      failureReason:
        'PayMongo authorization failed; no coaching product was created.',
      kind: CommerceCheckoutHoldKind.monthly,
      membershipPlanKey: null,
      paymentStatus: PaymentStatus.failed,
      scheduledAt: null,
      status: CommerceCheckoutHoldStatus.failed,
    },
  ];
  const fixedScenarioKeys = new Set(
    fixedScenarios.map((scenario) => scenario.accountKey),
  );
  const generatedScenarios = [
    ...ctx.state.restrictedMemberKeys,
    ...ctx.state.memberKeys.filter(
      (accountKey) =>
        ctx.state.accounts.find((account) => account.key === accountKey)
          ?.coachingProfile === 'checkout_failed',
    ),
  ]
    .filter((accountKey, index, keys) => keys.indexOf(accountKey) === index)
    .filter((accountKey) => !fixedScenarioKeys.has(accountKey))
    .map((accountKey, index) => {
      const coachingFailure =
        ctx.state.accounts.find((account) => account.key === accountKey)
          ?.coachingProfile === 'checkout_failed';
      const terminalStatus =
        index % 2 === 0
          ? CommerceCheckoutHoldStatus.expired
          : CommerceCheckoutHoldStatus.failed;
      return {
        accountKey,
        amenityId: null,
        amount: new Prisma.Decimal(index % 2 === 0 ? '799' : '900'),
        expiresAt: daysFrom(ctx.config.anchorDate, -2 - index, 12),
        failureReason:
          terminalStatus === CommerceCheckoutHoldStatus.expired
            ? 'Checkout expired before product confirmation.'
            : 'PayMongo authorization failed; no product was created.',
        kind: coachingFailure
          ? index % 2 === 0
            ? CommerceCheckoutHoldKind.monthly
            : CommerceCheckoutHoldKind.one_time
          : index % 2 === 0
            ? CommerceCheckoutHoldKind.monthly
            : CommerceCheckoutHoldKind.one_time,
        membershipPlanKey: coachingFailure ? null : null,
        paymentStatus: PaymentStatus.failed,
        scheduledAt: null,
        status: terminalStatus,
      };
    });
  const scenarios = [...fixedScenarios, ...generatedScenarios];

  for (const scenario of scenarios) {
    const userId = ctx.state.userIds[scenario.accountKey];
    if (!userId) {
      continue;
    }
    const holdId = seedId(`commerce-hold:${scenario.accountKey}`);
    const paymentId = seedId(`payment:commerce-hold:${scenario.accountKey}`);
    const createdAt = daysFrom(scenario.expiresAt, -3, 9);
    const paymentCreatedAt = new Date(createdAt.getTime() + 60 * 1_000);
    holdPaymentRows.push({
      id: paymentId,
      amount: scenario.amount,
      currency: 'PHP',
      created_at: paymentCreatedAt,
      gateway_event_id: seedExternalId(`gateway:${paymentId}`),
      gateway_metadata: {
        accountKey: scenario.accountKey,
        checkout_url: `https://checkout.paymongo.test/${paymentId}`,
        checkout_transition: 'pending_then_failed',
        coaching_checkout_hold_id: holdId,
        hold_id: holdId,
        kind: scenario.kind,
        payment_id: paymentId,
        provider: 'paymongo',
        scenario: 'terminal_checkout_attempt',
        source: 'dynamic-seed',
      },
      idempotency_key: seedExternalId(
        `payment:commerce-hold:${scenario.accountKey}`,
      ),
      payable_id: holdId,
      payable_type: PayableType.commerce_checkout_hold,
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.paymongo,
      provider_ref: seedExternalId(
        `paymongo:commerce-hold:${scenario.accountKey}`,
      ),
      rejection_reason: scenario.failureReason,
      screenshot_url: null,
      status: scenario.paymentStatus,
      user_id: userId,
      verified_at: null,
      verified_by: null,
    });
    holdRows.push({
      id: holdId,
      user_id: userId,
      coach_id: null,
      amenity_id: scenario.amenityId,
      kind: scenario.kind,
      status: scenario.status,
      idempotency_key: seedExternalId(`commerce-hold:${scenario.accountKey}`),
      payment_id: null,
      scheduled_at: scenario.scheduledAt,
      ends_at: null,
      duration_minutes: null,
      amount: scenario.amount,
      currency: 'PHP',
      session_count:
        scenario.kind === CommerceCheckoutHoldKind.monthly ? 4 : null,
      start_date:
        scenario.kind === CommerceCheckoutHoldKind.monthly
          ? daysFrom(ctx.config.anchorDate, 7)
          : null,
      end_date:
        scenario.kind === CommerceCheckoutHoldKind.monthly
          ? daysFrom(ctx.config.anchorDate, 37)
          : null,
      preferred_days:
        scenario.kind === CommerceCheckoutHoldKind.monthly ? [1, 3] : [],
      preferred_time:
        scenario.kind === CommerceCheckoutHoldKind.monthly
          ? fixedTime('18:00:00')
          : null,
      member_notes:
        'Seeded checkout intent used to exercise terminal and active hold reconciliation.',
      expires_at: scenario.expiresAt,
      consumed_at: null,
      released_at: scenario.expiresAt,
      failure_reason: scenario.failureReason,
      appointment_id: null,
      booking_id: null,
      subscription_id: null,
      membership_card_id: null,
      recurring_plan_id: null,
      membership_plan_id: scenario.membershipPlanKey
        ? (ctx.state.membershipPlanIds[scenario.membershipPlanKey] ?? null)
        : null,
      created_at: createdAt,
    });
  }

  const holdModel = ctx.prisma
    .commerceCheckoutHold as unknown as CheckoutHoldModel;
  const paymentModel = ctx.prisma.payment as unknown as PaymentModel;
  for (const row of holdRows) {
    const update = { ...row };
    delete update.id;
    if (!row.id) {
      throw new Error('Seeded checkout hold is missing its deterministic id');
    }
    await holdModel.upsert({
      where: { id: row.id },
      update: update as Record<string, unknown>,
      create: row as Record<string, unknown>,
    });
  }
  for (const row of holdPaymentRows) {
    const update = { ...row };
    delete update.id;
    if (!row.id) {
      throw new Error(
        'Seeded checkout payment is missing its deterministic id',
      );
    }
    await paymentModel.upsert({
      where: { id: row.id },
      update: update as Record<string, unknown>,
      create: row,
    });
  }
  for (const row of holdRows) {
    if (!row.id) {
      throw new Error('Seeded checkout hold is missing its deterministic id');
    }
    await holdModel.update({
      where: { id: row.id },
      data: {
        payment_id:
          holdPaymentRows.find((payment) => payment.payable_id === row.id)
            ?.id ?? null,
      },
    });
  }
  ctx.notableIds.demoPendingPaymentId = seedId(
    'payment:commerce-hold:member-pending',
  );
  ctx.notableIds.qaCheckoutAbandonedMemberId =
    ctx.state.userIds['member-checkout-abandoned'];
}

export async function seedFacilitiesCoaching(ctx: DynamicSeedContext) {
  await seedAmenities(ctx);
  await seedCoachProfiles(ctx);
  await seedRelationshipsPlansAndAppointments(ctx);
  await seedAmenityBookings(ctx);
  await seedCheckoutHolds(ctx);

  ctx.notableIds.demoCoachProfileId = ctx.state.coachProfileIds.coach;
  ctx.notableIds.boxingRingAmenityId =
    ctx.state.amenityIds['boxing-ring'] ?? seedId('amenity:boxing-ring');
  ctx.notableIds.demoPremiumRecurringPlanId = seedId(
    'recurring-plan:member-premium',
  );

  return {
    counts: {
      amenities: AMENITY_SEEDS.length,
      coachProfiles: ctx.state.coachAccountKeys.length,
    },
  };
}
