import {
  AmenityType,
  AppointmentStatus,
  BookingStatus,
  CoachScheduleType,
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
        image_url: `https://fittrack.local/floor-plans/${floorId}.png`,
      },
      create: {
        floor_id: floorId,
        image_url: `https://fittrack.local/floor-plans/${floorId}.png`,
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

  const availabilityRows = ctx.state.coachAccountKeys.flatMap(
    (coachKey, coachIndex) =>
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
  const memberKeys = ctx.state.premiumMemberKeys.slice(0, 42);
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const recurringPlanRows: Prisma.RecurringCoachingPlanCreateManyInput[] = [];
  const billingRows: Prisma.RecurringCoachingBillingCycleCreateManyInput[] = [];
  const appointmentRows: Prisma.CoachAppointmentCreateManyInput[] = [];
  const relationshipRows: Prisma.CoachClientRelationshipCreateManyInput[] = [];
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];

  memberKeys.forEach((memberKey, index) => {
    const coachKey = coachKeys[index % coachKeys.length];
    const coachId = ctx.state.coachProfileIds[coachKey];
    const memberId = ctx.state.userIds[memberKey];
    const recurringPlanId = seedId(`recurring-plan:${memberKey}`);
    const amount = new Prisma.Decimal(index % 3 === 0 ? '2400' : '1800');
    const relationshipStatus =
      index % 9 === 0 ? RelationshipStatus.paused : RelationshipStatus.active;

    relationshipRows.push({
      id: seedId(`coach-relationship:${coachKey}:${memberKey}`),
      coach_id: coachId,
      created_at: daysFrom(ctx.config.anchorDate, -45 + (index % 16), 9),
      member_id: memberId,
      notes:
        relationshipStatus === RelationshipStatus.paused
          ? 'Seeded paused relationship for coach filters.'
          : 'Seeded active coaching relationship with measurable goals.',
      started_at: daysFrom(ctx.config.anchorDate, -45 + (index % 16), 9),
      status: relationshipStatus,
    });

    recurringPlanRows.push({
      id: recurringPlanId,
      coach_id: coachId,
      completed_sessions: 2 + (index % 4),
      created_by: adminId,
      duration_minutes: index % 2 === 0 ? 60 : 45,
      end_date: daysFrom(ctx.config.anchorDate, 45 + (index % 20)),
      frequency:
        index % 4 === 0
          ? RecurringCoachingFrequency.biweekly
          : RecurringCoachingFrequency.weekly,
      member_id: memberId,
      preferred_days: [1 + (index % 5), 3 + (index % 2)],
      preferred_time: fixedTime(index % 2 === 0 ? '16:00:00' : '18:00:00'),
      start_date: daysFrom(ctx.config.anchorDate, -28 + (index % 12)),
      status:
        index % 12 === 0
          ? RecurringCoachingPlanStatus.paused
          : RecurringCoachingPlanStatus.active,
      total_sessions: 8,
    });

    for (let cycleIndex = 0; cycleIndex < 2; cycleIndex += 1) {
      const cycleStart = daysFrom(
        ctx.config.anchorDate,
        -28 + cycleIndex * 28,
        0,
      );
      const billingPaymentId = seedId(
        `payment:recurring-coaching:${memberKey}:${cycleIndex}`,
      );
      billingRows.push({
        id: seedId(`recurring-cycle:${memberKey}:${cycleIndex}`),
        amount,
        cycle_end_date: daysFrom(cycleStart, 27, 0),
        cycle_start_date: cycleStart,
        due_date: daysFrom(cycleStart, 3, 0),
        grace_period_ends_at: daysFrom(cycleStart, 7, 23, 59),
        paid_at: cycleIndex === 0 ? daysFrom(cycleStart, 2, 13) : null,
        payment_id: billingPaymentId,
        recurring_plan_id: recurringPlanId,
        status:
          cycleIndex === 0
            ? RecurringCoachingBillingCycleStatus.paid
            : index % 5 === 0
              ? RecurringCoachingBillingCycleStatus.awaiting_verification
              : RecurringCoachingBillingCycleStatus.due,
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
        status:
          cycleIndex === 0
            ? PaymentStatus.completed
            : PaymentStatus.awaiting_verification,
        user_id: memberId,
        verified_at: cycleIndex === 0 ? daysFrom(cycleStart, 2, 14) : null,
        verified_by: cycleIndex === 0 ? adminId : null,
      });
    }

    for (let apptIndex = 0; apptIndex < 3; apptIndex += 1) {
      const status =
        apptIndex === 0
          ? AppointmentStatus.completed
          : apptIndex === 1
            ? AppointmentStatus.confirmed
            : index % 7 === 0
              ? AppointmentStatus.no_show
              : AppointmentStatus.pending_payment;
      const scheduledAt = daysFrom(
        ctx.config.anchorDate,
        apptIndex === 0 ? -12 - (index % 6) : 3 + index + apptIndex * 5,
        15 + (index % 4),
      );
      const appointmentId = seedId(
        `coach-appointment:${memberKey}:${apptIndex}`,
      );
      const totalAmount = new Prisma.Decimal(900 + (index % 4) * 100);

      appointmentRows.push({
        id: appointmentId,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Seeded assessment: improved hinge pattern and session adherence.'
            : null,
        balance_amount: new Prisma.Decimal(0),
        balance_paid_at:
          status === AppointmentStatus.completed
            ? daysFrom(scheduledAt, 0, scheduledAt.getHours() + 1)
            : null,
        coach_earnings: totalAmount.mul(new Prisma.Decimal('0.80')),
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member completed the prescribed block with strong pacing.'
            : null,
        coach_id: coachId,
        completed_at:
          status === AppointmentStatus.completed
            ? daysFrom(scheduledAt, 0, scheduledAt.getHours() + 1, 5)
            : null,
        downpayment_amount: new Prisma.Decimal(0),
        downpayment_paid_at:
          status === AppointmentStatus.pending_payment
            ? null
            : daysFrom(scheduledAt, -2, 10),
        duration_minutes: 60,
        gym_revenue: totalAmount.mul(new Prisma.Decimal('0.20')),
        is_free_session: false,
        member_notes:
          apptIndex === 1
            ? 'Wants extra shoulder mobility work.'
            : 'Seeded member note for coach detail QA.',
        no_show_at:
          status === AppointmentStatus.no_show
            ? daysFrom(scheduledAt, 0, scheduledAt.getHours() + 1)
            : null,
        recurring_plan_id: recurringPlanId,
        recurring_state:
          status === AppointmentStatus.completed
            ? RecurringCoachingSessionState.completed
            : RecurringCoachingSessionState.generated,
        scheduled_at: scheduledAt,
        session_notes:
          status === AppointmentStatus.completed
            ? 'Finished warm-up, main lift, and cooldown.'
            : null,
        status,
        total_amount: totalAmount,
        user_id: memberId,
      });

      if (status !== AppointmentStatus.pending_payment) {
        paymentRows.push({
          id: seedId(`payment:coach-appointment:${memberKey}:${apptIndex}`),
          amount: totalAmount,
          created_at: daysFrom(scheduledAt, -2, 10),
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
          verified_at: daysFrom(scheduledAt, -2, 11),
          verified_by: adminId,
        });
      }
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

  const completedAppointments = appointmentRows.filter(
    (appointment) => appointment.status === AppointmentStatus.completed,
  );
  await ctx.prisma.coachReview.createMany({
    data: completedAppointments.slice(0, 30).map((appointment, index) => ({
      id: seedId(`coach-review:${appointment.id as string}`),
      appointment_id: appointment.id as string,
      coach_id: appointment.coach_id,
      comment:
        index % 2 === 0
          ? 'Coach gave clear cues and adjusted the session to my energy.'
          : 'Great accountability and realistic next steps.',
      created_at: daysFrom(ctx.config.anchorDate, -10 + (index % 5), 18),
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
  const memberKeys = ctx.state.premiumMemberKeys.slice(0, 54);
  const staffId = ctx.state.userIds[ctx.state.staffKeys[0]];
  const bookingRows: Prisma.AmenityBookingCreateManyInput[] = [];
  const feedbackRows: Prisma.AmenityFeedbackCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];

  memberKeys.forEach((memberKey, index) => {
    const amenityKey = amenityKeys[index % amenityKeys.length];
    const amenity = AMENITY_SEEDS[index % AMENITY_SEEDS.length];
    const startsAt = daysFrom(
      ctx.config.anchorDate,
      index % 4 === 0 ? -10 + (index % 7) : 1 + (index % 18),
      8 + (index % 10),
    );
    const status =
      index % 11 === 0
        ? BookingStatus.pending
        : index % 9 === 0
          ? BookingStatus.no_show
          : index % 7 === 0
            ? BookingStatus.cancelled
            : index % 4 === 0
              ? BookingStatus.completed
              : index % 3 === 0
                ? BookingStatus.balance_pending
                : BookingStatus.confirmed;
    const bookingId = seedId(`amenity-booking:${memberKey}:${index}`);
    const totalAmount = new Prisma.Decimal(amenity.hourlyRate).mul(2);

    bookingRows.push({
      id: bookingId,
      amenity_id: seedId(`amenity:${amenityKey}`),
      balance_amount:
        status === BookingStatus.balance_pending
          ? totalAmount.div(2)
          : new Prisma.Decimal(0),
      balance_paid_at:
        status === BookingStatus.completed
          ? daysFrom(startsAt, 0, startsAt.getHours() + 2)
          : null,
      cancelled_at:
        status === BookingStatus.cancelled ? daysFrom(startsAt, -1, 17) : null,
      coach_id:
        amenityKey === 'boxing-ring'
          ? ctx.state.coachProfileIds[
              ctx.state.coachAccountKeys[
                index % ctx.state.coachAccountKeys.length
              ]
            ]
          : null,
      completed_at:
        status === BookingStatus.completed
          ? daysFrom(startsAt, 0, startsAt.getHours() + 2)
          : null,
      downpayment_amount: totalAmount.div(2),
      downpayment_paid_at:
        status === BookingStatus.pending ? null : daysFrom(startsAt, -2, 12),
      ends_at: daysFrom(startsAt, 0, startsAt.getHours() + 2),
      notes:
        status === BookingStatus.no_show
          ? 'Seeded no-show booking for admin filters.'
          : 'Seeded amenity booking for schedule QA.',
      starts_at: startsAt,
      status,
      total_amount: totalAmount,
      user_id: ctx.state.userIds[memberKey],
    });

    if (
      status === BookingStatus.completed ||
      status === BookingStatus.confirmed
    ) {
      feedbackRows.push({
        id: seedId(`amenity-feedback:${bookingId}`),
        amenity_id: seedId(`amenity:${amenityKey}`),
        comment:
          index % 2 === 0
            ? 'Facility was clean and staff helped us start on time.'
            : 'Smooth booking flow and helpful reminders.',
        created_at: daysFrom(startsAt, 1, 10),
        rating: 4 + (index % 2),
        user_id: ctx.state.userIds[memberKey],
      });
    }

    paymentRows.push({
      id: seedId(`payment:amenity-booking:${memberKey}:${index}`),
      amount: totalAmount.div(2),
      created_at: daysFrom(startsAt, -2, 12),
      gateway_event_id: null,
      gateway_metadata: { bookingId, source: 'amenity-booking' },
      idempotency_key: seedExternalId(
        `payment:amenity-booking:${memberKey}:${index}`,
      ),
      payable_id: bookingId,
      payable_type: PayableType.booking,
      payment_stage: PaymentStage.downpayment,
      provider:
        index % 5 === 0 ? PaymentProvider.paymongo : PaymentProvider.cash,
      provider_ref:
        index % 5 === 0
          ? seedExternalId(`paymongo:amenity-booking:${memberKey}:${index}`)
          : null,
      status:
        status === BookingStatus.cancelled || status === BookingStatus.no_show
          ? PaymentStatus.completed
          : status === BookingStatus.pending
            ? PaymentStatus.awaiting_verification
            : PaymentStatus.completed,
      user_id: ctx.state.userIds[memberKey],
      verified_at:
        status === BookingStatus.pending ? null : daysFrom(startsAt, -2, 13),
      verified_by: status === BookingStatus.pending ? null : staffId,
    });
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

export async function seedFacilitiesCoaching(ctx: DynamicSeedContext) {
  await seedAmenities(ctx);
  await seedCoachProfiles(ctx);
  await seedRelationshipsPlansAndAppointments(ctx);
  await seedAmenityBookings(ctx);

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
