import {
  AmenityType,
  AppointmentStatus,
  BookingStatus,
  CoachScheduleType,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
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
  activityDateFor,
  futureDateFor,
  KeyedIntervalAllocator,
  memberAccessWindow,
  memberVolumeCount,
  isMonthlyCoachingMember,
} from '../volumes';

const AMENITY_SEEDS = [
  {
    key: 'boxing-ring',
    capacity: 4,
    description:
      'Professional boxing ring for sparring, pad work, and coached conditioning blocks.',
    displayOrder: 1,
    floorId: 'floor-2',
    grid: [3, 3, 5, 4],
    hourlyRate: '450',
    iconKey: 'boxing',
    name: 'Boxing Ring',
    type: AmenityType.boxing_ring,
  },
  {
    key: 'basketball-court',
    capacity: 10,
    description:
      'Full-sized indoor basketball court for group training and weekend reservations.',
    displayOrder: 2,
    floorId: 'floor-1',
    grid: [9, 1, 6, 4],
    hourlyRate: '900',
    iconKey: 'basketball',
    name: 'Basketball Court',
    type: AmenityType.basketball_court,
  },
  {
    key: 'mobility-studio',
    capacity: 16,
    description:
      'Flexible studio for mobility, yoga, small-group training, and recovery classes.',
    displayOrder: 3,
    floorId: 'floor-3',
    grid: [4, 2, 8, 6],
    hourlyRate: '650',
    iconKey: 'yoga',
    name: 'Mobility Studio',
    type: AmenityType.other,
  },
] as const;

const COACH_SPECIALIZATIONS = [
  'Strength and Conditioning',
  'Mobility and Recovery',
  'Powerlifting Fundamentals',
  'Functional Fitness',
  'Body Recomposition',
  'Endurance Conditioning',
] as const;

function coachProfileIdFor(coachKey: string) {
  return seedId(`coach-profile:${coachKey}`);
}

