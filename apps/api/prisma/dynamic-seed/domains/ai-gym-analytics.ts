import {
  AppointmentStatus,
  BookingStatus,
  ChatContext,
  ChatRole,
  EquipmentStatus,
  GymChatRole,
  GymFaqCategory,
  InsightFocus,
  InsightPeriod,
  InteractionType,
  MembershipCardStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  SubscriptionStatus,
  Prisma,
} from '@prisma/client';
import { seedId } from '../ids';
import { dateOnly, daysFrom, fixedTime } from '../time';
import type { DynamicSeedContext } from '../types';
import { activityDateFor, memberVolumeCount } from '../volumes';
import { buildGymEquipmentSeedUpdate } from '../../../../../packages/utils/facility-map-seed';

export const GYM_EQUIPMENT = [
  [
    'rack-1',
    'Power Rack 1',
    'rack',
    'floor-1',
    4,
    2,
    140,
    110,
    EquipmentStatus.available,
    'resistance-bands',
    'general-floor',
  ],
  [
    'rack-2',
    'Power Rack 2',
    'rack',
    'floor-1',
    5,
    2,
    260,
    110,
    EquipmentStatus.occupied,
    'resistance-bands',
    'general-floor',
  ],
  [
    'bench-1',
    'Flat Bench 1',
    'bench',
    'floor-1',
    4,
    3,
    210,
    250,
    EquipmentStatus.available,
    'foam-rollers',
    'general-floor',
  ],
  [
    'treadmill-1',
    'Treadmill 1',
    'cardio',
    'floor-2',
    3,
    3,
    120,
    80,
    EquipmentStatus.available,
    'jump-ropes',
    'boxing-ring',
  ],
  [
    'bike-1',
    'Air Bike 1',
    'cardio',
    'floor-2',
    4,
    3,
    260,
    90,
    EquipmentStatus.maintenance,
    'boxing-gloves',
    'boxing-ring',
  ],
  [
    'cable-1',
    'Cable Station',
    'cable',
    'floor-1',
    7,
    3,
    420,
    220,
    EquipmentStatus.available,
    'resistance-bands',
    'general-floor',
  ],
] as const;

import { pickBrodigyQuestion } from '../brodigy';
export const FAQS = [
  [
    GymFaqCategory.hours,
    'What time does the gym open?',
    'Regular seeded hours are 6 AM to 10 PM on weekdays.',
  ],
  [
    GymFaqCategory.membership,
    'How do I verify my membership card?',
    'Upload proof or pay cash at the desk, then staff can verify the card.',
  ],
  [
    GymFaqCategory.coaching,
    'Can I book a recurring coach?',
    'Premium members can create weekly or biweekly recurring coaching plans.',
  ],
  [
    GymFaqCategory.amenities,
    'Can I reserve the boxing ring?',
    'Yes. The boxing ring supports paid reservations and optional coach assignment.',
  ],
  [
    GymFaqCategory.nutrition,
    'Can the AI help with macros?',
    'The AI can explain seeded macro targets using your current profile data.',
  ],
] as const;

export function shouldSeedCanonicalOperatingHour(
  mode: 'additive' | 'reset',
  exists: boolean,
) {
  return mode === 'reset' || !exists;
}

function seedChatDate(
  ctx: DynamicSeedContext,
  userKey: string,
  index: number,
  total: number,
  hour: number,
  minute = 0,
) {
  const account = ctx.state.accounts.find(
    (candidate) => candidate.key === userKey,
  );
  if (account?.role === 'member') {
    return (
      activityDateFor(ctx, userKey, index, total, hour, minute) ??
      daysFrom(ctx.config.anchorDate, -1, hour, minute)
    );
  }
  return daysFrom(ctx.config.anchorDate, -4 + (index % 3), hour, minute);
}