async function seedAmenities(ctx: DynamicSeedContext) {
  for (const amenity of AMENITY_SEEDS) {
    const [gridColumn, gridRow, gridWidth, gridHeight] = amenity.grid;
    await ctx.prisma.amenity.upsert({
      where: { id: seedId(`amenity:${amenity.key}`) },
      update: {
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
        minimum_hours: 1,
        name: amenity.name,
        requires_subscription: amenity.key === 'mobility-studio',
        type: amenity.type,
      },
      create: {
        id: seedId(`amenity:${amenity.key}`),
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
        minimum_hours: 1,
        name: amenity.name,
        requires_subscription: amenity.key === 'mobility-studio',
        type: amenity.type,
      },
    });
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
    if (!account) {
      continue;
    }

    const userId = ctx.state.userIds[coachKey];
    const profileId = coachProfileIdFor(coachKey);
    ctx.state.coachProfileIds[coachKey] = profileId;
    const monthlySessionCounts = [12, 8, 16, 10] as const;
    const monthlySessionCount =
      monthlySessionCounts[index % monthlySessionCounts.length];
    const monthlyRate = 700 + (index % 5) * 100;
    const monthlyOfferDescription =
      index % 2 === 0
        ? 'A coach-led monthly strength plan with flexible weekly session allocation.'
        : 'A coach-led monthly conditioning plan scheduled around the member and coach availability.';

    await ctx.prisma.coachProfile.upsert({
      where: { user_id: userId },
      update: {
        average_rating: new Prisma.Decimal(4.4 + (index % 6) / 10),
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
        is_available_for_booking: true,
        monthly_offer_active: true,
        monthly_offer_description: monthlyOfferDescription,
        monthly_rate: new Prisma.Decimal(monthlyRate),
        monthly_session_count: monthlySessionCount,
        monthly_session_duration_minutes: 60,
        rating_count: 10 + index,
        schedule_type:
          index % 3 === 0
            ? CoachScheduleType.full_time
            : CoachScheduleType.part_time,
        specialization:
          COACH_SPECIALIZATIONS[index % COACH_SPECIALIZATIONS.length],
      },
      create: {
        id: profileId,
        average_rating: new Prisma.Decimal(4.4 + (index % 6) / 10),
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
        is_available_for_booking: true,
        monthly_offer_active: true,
        monthly_offer_description: monthlyOfferDescription,
        monthly_rate: new Prisma.Decimal(monthlyRate),
        monthly_session_count: monthlySessionCount,
        monthly_session_duration_minutes: 60,
        rating_count: 10 + index,
        schedule_type:
          index % 3 === 0
            ? CoachScheduleType.full_time
            : CoachScheduleType.part_time,
        specialization:
          COACH_SPECIALIZATIONS[index % COACH_SPECIALIZATIONS.length],
        user_id: userId,
      },
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

  const availabilityRows = ctx.state.coachAccountKeys.flatMap((coachKey) =>
    [1, 2, 3, 4, 6].map((dayOfWeek, slotIndex) => ({
      id: seedId(`coach-availability:${coachKey}:${dayOfWeek}`),
      coach_id: ctx.state.coachProfileIds[coachKey],
      day_of_week: dayOfWeek,
      end_time: fixedTime(slotIndex % 2 === 0 ? '18:00:00' : '20:00:00'),
      is_active: true,
      start_time: fixedTime(slotIndex % 2 === 0 ? '14:00:00' : '17:00:00'),
    })),
  );

  await ctx.prisma.coachAvailabilitySlot.createMany({
    data: availabilityRows,
    skipDuplicates: true,
  });
}

async function seedRelationshipsPlansAndAppointments(ctx: DynamicSeedContext) {
  const coachKeys = ctx.state.coachAccountKeys;
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const recurringPlanRows: Prisma.RecurringCoachingPlanCreateManyInput[] = [];
  const billingRows: Prisma.RecurringCoachingBillingCycleCreateManyInput[] = [];
  const appointmentRows: Prisma.CoachAppointmentCreateManyInput[] = [];
  const relationshipRows: Prisma.CoachClientRelationshipCreateManyInput[] = [];
  const coachIntervals = new KeyedIntervalAllocator();
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];
  const availableDays = new Set([1, 2, 3, 4, 6]);
  const coachHasAvailability = (candidate: Date) => {
    const day = candidate.getUTCDay();
    if (!availableDays.has(day)) {
      return false;
    }
    const startHour = day === 2 || day === 4 ? 17 : 14;
    const endHour = day === 2 || day === 4 ? 20 : 18;
    return (
      candidate.getUTCHours() >= startHour &&
      candidate.getUTCHours() + 1 <= endHour
    );
  };
  memberKeys.forEach((memberKey, index) => {
    // Keep Luca's member portal demo connected to the same Seed Coach that owns
    // her active workout plan. This is intentionally explicit: the UI must not
    // present a coach plan without a matching active coaching relationship.
    const isLucaDemoMember = memberKey === 'member-premium';
    const isQaOneTimeMember = memberKey === 'member-active';
    const coachKey = isLucaDemoMember || isQaOneTimeMember
      ? 'coach'
      : coachKeys[index % coachKeys.length];
    const coachId = ctx.state.coachProfileIds[coachKey];
    const memberId = ctx.state.userIds[memberKey];
    const recurringPlanId = seedId(`recurring-plan:${memberKey}`);
    const amount = new Prisma.Decimal(index % 3 === 0 ? '2400' : '1800');
    const accessWindow = memberAccessWindow(ctx, memberKey);
    const monthlyCoachingMember =
      !isQaOneTimeMember && isMonthlyCoachingMember(ctx, memberKey);
    // Workout presets use the same even-index cohort for coach-managed plans.
    // Keep those members actively related to their assigned coach so demo data
    // never advertises a plan that the coach is forbidden to manage.
    const relationshipStatus: RelationshipStatus | null = monthlyCoachingMember
      ? accessWindow.historicalOnly
        ? RelationshipStatus.terminated
        : RelationshipStatus.active
      : null;
    const relationshipStart =
      accessWindow.startsAt ?? daysFrom(ctx.config.anchorDate, -14, 9);
    const relationshipEnd =
      relationshipStatus === RelationshipStatus.terminated ||
      accessWindow.historicalOnly
        ? (accessWindow.expiresAt ?? daysFrom(ctx.config.anchorDate, -7, 17))
        : null;
    const appointmentsPerMember = isQaOneTimeMember
      ? 1
      : memberVolumeCount(ctx, memberKey, 'appointments', ctx.config.sessionDensity);

    if (relationshipStatus !== null) {
      relationshipRows.push({
        id: seedId(`coach-relationship:${coachKey}:${memberKey}`),
        coach_id: coachId,
        created_at: relationshipStart,
        ended_at: relationshipEnd,
        member_id: memberId,
        notes:
          relationshipStatus === RelationshipStatus.active
            ? 'Active coaching relationship with paid recurring coaching entitlement.'
            : 'Former paid coaching relationship retained for history filters.',
        started_at: relationshipStart,
        status: relationshipStatus,
      });
    }

    if (monthlyCoachingMember) {
      recurringPlanRows.push({
      id: recurringPlanId,
      coach_id: coachId,
      completed_sessions: 0,
      created_by: adminId,
      duration_minutes: index % 2 === 0 ? 60 : 45,
      end_date:
        relationshipEnd ??
        memberAccessWindow(ctx, memberKey).expiresAt ??
        daysFrom(ctx.config.anchorDate, 45 + (index % 20)),
      frequency:
        isLucaDemoMember
          ? RecurringCoachingFrequency.monthly
          : index % 4 === 0
            ? RecurringCoachingFrequency.biweekly
            : RecurringCoachingFrequency.weekly,
      member_id: memberId,
      preferred_days: [1 + (index % 5), 3 + (index % 2)],
      preferred_time: fixedTime(index % 2 === 0 ? '16:00:00' : '18:00:00'),
      quoted_amount: amount,
      start_date: relationshipStart,
      status:
        relationshipStatus === RelationshipStatus.terminated
          ? RecurringCoachingPlanStatus.completed
          : RecurringCoachingPlanStatus.active,
      total_sessions: appointmentsPerMember,
      });
    }

    for (let cycleIndex = 0; monthlyCoachingMember && cycleIndex < 2; cycleIndex += 1) {
      const cycleStart = daysFrom(relationshipStart, cycleIndex * 28, 0);
      const billingPaymentId = seedId(
        `payment:recurring-coaching:${memberKey}:${cycleIndex}`,
      );
      const isPaid = true;
      billingRows.push({
        id: seedId(`recurring-cycle:${memberKey}:${cycleIndex}`),
        amount,
        cycle_end_date: daysFrom(cycleStart, 27, 0),
        cycle_start_date: cycleStart,
        due_date: daysFrom(cycleStart, 3, 0),
        grace_period_ends_at: daysFrom(cycleStart, 7, 23, 59),
        paid_at: isPaid ? daysFrom(cycleStart, 2, 13) : null,
        payment_id: billingPaymentId,
        recurring_plan_id: recurringPlanId,
        status: RecurringCoachingBillingCycleStatus.paid,
      });
      paymentRows.push({
        id: billingPaymentId,
        amount,
        created_at: daysFrom(cycleStart, 2, 12),
        gateway_event_id: null,
        gateway_metadata: { memberKey, source: 'recurring-coaching' },
        idempotency_key: seedExternalId(
          `payment:recurring-coaching:${memberKey}:${cycleIndex}`,
        ),
        payable_id: recurringPlanId,
        payable_type: PayableType.recurring_coaching,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.cash,
        provider_ref: null,
        status: PaymentStatus.completed,
        user_id: memberId,
        verified_at: isPaid ? daysFrom(cycleStart, 2, 14) : null,
        verified_by: isPaid ? adminId : null,
      });
    }

    for (let apptIndex = 0; apptIndex < appointmentsPerMember; apptIndex += 1) {
      const historicalAppointment =
        !isQaOneTimeMember &&
        (accessWindow.historicalOnly ||
          apptIndex < Math.max(1, Math.floor(appointmentsPerMember * 0.65)));
      let scheduledAt = historicalAppointment
        ? activityDateFor(
            ctx,
            memberKey,
            apptIndex,
            appointmentsPerMember,
            index % 2 === 0 ? 15 : 18,
          )
        : futureDateFor(ctx, memberKey, apptIndex, index % 2 === 0 ? 15 : 18);
      if (!scheduledAt) {
        continue;
      }
      const appointmentEnd = (candidate: Date) =>
        daysFrom(candidate, 0, candidate.getUTCHours() + 1);
      let allocated = false;
      for (let shift = 0; shift < 45; shift += 1) {
        const candidate = daysFrom(scheduledAt, shift, scheduledAt.getUTCHours());
        const candidateEnd = appointmentEnd(candidate);
        const latestAllowed = historicalAppointment
          ? (accessWindow.activityEnd ??
            daysFrom(ctx.config.anchorDate, -1, 20))
          : (accessWindow.expiresAt ??
            daysFrom(ctx.config.anchorDate, 45, 23, 59));
        if (candidateEnd > latestAllowed) {
          break;
        }
        if (!coachHasAvailability(candidate)) {
          continue;
        }
        const reservationKeys = historicalAppointment
          ? [coachId]
          : [coachId, `member:${memberId}`];
        if (
          coachIntervals.tryAllocateMany(
            reservationKeys,
            candidate,
            candidateEnd,
          )
        ) {
          scheduledAt = candidate;
          allocated = true;
          break;
        }
      }
      if (!allocated) {
        continue;
      }
      const qaFeedbackAppointment =
        isLucaDemoMember && apptIndex === 1;
      const status = qaFeedbackAppointment
        ? AppointmentStatus.completed
        : historicalAppointment
          ? apptIndex % 8 === 0
            ? AppointmentStatus.no_show
            : apptIndex % 5 === 0
              ? AppointmentStatus.cancelled
              : AppointmentStatus.completed
          : AppointmentStatus.confirmed;
      const appointmentId = seedId(
        `coach-appointment:${memberKey}:${apptIndex}`,
      );
      const totalAmount = new Prisma.Decimal(900 + (index % 4) * 100);
      const paymentAt =
        scheduledAt > ctx.config.anchorDate
          ? daysFrom(ctx.config.anchorDate, -2, 10)
          : daysFrom(scheduledAt, -2, 10);

      appointmentRows.push({
        id: appointmentId,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Assessment: improved hinge pattern and session adherence.'
            : null,
        balance_amount: new Prisma.Decimal(0),
        balance_paid_at: daysFrom(paymentAt, 0, 13),
        coach_earnings: totalAmount.mul(new Prisma.Decimal('0.80')),
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member completed the prescribed block with strong pacing.'
            : null,
        coach_id: coachId,
        cancelled_at:
          status === AppointmentStatus.cancelled
            ? daysFrom(scheduledAt, -1, scheduledAt.getUTCHours())
            : null,
        completed_at:
          status === AppointmentStatus.completed
            ? daysFrom(scheduledAt, 0, scheduledAt.getUTCHours() + 1, 5)
            : null,
        downpayment_amount: new Prisma.Decimal(0),
        downpayment_paid_at: null,
        duration_minutes: 60,
        gym_revenue: totalAmount.mul(new Prisma.Decimal('0.20')),
        is_free_session: false,
        member_notes:
          apptIndex === 1
            ? 'Wants extra shoulder mobility work.'
            : 'Member note for coach detail review.',
        no_show_at:
          status === AppointmentStatus.no_show
            ? daysFrom(scheduledAt, 0, scheduledAt.getUTCHours() + 1)
            : null,
        recurring_plan_id: monthlyCoachingMember ? recurringPlanId : null,
        recurring_state: monthlyCoachingMember
          ? status === AppointmentStatus.completed
            ? RecurringCoachingSessionState.completed
            : status === AppointmentStatus.cancelled ||
                status === AppointmentStatus.no_show
              ? RecurringCoachingSessionState.skipped
              : RecurringCoachingSessionState.generated
          : null,
        scheduled_at: scheduledAt,
        session_notes:
          status === AppointmentStatus.completed
            ? 'Finished warm-up, main lift, and cooldown.'
            : null,
        status,
        total_amount: totalAmount,
        user_id: memberId,
        created_at: daysFrom(paymentAt, -1, 12),
      });

      paymentRows.push({
        id: seedId(`payment:coach-appointment:${memberKey}:${apptIndex}`),
        amount: totalAmount,
        created_at: paymentAt,
        gateway_event_id: null,
        gateway_metadata: { appointmentId, memberKey },
        idempotency_key: seedExternalId(
          `payment:coach-appointment:${memberKey}:${apptIndex}`,
        ),
        payable_id: appointmentId,
        payable_type: PayableType.coaching,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.cash,
        provider_ref: null,
        status: PaymentStatus.completed,
        user_id: memberId,
        verified_at: daysFrom(paymentAt, 0, 11),
        verified_by: adminId,
      });
    }
  });

  await ctx.prisma.coachClientRelationship.createMany({
    data: relationshipRows,
    skipDuplicates: true,
  });
  await ctx.prisma.recurringCoachingPlan.createMany({
    data: recurringPlanRows,
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

  const appointmentsByPlan = new Map<string, number>();
  const completedByPlan = new Map<string, number>();
  for (const appointment of appointmentRows) {
    const planId = appointment.recurring_plan_id as string;
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
  const activeMemberId = ctx.state.userIds['member-active'];
  const premiumMemberId = ctx.state.userIds['member-premium'];
  const qaOneTimeAppointment = appointmentRows.find(
    (appointment) =>
      appointment.user_id === activeMemberId &&
      appointment.recurring_plan_id === null,
  );
  if (qaOneTimeAppointment) {
    ctx.notableIds.qaRidgeOneTimeAppointmentId = String(qaOneTimeAppointment.id);
  }
  const qaMonthlyFutureSession = appointmentRows.find(
    (appointment) =>
      appointment.user_id === premiumMemberId &&
      appointment.recurring_plan_id === seedId('recurring-plan:member-premium') &&
      appointment.status === AppointmentStatus.confirmed &&
      (appointment.scheduled_at as Date) >= ctx.config.anchorDate,
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
  const reviewAppointments = qaFeedbackAppointment
    ? [
        qaFeedbackAppointment,
        ...completedAppointments.filter(
          (appointment) => appointment.id !== qaFeedbackAppointment.id,
        ),
      ].slice(0, 30)
    : completedAppointments.slice(0, 30);
  await ctx.prisma.coachReview.createMany({
    data: reviewAppointments.map((appointment, index) => ({
      id: seedId(`coach-review:${appointment.id as string}`),
      appointment_id: appointment.id as string,
      coach_id: appointment.coach_id,
      comment:
        index % 2 === 0
          ? 'Coach gave clear cues and adjusted the session to my energy.'
          : 'Great accountability and realistic next steps.',
      created_at: daysFrom(
        appointment.scheduled_at as Date,
        0,
        (appointment.scheduled_at as Date).getUTCHours() + 1,
        10,
      ),
      rating: 4 + (index % 2),
      reviewer_id: appointment.user_id,
    })),
    skipDuplicates: true,
  });

  await ctx.prisma.payment.createMany({
    data: paymentRows,
    skipDuplicates: true,
  });
}

async function seedAmenityBookings(ctx: DynamicSeedContext) {
  const amenityKeys = AMENITY_SEEDS.map((amenity) => amenity.key);
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const staffId = ctx.state.userIds[ctx.state.staffKeys[0]];
  const bookingRows: Prisma.AmenityBookingCreateManyInput[] = [];
  const feedbackRows: Prisma.AmenityFeedbackCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const amenityIntervals = new KeyedIntervalAllocator();

  const confirmedCoachingAppointments =
    await ctx.prisma.coachAppointment.findMany({
      where: {
        scheduled_at: { gte: ctx.config.anchorDate },
        status: AppointmentStatus.confirmed,
      },
      select: {
        duration_minutes: true,
        scheduled_at: true,
        user_id: true,
      },
    });
  for (const appointment of confirmedCoachingAppointments) {
    amenityIntervals.tryAllocate(
      `member:${appointment.user_id}`,
      appointment.scheduled_at,
      new Date(
        appointment.scheduled_at.getTime() +
          appointment.duration_minutes * 60_000,
      ),
    );
  }

  memberKeys.forEach((memberKey, index) => {
    const bookingCount = memberVolumeCount(
      ctx,
      memberKey,
      'bookings',
      ctx.config.bookingDensity,
    );
    for (let bookingIndex = 0; bookingIndex < bookingCount; bookingIndex += 1) {
    const rowIndex = index + bookingIndex;
    const amenityKey = amenityKeys[rowIndex % amenityKeys.length];
    const amenity = AMENITY_SEEDS[rowIndex % AMENITY_SEEDS.length];
    const amenityId = seedId(`amenity:${amenityKey}`);
    const memberId = ctx.state.userIds[memberKey];
    const accessWindow = memberAccessWindow(ctx, memberKey);
    const historicalBooking =
      accessWindow.historicalOnly || bookingIndex < Math.floor(bookingCount * 0.55);
    let startsAt = historicalBooking
      ? activityDateFor(
          ctx,
          memberKey,
          bookingIndex,
          bookingCount,
          8 + (rowIndex % 6),
        )
      : futureDateFor(ctx, memberKey, bookingIndex, 8 + (rowIndex % 6));
    if (!startsAt) {
      continue;
    }
    let allocated = false;
    for (let shift = 0; shift < 40; shift += 1) {
      const candidate = daysFrom(startsAt, shift, startsAt.getUTCHours());
      const candidateEnd = daysFrom(candidate, 0, candidate.getUTCHours() + 2);
      const latestAllowed = historicalBooking
        ? (accessWindow.activityEnd ?? daysFrom(ctx.config.anchorDate, -1, 20))
        : (accessWindow.expiresAt ?? daysFrom(ctx.config.anchorDate, 30, 23, 59));
      if (candidateEnd > latestAllowed) {
        break;
      }
      if (
        amenityIntervals.tryAllocateMany(
          historicalBooking
            ? [`amenity:${amenityId}`]
            : [`amenity:${amenityId}`, `member:${memberId}`],
          candidate,
          candidateEnd,
        )
      ) {
        startsAt = candidate;
        allocated = true;
        break;
      }
    }
    if (!allocated) {
      continue;
    }
    const status = historicalBooking
      ? rowIndex % 9 === 0
        ? BookingStatus.no_show
        : rowIndex % 7 === 0
          ? BookingStatus.cancelled
          : BookingStatus.completed
      : BookingStatus.confirmed;
    const bookingId = seedId(`amenity-booking:${memberKey}:${bookingIndex}`);
    const totalAmount = new Prisma.Decimal(amenity.hourlyRate).mul(2);
    const endsAt = daysFrom(startsAt, 0, startsAt.getUTCHours() + 2);
    const paymentAt =
      startsAt > ctx.config.anchorDate
        ? daysFrom(ctx.config.anchorDate, -1, 12)
        : daysFrom(startsAt, -2, 12);

    bookingRows.push({
      id: bookingId,
      amenity_id: amenityId,
      balance_amount: new Prisma.Decimal(0),
      balance_paid_at: daysFrom(paymentAt, 0, 13),
      cancelled_at:
        status === BookingStatus.cancelled ? daysFrom(startsAt, -1, 17) : null,
      coach_id: null,
      completed_at: status === BookingStatus.completed ? endsAt : null,
      downpayment_amount: new Prisma.Decimal(0),
      downpayment_paid_at: null,
      ends_at: endsAt,
      notes:
        status === BookingStatus.no_show
          ? 'No-show booking retained for admin filters.'
          : 'Amenity booking retained for schedule review.',
      starts_at: startsAt,
      status,
      total_amount: totalAmount,
      user_id: memberId,
      created_at: daysFrom(paymentAt, -1, 11),
    });

    if (status === BookingStatus.completed) {
      feedbackRows.push({
        id: seedId(`amenity-feedback:${bookingId}`),
        amenity_id: amenityId,
        comment:
          index % 2 === 0
            ? 'Facility was clean and staff helped us start on time.'
            : 'Smooth booking flow and helpful reminders.',
        created_at: daysFrom(startsAt, 0, startsAt.getUTCHours() + 1, 10),
        rating: 4 + (rowIndex % 2),
        user_id: memberId,
      });
    }

    paymentRows.push({
      id: seedId(`payment:amenity-booking:${memberKey}:${bookingIndex}`),
      amount: totalAmount,
      created_at: paymentAt,
      gateway_event_id: null,
      gateway_metadata: { bookingId, source: 'amenity-booking' },
      idempotency_key: seedExternalId(
        `payment:amenity-booking:${memberKey}:${bookingIndex}`,
      ),
      payable_id: bookingId,
      payable_type: PayableType.booking,
      payment_stage: PaymentStage.full,
      provider:
        rowIndex % 5 === 0 ? PaymentProvider.paymongo : PaymentProvider.cash,
      provider_ref:
        rowIndex % 5 === 0
          ? seedExternalId(`paymongo:amenity-booking:${memberKey}:${bookingIndex}`)
          : null,
      status: PaymentStatus.completed,
      user_id: memberId,
      verified_at: daysFrom(paymentAt, 0, 13),
      verified_by: staffId,
    });
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
  await ctx.prisma.payment.createMany({
    data: paymentRows,
    skipDuplicates: true,
  });
}

async function seedCheckoutHolds(ctx: DynamicSeedContext) {
  const holdPaymentRows: Prisma.PaymentCreateManyInput[] = [];
  const holdRows: Prisma.CommerceCheckoutHoldCreateManyInput[] = [];
  const fixedScenarios = [
    {
      accountKey: 'member-pending',
      amenityId: null,
      amount: new Prisma.Decimal('799'),
      expiresAt: daysFrom(ctx.config.anchorDate, -1, 12),
      failureReason: 'PayMongo checkout expired before membership confirmation.',
      kind: CommerceCheckoutHoldKind.monthly,
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
      kind: CommerceCheckoutHoldKind.monthly,
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
      paymentStatus: PaymentStatus.failed,
      scheduledAt: null,
      status: CommerceCheckoutHoldStatus.failed,
    },
    {
      accountKey: 'member-checkout-abandoned',
      amenityId: null,
      amount: new Prisma.Decimal('1999'),
      expiresAt: daysFrom(ctx.config.anchorDate, -3, 12),
      failureReason: 'PayMongo authorization failed; no membership product was created.',
      kind: CommerceCheckoutHoldKind.subscription,
      paymentStatus: PaymentStatus.failed,
      scheduledAt: null,
      status: CommerceCheckoutHoldStatus.failed,
    },
  ];
  const fixedScenarioKeys = new Set(
    fixedScenarios.map((scenario) => scenario.accountKey),
  );
  const generatedScenarios = ctx.state.restrictedMemberKeys
    .filter((accountKey) => !fixedScenarioKeys.has(accountKey))
    .map((accountKey, index) => {
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
        kind:
          index % 2 === 0
            ? CommerceCheckoutHoldKind.monthly
            : CommerceCheckoutHoldKind.one_time,
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
    holdPaymentRows.push({
      id: paymentId,
      amount: scenario.amount,
      created_at: createdAt,
      gateway_event_id: null,
      gateway_metadata: {
        accountKey: scenario.accountKey,
        source: 'checkout-hold',
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
      payment_id: paymentId,
      scheduled_at: scenario.scheduledAt,
      ends_at: null,
      duration_minutes: null,
      amount: scenario.amount,
      currency: 'PHP',
      session_count: scenario.kind === CommerceCheckoutHoldKind.monthly ? 4 : null,
      start_date: scenario.kind === CommerceCheckoutHoldKind.monthly
        ? daysFrom(ctx.config.anchorDate, 7)
        : null,
      end_date: scenario.kind === CommerceCheckoutHoldKind.monthly
        ? daysFrom(ctx.config.anchorDate, 37)
        : null,
      preferred_days: scenario.kind === CommerceCheckoutHoldKind.monthly ? [1, 3] : [],
      preferred_time: scenario.kind === CommerceCheckoutHoldKind.monthly
        ? fixedTime('18:00:00')
        : null,
      member_notes: 'Seeded checkout intent used to exercise terminal and active hold reconciliation.',
      expires_at: scenario.expiresAt,
      consumed_at: null,
      released_at: null,
      failure_reason: scenario.failureReason,
      appointment_id: null,
      booking_id: null,
      subscription_id: null,
      membership_card_id: null,
      recurring_plan_id: null,
      membership_plan_id: null,
      created_at: createdAt,
    });
  }

  await ctx.prisma.payment.createMany({
    data: holdPaymentRows,
    skipDuplicates: true,
  });
  await ctx.prisma.commerceCheckoutHold.createMany({
    data: holdRows,
    skipDuplicates: true,
  });
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
  ctx.notableIds.boxingRingAmenityId = seedId('amenity:boxing-ring');
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