async function seedAiChat(ctx: DynamicSeedContext) {
  const eligibleAccounts = ctx.state.accounts.filter(
    (account) =>
      account.role !== 'member' ||
      !ctx.state.restrictedMemberKeys.includes(account.key),
  );
  const threadCountByUser = new Map(
    eligibleAccounts.map((account) => [
      account.key,
      account.role === 'member'
        ? Math.max(
            1,
            Math.floor(memberVolumeCount(ctx, account.key, 'chats') / 4),
          )
        : 3,
    ]),
  );
  const userKeys = eligibleAccounts.flatMap((account) =>
    Array.from(
      { length: threadCountByUser.get(account.key) ?? 1 },
      () => account.key,
    ),
  );
  const threadCounts = new Map<string, number>();
  const sessionRows: Prisma.AiChatSessionCreateManyInput[] = [];
  const messageRows: Prisma.AiChatMessageCreateManyInput[] = [];
  const interactionRows: Prisma.AiInteractionLogCreateManyInput[] = [];

  userKeys.forEach((userKey, index) => {
    const threadIndex = threadCounts.get(userKey) ?? 0;
    threadCounts.set(userKey, threadIndex + 1);
    const userId = ctx.state.userIds[userKey];
    const question = pickBrodigyQuestion(ctx.rng);
    const context =
      index % 3 === 0
        ? ChatContext.training_plan
        : index % 3 === 1
          ? ChatContext.nutrition
          : ChatContext.general;
    const sessionId = seedId(
      'ai-session:' + userKey + ':' + context + ':' + threadIndex,
    );
    const userMessageAt = seedChatDate(
      ctx,
      userKey,
      threadIndex * 2,
      Math.max(1, (threadCountByUser.get(userKey) ?? 1) * 2),
      18,
      index % 50,
    );
    const assistantMessageAt = daysFrom(
      userMessageAt,
      0,
      userMessageAt.getUTCHours(),
      userMessageAt.getUTCMinutes() + 2,
    );
    sessionRows.push({
      id: sessionId,
      context_type: context,
      created_at: userMessageAt,
      is_active: threadIndex === 0,
      last_activity_at: assistantMessageAt,
      title:
        context === ChatContext.training_plan
          ? 'Training block check-in'
          : context === ChatContext.nutrition
            ? 'Macro adjustment'
            : 'Gym guidance',
      user_id: userId,
    });
    sessionRows[sessionRows.length - 1].is_active =
      threadIndex === (threadCountByUser.get(userKey) ?? 1) - 1 &&
      assistantMessageAt >= daysFrom(ctx.config.anchorDate, -30, 0);

    messageRows.push(
      {
        id: seedId('ai-message:' + userKey + ':' + threadIndex + ':user'),
        action_triggered:
          context === ChatContext.nutrition ? 'nutrition_review' : null,
        content: question.prompt,
        created_at: userMessageAt,
        role: ChatRole.user,
        session_id: sessionId,
      },
      {
        id: seedId('ai-message:' + userKey + ':' + threadIndex + ':assistant'),
        action_triggered:
          context === ChatContext.training_plan ? 'plan_adjustment' : null,
        content: question.answer,
        created_at: assistantMessageAt,
        role: ChatRole.assistant,
        session_id: sessionId,
      },
    );
    interactionRows.push({
      id: seedId('ai-interaction:' + userKey + ':' + threadIndex),
      action_result: { status: 'seeded', applied: index % 2 === 0 },
      action_triggered:
        context === ChatContext.training_plan ? 'plan_adjustment' : null,
      created_at: daysFrom(
        assistantMessageAt,
        0,
        assistantMessageAt.getUTCHours(),
        assistantMessageAt.getUTCMinutes() + 1,
      ),
      interaction_type:
        context === ChatContext.training_plan
          ? InteractionType.plan_generation
          : context === ChatContext.nutrition
            ? InteractionType.tdee_adjustment
            : InteractionType.chat,
      latency_ms: 580 + index * 13,
      model_used: 'seeded-local-simulator',
      request_payload: {
        category: question.category,
        prompt: question.prompt,
        source: 'dynamic-seed',
      },
      response_payload: {
        answer: question.answer,
        category: question.category,
        grounded: true,
      },
      session_id: sessionId,
      token_count: 420 + index * 4,
      user_id: userId,
    });
  });

  for (const row of sessionRows) {
    const existingActive = await ctx.prisma.aiChatSession.findFirst({
      where: {
        context_type: row.context_type,
        is_active: true,
        user_id: row.user_id,
      },
      select: { id: true },
    });
    const canActivate =
      row.is_active === true &&
      (!existingActive ||
        existingActive.id === row.id ||
        ctx.config.mode === 'reset');
    await ctx.prisma.aiChatSession.upsert({
      where: { id: row.id },
      update: { ...row, is_active: canActivate },
      create: { ...row, is_active: canActivate },
    });
  }
  for (const row of messageRows) {
    await ctx.prisma.aiChatMessage.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
  for (const row of interactionRows) {
    await ctx.prisma.aiInteractionLog.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

async function seedNotifications(ctx: DynamicSeedContext) {
  type NotificationEvent = {
    body: string;
    eventAt: Date;
    eventId: string;
    source: string;
    title: string;
    type: NotificationType;
    userId: string;
  };
  const seededUserIds = ctx.state.accounts.map(
    (account) => ctx.state.userIds[account.key],
  );
  const accountByUserId = new Map(
    ctx.state.accounts.map((account) => [
      ctx.state.userIds[account.key],
      account,
    ]),
  );
  const [
    payments,
    bookings,
    appointments,
    subscriptions,
    cards,
    standings,
    milestones,
    products,
  ] = await Promise.all([
    ctx.prisma.payment.findMany({
      where: { user_id: { in: seededUserIds } },
      select: {
        amount: true,
        id: true,
        payable_type: true,
        status: true,
        user_id: true,
        created_at: true,
      },
    }),
    ctx.prisma.amenityBooking.findMany({
      where: { user_id: { in: seededUserIds } },
      select: {
        id: true,
        starts_at: true,
        status: true,
        user_id: true,
        created_at: true,
      },
    }),
    ctx.prisma.coachAppointment.findMany({
      where: { user_id: { in: seededUserIds } },
      select: {
        id: true,
        scheduled_at: true,
        status: true,
        user_id: true,
        created_at: true,
      },
    }),
    ctx.prisma.subscription.findMany({
      where: { user_id: { in: seededUserIds } },
      select: {
        expires_at: true,
        id: true,
        status: true,
        user_id: true,
        created_at: true,
      },
    }),
    ctx.prisma.membershipCard.findMany({
      where: { user_id: { in: seededUserIds } },
      select: { id: true, purchased_at: true, status: true, user_id: true },
    }),
    ctx.prisma.seasonalStanding.findMany({
      where: { user_id: { in: seededUserIds } },
      select: {
        id: true,
        last_earned_at: true,
        rank_position: true,
        user_id: true,
      },
    }),
    ctx.prisma.userMilestoneProgress.findMany({
      where: { user_id: { in: seededUserIds } },
      select: { id: true, status: true, unlocked_at: true, user_id: true },
    }),
    ctx.prisma.retailProduct.findMany({
      select: {
        id: true,
        name: true,
        reorder_threshold: true,
        stock_quantity: true,
      },
    }),
  ]);

  // Older seed revisions used notification:${account}:${index} ids and
  // intentionally left pending rows behind. Reconcile only those canonical
  // ids so additive/user-created notifications remain untouched.
  const legacyNotificationIds = ctx.state.accounts.flatMap((account) => {
    const isMember = account.role === 'member';
    return Array.from({ length: isMember ? 200 : 8 }, (_, rowIndex) =>
      seedId(`notification:${account.key}:${rowIndex}`),
    );
  });
  const legacyNotifications = await ctx.prisma.notification.findMany({
    where: {
      id: { in: legacyNotificationIds },
      user_id: { in: seededUserIds },
    },
    select: { created_at: true, id: true },
  });
  const anchorTime = ctx.config.anchorDate.getTime();
  for (const legacy of legacyNotifications) {
    const createdAt =
      legacy.created_at.getTime() <= anchorTime
        ? legacy.created_at
        : new Date(anchorTime - 60_000);
    await ctx.prisma.notification.update({
      where: { id: legacy.id },
      data: {
        created_at: createdAt,
        data: {
          legacy_seed: true,
          reconciled_at: ctx.config.anchorDate.toISOString(),
          source: 'dynamic-seed-legacy',
        },
        read_at: createdAt,
        sent_at: createdAt,
        status: NotificationStatus.read,
      },
    });
  }

  const events: NotificationEvent[] = [];
  const addEvent = (event: NotificationEvent) => {
    const account = accountByUserId.get(event.userId);
    const restricted =
      account?.role === 'member' &&
      ctx.state.restrictedMemberKeys.includes(account.key);
    if (restricted && event.source !== 'account') return;
    events.push(event);
  };
  for (const payment of payments) {
    if (
      payment.status !== PaymentStatus.completed &&
      payment.status !== PaymentStatus.failed
    ) {
      continue;
    }
    const failed = payment.status === PaymentStatus.failed;
    addEvent({
      body: failed
        ? 'Your payment attempt could not be completed. Contact the support desk if you need help.'
        : 'Your payment was completed successfully.',
      eventAt: payment.created_at,
      eventId: payment.id,
      source: 'payment',
      title: failed ? 'Payment failed' : 'Payment confirmed',
      type: failed
        ? NotificationType.payment_failed
        : NotificationType.payment_confirmed,
      userId: payment.user_id,
    });
  }
  for (const booking of bookings) {
    const type =
      booking.status === BookingStatus.confirmed
        ? NotificationType.booking_confirmed
        : booking.status === BookingStatus.cancelled
          ? NotificationType.booking_cancelled
          : booking.status === BookingStatus.no_show
            ? NotificationType.booking_no_show
            : null;
    if (!type) continue;
    addEvent({
      body:
        type === NotificationType.booking_confirmed
          ? 'Your venue booking is confirmed.'
          : type === NotificationType.booking_cancelled
            ? 'Your venue booking was cancelled.'
            : 'Your venue booking was recorded as a no-show.',
      eventAt: booking.created_at,
      eventId: booking.id,
      source: 'booking',
      title:
        type === NotificationType.booking_confirmed
          ? 'Booking confirmed'
          : type === NotificationType.booking_cancelled
            ? 'Booking cancelled'
            : 'Booking no-show',
      type,
      userId: booking.user_id,
    });
    if (
      type === NotificationType.booking_confirmed &&
      booking.starts_at >= ctx.config.anchorDate &&
      booking.starts_at.getTime() - ctx.config.anchorDate.getTime() <=
        7 * 86_400_000
    ) {
      addEvent({
        body: 'Your confirmed venue booking is coming up soon.',
        eventAt: daysFrom(booking.starts_at, -1, 9),
        eventId: `${booking.id}:reminder`,
        source: 'booking-reminder',
        title: 'Booking reminder',
        type: NotificationType.booking_reminder,
        userId: booking.user_id,
      });
    }
  }
  for (const appointment of appointments) {
    const type =
      appointment.status === AppointmentStatus.confirmed
        ? NotificationType.appointment_confirmed
        : appointment.status === AppointmentStatus.completed
          ? NotificationType.appointment_completed
          : appointment.status === AppointmentStatus.cancelled
            ? NotificationType.appointment_cancelled
            : appointment.status === AppointmentStatus.no_show
              ? NotificationType.system
              : null;
    if (!type) continue;
    addEvent({
      body:
        type === NotificationType.appointment_confirmed
          ? 'Your coaching appointment is confirmed.'
          : type === NotificationType.appointment_completed
            ? 'Your coaching appointment was completed.'
            : type === NotificationType.appointment_cancelled
              ? 'Your coaching appointment was cancelled.'
              : 'Your coaching appointment was recorded as a no-show.',
      eventAt: appointment.created_at,
      eventId: appointment.id,
      source: 'appointment',
      title:
        type === NotificationType.system
          ? 'Appointment update'
          : type === NotificationType.appointment_confirmed
            ? 'Appointment confirmed'
            : type === NotificationType.appointment_completed
              ? 'Appointment completed'
              : 'Appointment cancelled',
      type,
      userId: appointment.user_id,
    });
    if (
      type === NotificationType.appointment_confirmed &&
      appointment.scheduled_at >= ctx.config.anchorDate &&
      appointment.scheduled_at.getTime() - ctx.config.anchorDate.getTime() <=
        7 * 86_400_000
    ) {
      addEvent({
        body: 'Your confirmed coaching appointment is coming up soon.',
        eventAt: daysFrom(appointment.scheduled_at, -1, 9),
        eventId: `${appointment.id}:reminder`,
        source: 'appointment-reminder',
        title: 'Appointment reminder',
        type: NotificationType.appointment_reminder,
        userId: appointment.user_id,
      });
    }
  }
  for (const subscription of subscriptions) {
    if (subscription.status === SubscriptionStatus.expired) {
      addEvent({
        body: 'Your membership subscription has expired. Review membership options to restore access.',
        eventAt: subscription.expires_at ?? subscription.created_at,
        eventId: subscription.id,
        source: 'membership',
        title: 'Subscription expired',
        type: NotificationType.subscription_expired,
        userId: subscription.user_id,
      });
    } else if (
      subscription.expires_at &&
      subscription.expires_at >= ctx.config.anchorDate &&
      subscription.expires_at.getTime() - ctx.config.anchorDate.getTime() <=
        7 * 86_400_000
    ) {
      addEvent({
        body: 'Your membership subscription expires soon. Review renewal options.',
        eventAt: daysFrom(subscription.expires_at, -3, 9),
        eventId: `${subscription.id}:expiring`,
        source: 'membership',
        title: 'Subscription expiring',
        type: NotificationType.subscription_expiring,
        userId: subscription.user_id,
      });
    }
  }
  for (const card of cards) {
    if (card.status === MembershipCardStatus.revoked) {
      addEvent({
        body: 'Your membership QR card is no longer active. Contact staff for assistance.',
        eventAt: card.purchased_at,
        eventId: card.id,
        source: 'account',
        title: 'Membership card update',
        type: NotificationType.system,
        userId: card.user_id,
      });
    }
  }
  for (const standing of standings) {
    if (!standing.rank_position || standing.rank_position > 3) continue;
    addEvent({
      body: `Your seeded ranking position is ${standing.rank_position}.`,
      eventAt:
        standing.last_earned_at ?? daysFrom(ctx.config.anchorDate, -2, 9),
      eventId: standing.id,
      source: 'rank',
      title: 'Rank progress',
      type: NotificationType.rank_up,
      userId: standing.user_id,
    });
  }
  for (const milestone of milestones) {
    if (milestone.status !== 'unlocked' && milestone.status !== 'claimed')
      continue;
    addEvent({
      body:
        milestone.status === 'claimed'
          ? 'A seeded milestone reward was claimed.'
          : 'A seeded milestone has been unlocked.',
      eventAt: milestone.unlocked_at ?? daysFrom(ctx.config.anchorDate, -2, 9),
      eventId: milestone.id,
      source: 'milestone',
      title:
        milestone.status === 'claimed'
          ? 'Milestone reward'
          : 'Milestone unlocked',
      type: NotificationType.system,
      userId: milestone.user_id,
    });
  }
  for (const product of products) {
    if (product.stock_quantity > product.reorder_threshold) continue;
    for (const staffKey of [...ctx.state.adminKeys, ...ctx.state.staffKeys]) {
      addEvent({
        body: `${product.name} is at ${product.stock_quantity} units, at or below the reorder threshold.`,
        eventAt: daysFrom(ctx.config.anchorDate, -1, 8),
        eventId: product.id,
        source: 'stock',
        title: 'Low stock review',
        type: NotificationType.low_stock,
        userId: ctx.state.userIds[staffKey],
      });
    }
  }
  for (const account of ctx.state.accounts) {
    if (!ctx.state.restrictedMemberKeys.includes(account.key)) continue;
    addEvent({
      body: 'Account status update: complete verification or contact the support desk.',
      eventAt:
        account.lifecycle?.registeredAt ??
        daysFrom(ctx.config.anchorDate, -2, 9),
      eventId: account.key,
      source: 'account',
      title: 'Account status update',
      type: NotificationType.system,
      userId: ctx.state.userIds[account.key],
    });
  }

  const anchor = ctx.config.anchorDate.getTime();
  const clampToAnchor = (value: Date) =>
    value.getTime() > anchor - 60_000 ? new Date(anchor - 60_000) : value;
  events.sort((left, right) =>
    `${left.source}:${left.eventId}:${left.userId}`.localeCompare(
      `${right.source}:${right.eventId}:${right.userId}`,
    ),
  );
  for (const [index, event] of events.entries()) {
    const createdAt = clampToAnchor(event.eventAt);
    const sentAt = clampToAnchor(
      new Date(Math.min(anchor, createdAt.getTime() + 15 * 60_000)),
    );
    const isRead = index % 4 === 0;
    const readAt = isRead
      ? clampToAnchor(
          new Date(Math.min(anchor, sentAt.getTime() + 30 * 60_000)),
        )
      : null;
    const row: Prisma.NotificationCreateManyInput = {
      body: event.body,
      channel:
        index % 3 === 2
          ? NotificationChannel.in_app
          : NotificationChannel.email,
      created_at: createdAt,
      data: {
        event_id: event.eventId,
        event_source: event.source,
        source: 'dynamic-seed',
      },
      dedupe_key: `dynamic-seed:${event.source}:${event.eventId}:${event.userId}`,
      id: seedId(
        `notification:event:${event.source}:${event.eventId}:${event.userId}`,
      ),
      read_at: readAt,
      sent_at: sentAt,
      status: isRead ? NotificationStatus.read : NotificationStatus.sent,
      title: event.title,
      type: event.type,
      user_id: event.userId,
    };
    await ctx.prisma.notification.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

async function seedGymLayoutAndKnowledge(ctx: DynamicSeedContext) {
  for (const equipment of GYM_EQUIPMENT) {
    const [
      key,
      name,
      type,
      floorId,
      gridColumn,
      gridRow,
      positionX,
      positionY,
      status,
      inventoryItemKey,
      venueKey,
    ] = equipment;
    const desiredId = seedId(`gym-equipment:${key}`);
    const [existingById, existingByName] = await Promise.all([
      ctx.prisma.gymEquipment.findUnique({
        where: { id: desiredId },
        select: { id: true },
      }),
      ctx.prisma.gymEquipment.findFirst({
        where: { name },
        orderBy: { created_at: 'asc' },
        select: { id: true },
      }),
    ]);
    const data = {
      floor_id: floorId,
      grid_column: gridColumn,
      grid_row: gridRow,
      grid_width: 1,
      grid_height: 1,
      icon_key: type,
      inventory_item_id: seedId(`equipment-item:${inventoryItemKey}`),
      is_active: true,
      name,
      position_x: new Prisma.Decimal(positionX),
      position_y: new Prisma.Decimal(positionY),
      status,
      type,
      venue_id:
        ctx.state.amenityIds[venueKey] ?? seedId(`amenity:${venueKey}`),
    };
    const existing = existingById ?? existingByName;
    if (existing) {
      await ctx.prisma.gymEquipment.update({
        where: { id: existing.id },
        data: buildGymEquipmentSeedUpdate(ctx.config.mode, data),
      });
    } else {
      await ctx.prisma.gymEquipment.create({
        data: { id: desiredId, ...data },
      });
    }
  }

  for (let day = 0; day < 7; day += 1) {
    const existing = await ctx.prisma.gymOperatingHour.findUnique({
      where: { day_of_week: day },
      select: { id: true },
    });
    let persisted = existing;
    if (shouldSeedCanonicalOperatingHour(ctx.config.mode, Boolean(existing))) {
      persisted = await ctx.prisma.gymOperatingHour.upsert({
        where: { day_of_week: day },
        update: {
          closes_at: fixedTime(day === 0 ? '18:00:00' : '22:00:00'),
          is_active: true,
          is_closed: false,
          label: day === 0 ? 'Sunday short day' : 'Regular seeded hours',
          opens_at: fixedTime(day === 0 ? '08:00:00' : '06:00:00'),
        },
        create: {
          id: seedId(`operating-hour:${day}`),
          closes_at: fixedTime(day === 0 ? '18:00:00' : '22:00:00'),
          day_of_week: day,
          is_active: true,
          is_closed: false,
          label: day === 0 ? 'Sunday short day' : 'Regular seeded hours',
          opens_at: fixedTime(day === 0 ? '08:00:00' : '06:00:00'),
        },
        select: { id: true },
      });
    }
    if (persisted) {
      ctx.state.operatingHourIds[String(day)] = persisted.id;
    }
  }

  const specialSchedules = [
    {
      id: seedId('special-schedule:maintenance-history'),
      closes_at: fixedTime('18:00:00'),
      ends_on: dateOnly(ctx.config.anchorDate, -45),
      is_active: false,
      is_closed: false,
      opens_at: fixedTime('10:00:00'),
      pricing_note: 'Historical maintenance window; normal hours restored.',
      reason: 'Quarterly equipment maintenance (completed)',
      starts_on: dateOnly(ctx.config.anchorDate, -45),
    },
    {
      id: seedId('special-schedule:maintenance-night'),
      closes_at: fixedTime('18:00:00'),
      ends_on: dateOnly(ctx.config.anchorDate, 14),
      is_active: true,
      is_closed: false,
      opens_at: fixedTime('08:00:00'),
      pricing_note: 'Off-peak booking discount after maintenance window.',
      reason: 'Quarterly equipment maintenance',
      starts_on: dateOnly(ctx.config.anchorDate, 14),
    },
    {
      id: seedId('special-schedule:holiday'),
      closes_at: null,
      ends_on: dateOnly(ctx.config.anchorDate, 32),
      is_active: true,
      is_closed: true,
      opens_at: null,
      pricing_note: null,
      reason: 'Local holiday closure',
      starts_on: dateOnly(ctx.config.anchorDate, 32),
    },
  ];
  for (const schedule of specialSchedules) {
    await ctx.prisma.gymSpecialSchedule.upsert({
      where: { id: schedule.id },
      update: schedule,
      create: schedule,
    });
  }

  const promotions = [
    {
      id: seedId('promotion:premium-coaching-demo'),
      description: 'Premium coaching member promo for the current campaign.',
      ends_at: daysFrom(ctx.config.anchorDate, 21, 23, 59),
      is_active: true,
      pricing_note: 'Free assessment on first recurring plan.',
      promo_code: 'PREMIUMQA',
      starts_at: daysFrom(ctx.config.anchorDate, -2, 0),
      title: 'Premium Coaching Demo',
    },
    {
      id: seedId('promotion:amenity-bundle'),
      description:
        'Boxing ring and studio reservation promo for the upcoming campaign.',
      ends_at: daysFrom(ctx.config.anchorDate, 10, 23, 59),
      is_active: true,
      pricing_note: '10% off two-hour amenity blocks.',
      promo_code: 'BOOKFIT',
      starts_at: daysFrom(ctx.config.anchorDate, 3, 0),
      title: 'Amenity Bundle',
    },
    {
      id: seedId('promotion:expired-starter'),
      description: 'Expired starter offer retained for historical analytics.',
      ends_at: daysFrom(ctx.config.anchorDate, -10, 23, 59),
      is_active: false,
      pricing_note: 'Historical campaign only.',
      promo_code: 'STARTERHISTORY',
      starts_at: daysFrom(ctx.config.anchorDate, -30, 0),
      title: 'Starter History',
    },
  ];
  for (const promotion of promotions) {
    await ctx.prisma.gymPromotion.upsert({
      where: { id: promotion.id },
      update: promotion,
      create: promotion,
    });
  }

  for (const [category, question, answer] of FAQS) {
    const index = FAQS.findIndex((candidate) => candidate[1] === question);
    const resolvedAnswer =
      category === GymFaqCategory.membership
        ? 'Purchase the membership card with PayMongo or full cash payment, then staff can verify the QR card.'
        : answer;
    const row = {
      id: seedId(`gym-faq:${index}`),
      answer: resolvedAnswer,
      category,
      is_active: true,
      keywords: question.toLowerCase().split(/\W+/).filter(Boolean),
      question,
      sort_order: index + 1,
    };
    await ctx.prisma.gymFaqEntry.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

async function seedGymChat(ctx: DynamicSeedContext) {
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
    ...ctx.state.restrictedMemberKeys,
  ];
  const sessionRows: Prisma.GymChatSessionCreateManyInput[] = [];
  const messageRows: Prisma.GymChatMessageCreateManyInput[] = [];
  const interactionRows: Prisma.GymChatInteractionLogCreateManyInput[] = [];

  memberKeys.forEach((memberKey, memberIndex) => {
    const chatBudget = memberVolumeCount(ctx, memberKey, 'chats');
    const aiMessageCount = ctx.state.restrictedMemberKeys.includes(memberKey)
      ? 0
      : Math.floor(chatBudget / 4) * 2;
    const gymTurns = Math.max(
      1,
      Math.floor(Math.max(2, chatBudget - aiMessageCount) / 2),
    );
    for (let threadIndex = 0; threadIndex < gymTurns; threadIndex += 1) {
      const sessionId = seedId(`gym-chat-session:${memberKey}:${threadIndex}`);
      const userMessageAt = seedChatDate(
        ctx,
        memberKey,
        threadIndex * 2,
        Math.max(2, gymTurns * 2),
        12 + (threadIndex % 6),
        memberIndex % 50,
      );
      const assistantMessageAt = daysFrom(
        userMessageAt,
        0,
        userMessageAt.getUTCHours(),
        userMessageAt.getUTCMinutes() + 1,
      );
      sessionRows.push({
        id: sessionId,
        created_at: userMessageAt,
        is_active:
          threadIndex === gymTurns - 1 &&
          assistantMessageAt >= daysFrom(ctx.config.anchorDate, -30, 0),
        last_activity_at: assistantMessageAt,
        title: 'Gym policy and schedule help',
        user_id: ctx.state.userIds[memberKey],
      });
      const restricted = ctx.state.restrictedMemberKeys.includes(memberKey);
      messageRows.push(
        {
          id: seedId(`gym-chat-message:${memberKey}:${threadIndex}:user`),
          content: restricted
            ? 'How do I finish account verification?'
            : threadIndex % 2 === 0
              ? 'What are today hours?'
              : 'Can I book the boxing ring?',
          created_at: userMessageAt,
          grounded_sources: Prisma.JsonNull,
          out_of_scope: false,
          role: GymChatRole.user,
          session_id: sessionId,
        },
        {
          id: seedId(`gym-chat-message:${memberKey}:${threadIndex}:assistant`),
          content: restricted
            ? 'Please complete verification or contact the support desk for help with onboarding.'
            : 'Check operating hours and amenity availability from FitTrack gym content.',
          created_at: assistantMessageAt,
          grounded_sources: restricted
            ? [{ type: 'support', id: seedId('gym-faq:1') }]
            : [
                {
                  type: 'operating_hours',
                  id:
                    ctx.state.operatingHourIds['1'] ??
                    seedId('operating-hour:1'),
                },
                { type: 'faq', id: seedId('gym-faq:3') },
              ],
          out_of_scope: false,
          role: GymChatRole.assistant,
          session_id: sessionId,
        },
      );
      interactionRows.push({
        id: seedId(`gym-chat-interaction:${memberKey}:${threadIndex}`),
        created_at: daysFrom(
          assistantMessageAt,
          0,
          assistantMessageAt.getUTCHours(),
          assistantMessageAt.getUTCMinutes() + 1,
        ),
        grounding_payload: {
          sources: restricted ? ['support'] : ['operating_hours', 'faq'],
        },
        latency_ms: 240 + memberIndex * 8 + threadIndex,
        model_used: 'seeded-grounded-gym-chat',
        out_of_scope: false,
        request_payload: {
          prompt: restricted
            ? 'seeded onboarding question'
            : 'seeded gym question',
        },
        response_payload: { grounded: true, response: 'seeded gym answer' },
        session_id: sessionId,
        token_count: 140 + memberIndex + threadIndex,
        user_id: ctx.state.userIds[memberKey],
      });
    }
  });

  for (const row of sessionRows) {
    const existingActive = await ctx.prisma.gymChatSession.findFirst({
      where: { is_active: true, user_id: row.user_id },
      select: { id: true },
    });
    const canActivate =
      row.is_active === true &&
      (!existingActive ||
        existingActive.id === row.id ||
        ctx.config.mode === 'reset');
    await ctx.prisma.gymChatSession.upsert({
      where: { id: row.id },
      update: { ...row, is_active: canActivate },
      create: { ...row, is_active: canActivate },
    });
  }
  for (const row of messageRows) {
    await ctx.prisma.gymChatMessage.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
  for (const row of interactionRows) {
    await ctx.prisma.gymChatInteractionLog.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

async function seedAuditAndAnalytics(ctx: DynamicSeedContext) {
  const adminId = ctx.state.userIds.admin;
  const staffId = ctx.state.userIds.staff;
  const [
    completedPayments,
    completedSales,
    saleItems,
    completedAppointments,
    completedBookings,
    attendance,
    products,
  ] = await Promise.all([
    ctx.prisma.payment.findMany({
      where: { status: PaymentStatus.completed },
      select: { amount: true, id: true, payable_type: true },
    }),
    ctx.prisma.saleTransaction.findMany({
      where: { status: 'completed' },
      select: { id: true, total_amount: true },
    }),
    ctx.prisma.saleTransactionItem.findMany({
      select: { subtotal: true, transaction_id: true },
    }),
    ctx.prisma.coachAppointment.findMany({
      where: { status: AppointmentStatus.completed },
      select: { id: true },
    }),
    ctx.prisma.amenityBooking.findMany({
      where: { status: BookingStatus.completed },
      select: { id: true },
    }),
    ctx.prisma.attendanceLog.findMany({ select: { id: true } }),
    ctx.prisma.retailProduct.findMany({
      select: {
        id: true,
        name: true,
        reorder_threshold: true,
        stock_quantity: true,
      },
    }),
  ]);
  const completedRevenue = completedPayments.reduce(
    (total, payment) => total + Number(payment.amount),
    0,
  );
  const retailRevenue = completedSales.reduce(
    (total, sale) => total + Number(sale.total_amount),
    0,
  );
  const lowStockProducts = products.filter(
    (product) => product.stock_quantity <= product.reorder_threshold,
  );
  const auditRows: Prisma.AuditLogCreateManyInput[] = [
    {
      id: seedId('audit:payment-verified:member-premium'),
      action: 'PAYMENT_VERIFIED',
      after: { status: 'completed' },
      before: { status: 'processing' },
      created_at: daysFrom(ctx.config.anchorDate, -7, 11),
      entity: 'Payment',
      entity_id: seedId('payment:subscription:member-premium:current'),
      ip_address: '127.0.0.20',
      user_id: adminId,
    },
    {
      id: seedId('audit:card-revoked:member-suspended'),
      action: 'MEMBERSHIP_CARD_REVOKED',
      after: { status: 'revoked' },
      before: { status: 'active' },
      created_at: daysFrom(ctx.config.anchorDate, -5, 15),
      entity: 'MembershipCard',
      entity_id: seedId('membership-card:member-suspended'),
      ip_address: '127.0.0.21',
      user_id: adminId,
    },
    {
      id: seedId('audit:equipment-writeoff:yoga'),
      action: 'EQUIPMENT_WRITE_OFF',
      after: { quantity_current: 32 },
      before: { quantity_current: 35 },
      created_at: daysFrom(ctx.config.anchorDate, -4, 16),
      entity: 'GymEquipmentItem',
      entity_id: seedId('equipment-item:yoga-mats'),
      ip_address: '127.0.0.22',
      user_id: staffId,
    },
    {
      id: seedId('audit:equipment-maintenance:bike-1:started'),
      action: 'EQUIPMENT_MAINTENANCE_STARTED',
      after: { status: EquipmentStatus.maintenance },
      before: { status: EquipmentStatus.available },
      created_at: daysFrom(ctx.config.anchorDate, -1, 6),
      entity: 'GymEquipment',
      entity_id: seedId('gym-equipment:bike-1'),
      ip_address: '127.0.0.23',
      user_id: staffId,
    },
    {
      id: seedId('audit:equipment-maintenance:treadmill-1:completed'),
      action: 'EQUIPMENT_MAINTENANCE_COMPLETED',
      after: { status: EquipmentStatus.available },
      before: { status: EquipmentStatus.maintenance },
      created_at: daysFrom(ctx.config.anchorDate, -12, 17),
      entity: 'GymEquipment',
      entity_id: seedId('gym-equipment:treadmill-1'),
      ip_address: '127.0.0.24',
      user_id: staffId,
    },
  ];

  for (const row of auditRows) {
    await ctx.prisma.auditLog.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }

  const insightRows: Prisma.BusinessInsightRunCreateManyInput[] = [
    {
      id: seedId('business-insight:overview:monthly'),
      created_at: daysFrom(ctx.config.anchorDate, -1, 8),
      end_date: dateOnly(ctx.config.anchorDate, 0),
      focus: InsightFocus.overview,
      insight_payload: {
        metrics: {
          completed_appointments: completedAppointments.length,
          completed_bookings: completedBookings.length,
          completed_payments: completedPayments.length,
          attendance_events: attendance.length,
          gross_payment_amount: Number(completedRevenue.toFixed(2)),
          retail_sales_amount: Number(retailRevenue.toFixed(2)),
        },
        opportunities:
          completedAppointments.length > 0
            ? [
                `${completedAppointments.length} completed coaching appointment(s) can inform retention outreach.`,
              ]
            : [
                'No completed coaching appointments were seeded for this window.',
              ],
        risks:
          lowStockProducts.length > 0
            ? [
                `${lowStockProducts.length} retail product(s) are at or below reorder threshold.`,
              ]
            : ['No retail products are below their reorder threshold.'],
        source: 'dynamic-seed',
        summary: `Seeded operations include ${completedPayments.length} completed payment event(s), ${completedBookings.length} completed venue booking(s), and ${attendance.length} attendance event(s).`,
      },
      latency_ms: 1450,
      model_used: 'seeded-business-insight',
      period: InsightPeriod.monthly,
      request_payload: {
        includeNarrative: true,
        provenance: {
          appointment_ids: completedAppointments
            .slice(0, 20)
            .map(({ id }) => id),
          booking_ids: completedBookings.slice(0, 20).map(({ id }) => id),
          payment_ids: completedPayments.slice(0, 20).map(({ id }) => id),
        },
        source: 'dynamic-seed',
      },
      requested_by: adminId,
      start_date: dateOnly(ctx.config.anchorDate, -30),
      token_count: 980,
    },
    {
      id: seedId('business-insight:inventory:weekly'),
      created_at: daysFrom(ctx.config.anchorDate, -2, 8),
      end_date: dateOnly(ctx.config.anchorDate, 0),
      focus: InsightFocus.inventory,
      insight_payload: {
        metrics: {
          low_stock_items: lowStockProducts.length,
          tracked_products: products.length,
          completed_retail_sales: completedSales.length,
          completed_retail_line_items: saleItems.length,
        },
        opportunities:
          products.length > 0
            ? [
                `Review the ${products.length} tracked retail product(s) against current sell-through.`,
              ]
            : ['No tracked retail products were seeded for this window.'],
        risks:
          lowStockProducts.length > 0
            ? lowStockProducts.map(({ name }) => `${name} needs replenishment.`)
            : ['No low-stock risk is present in the final seeded state.'],
        source: 'dynamic-seed',
        summary: `Inventory insight is derived from ${products.length} product row(s), ${completedSales.length} completed sale(s), and ${saleItems.length} sale line item(s).`,
      },
      latency_ms: 1180,
      model_used: 'seeded-business-insight',
      period: InsightPeriod.weekly,
      request_payload: {
        includeNarrative: true,
        provenance: {
          product_ids: products.slice(0, 20).map(({ id }) => id),
          sale_ids: completedSales.slice(0, 20).map(({ id }) => id),
        },
        source: 'dynamic-seed',
      },
      requested_by: adminId,
      start_date: dateOnly(ctx.config.anchorDate, -7),
      token_count: 760,
    },
  ];
  for (const row of insightRows) {
    await ctx.prisma.businessInsightRun.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

export async function seedAiGymAnalytics(ctx: DynamicSeedContext) {
  await seedAiChat(ctx);
  await seedNotifications(ctx);
  await seedGymLayoutAndKnowledge(ctx);
  await seedGymChat(ctx);
  await seedAuditAndAnalytics(ctx);

  ctx.notableIds.businessInsightOverviewId = seedId(
    'business-insight:overview:monthly',
  );
  ctx.notableIds.demoPremiumGymChatSessionId = seedId(
    'gym-chat-session:member-premium',
  );

  return {
    counts: {
      faqEntries: FAQS.length,
      gymEquipment: GYM_EQUIPMENT.length,
    },
  };
}
