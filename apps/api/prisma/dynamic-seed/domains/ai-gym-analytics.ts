import {
  ChatContext,
  ChatRole,
  EquipmentStatus,
  GymChatRole,
  GymFaqCategory,
  InsightFocus,
  InsightPeriod,
  InteractionType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { seedId } from '../ids';
import { dateOnly, daysFrom, fixedTime } from '../time';
import type { DynamicSeedContext } from '../types';
import { activityDateFor, memberVolumeCount } from '../volumes';

const GYM_EQUIPMENT = [
  [
    'rack-1',
    'Power Rack 1',
    'rack',
    'floor-1',
    2,
    2,
    140,
    110,
    EquipmentStatus.available,
  ],
  [
    'rack-2',
    'Power Rack 2',
    'rack',
    'floor-1',
    4,
    2,
    260,
    110,
    EquipmentStatus.occupied,
  ],
  [
    'bench-1',
    'Flat Bench 1',
    'bench',
    'floor-1',
    3,
    4,
    210,
    250,
    EquipmentStatus.available,
  ],
  [
    'treadmill-1',
    'Treadmill 1',
    'cardio',
    'floor-2',
    2,
    1,
    120,
    80,
    EquipmentStatus.available,
  ],
  [
    'bike-1',
    'Air Bike 1',
    'cardio',
    'floor-2',
    4,
    1,
    260,
    90,
    EquipmentStatus.maintenance,
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
  ],
] as const;

import { pickBrodigyQuestion } from '../brodigy';
const FAQS = [
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

function seedChatDate(
  ctx: DynamicSeedContext,
  userKey: string,
  index: number,
  total: number,
  hour: number,
  minute = 0,
) {
  const account = ctx.state.accounts.find((candidate) => candidate.key === userKey);
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
  const userKeys = eligibleAccounts.flatMap((account) => {
    const turns =
      account.role === 'member'
        ? Math.floor(memberVolumeCount(ctx, account.key, 'chats') / 4)
        : 3;
    return Array.from({ length: Math.max(1, turns) }, () => account.key);
  });
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
      Math.max(1, threadCounts.get(userKey) ?? 1) * 2,
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

  await ctx.prisma.aiChatSession.createMany({
    data: sessionRows,
    skipDuplicates: true,
  });
  await ctx.prisma.aiChatMessage.createMany({
    data: messageRows,
    skipDuplicates: true,
  });
  await ctx.prisma.aiInteractionLog.createMany({
    data: interactionRows,
    skipDuplicates: true,
  });
}

async function seedNotifications(ctx: DynamicSeedContext) {
  const types = [
    NotificationType.payment_confirmed,
    NotificationType.booking_confirmed,
    NotificationType.appointment_reminder,
    NotificationType.rank_up,
    NotificationType.low_stock,
    NotificationType.subscription_expiring,
    NotificationType.system,
  ] as const;

  const notificationRows: Prisma.NotificationCreateManyInput[] = [];
  ctx.state.accounts.forEach((account, userIndex) => {
    const isMember = account.role === 'member';
    const isRestricted = ctx.state.restrictedMemberKeys.includes(account.key);
    const total = isMember
      ? Math.min(200, isRestricted ? Math.min(3, memberVolumeCount(ctx, account.key, 'notifications')) : memberVolumeCount(ctx, account.key, 'notifications'))
      : 8;
    for (let rowIndex = 0; rowIndex < total; rowIndex += 1) {
      const type = isRestricted
        ? [NotificationType.system, NotificationType.payment_failed, NotificationType.subscription_expired][rowIndex % 3]
        : types[(userIndex + rowIndex) % types.length];
      const status =
        rowIndex % 5 === 0
          ? NotificationStatus.read
          : rowIndex % 5 === 1
            ? NotificationStatus.sent
            : NotificationStatus.pending;
      const createdAt = isMember
        ? seedChatDate(ctx, account.key, rowIndex, total, 9 + (rowIndex % 8), rowIndex % 50)
        : daysFrom(ctx.config.anchorDate, -4 + (rowIndex % 3), 9 + (rowIndex % 8), rowIndex % 50);
      notificationRows.push({
        id: seedId(`notification:${account.key}:${rowIndex}`),
        body:
          type === NotificationType.low_stock
            ? 'Inventory alert: review low stock products before closing.'
            : isRestricted
              ? 'Account status update: finish verification or contact the support desk.'
              : 'Notification used for filters and badge counts.',
        channel:
          rowIndex % 3 === 2
            ? NotificationChannel.in_app
            : NotificationChannel.email,
        created_at: createdAt,
        data: { source: 'dynamic-seed', type, cohort: isMember ? ctx.state.memberCohorts[account.key] : null },
        read_at:
          status === NotificationStatus.read
            ? daysFrom(createdAt, 0, createdAt.getUTCHours() + 2, createdAt.getUTCMinutes())
            : null,
        sent_at:
          status === NotificationStatus.pending
            ? null
            : daysFrom(createdAt, 0, createdAt.getUTCHours() + 1, createdAt.getUTCMinutes()),
        status,
        title:
          type === NotificationType.low_stock
            ? 'Low stock review'
            : type === NotificationType.rank_up
              ? 'Rank progress'
              : isRestricted
                ? 'Account status update'
                : 'FitTrack update',
        type,
        user_id: ctx.state.userIds[account.key],
      });
    }
  });

  await ctx.prisma.notification.createMany({
    data: notificationRows,
    skipDuplicates: true,
  });
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
    ] = equipment;
    await ctx.prisma.gymEquipment.upsert({
      where: { id: seedId(`gym-equipment:${key}`) },
      update: {
        floor_id: floorId,
        grid_column: gridColumn,
        grid_row: gridRow,
        icon_key: type,
        is_active: true,
        name,
        position_x: new Prisma.Decimal(positionX),
        position_y: new Prisma.Decimal(positionY),
        status,
        type,
      },
      create: {
        id: seedId(`gym-equipment:${key}`),
        floor_id: floorId,
        grid_column: gridColumn,
        grid_row: gridRow,
        icon_key: type,
        is_active: true,
        name,
        position_x: new Prisma.Decimal(positionX),
        position_y: new Prisma.Decimal(positionY),
        status,
        type,
      },
    });
  }

  for (let day = 0; day < 7; day += 1) {
    await ctx.prisma.gymOperatingHour.upsert({
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
    });
  }

  await ctx.prisma.gymSpecialSchedule.createMany({
    data: [
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
    ],
    skipDuplicates: true,
  });

  await ctx.prisma.gymPromotion.createMany({
    data: [
      {
        id: seedId('promotion:premium-coaching-demo'),
        description:
          'Premium coaching member promo for the current campaign.',
        ends_at: daysFrom(ctx.config.anchorDate, 21, 23, 59),
        is_active: true,
        pricing_note: 'Free assessment on first recurring plan.',
        promo_code: 'PREMIUMQA',
        starts_at: daysFrom(ctx.config.anchorDate, -2, 0),
        title: 'Premium Coaching Demo',
      },
      {
        id: seedId('promotion:amenity-bundle'),
        description: 'Boxing ring and studio reservation promo for the current campaign.',
        ends_at: daysFrom(ctx.config.anchorDate, 10, 23, 59),
        is_active: true,
        pricing_note: '10% off two-hour amenity blocks.',
        promo_code: 'BOOKFIT',
        starts_at: daysFrom(ctx.config.anchorDate, -5, 0),
        title: 'Amenity Bundle',
      },
    ],
    skipDuplicates: true,
  });

  await ctx.prisma.gymFaqEntry.createMany({
    data: FAQS.map(([category, question, answer], index) => ({
      id: seedId(`gym-faq:${index}`),
      answer,
      category,
      is_active: true,
      keywords: question.toLowerCase().split(/\W+/).filter(Boolean),
      question,
      sort_order: index + 1,
    })),
    skipDuplicates: true,
  });
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
    const gymTurns = Math.max(1, Math.floor(Math.max(2, chatBudget - aiMessageCount) / 2));
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
        is_active: threadIndex === 0,
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
                { type: 'operating_hours', id: seedId('operating-hour:1') },
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
        grounding_payload: { sources: restricted ? ['support'] : ['operating_hours', 'faq'] },
        latency_ms: 240 + memberIndex * 8 + threadIndex,
        model_used: 'seeded-grounded-gym-chat',
        out_of_scope: false,
        request_payload: { prompt: restricted ? 'seeded onboarding question' : 'seeded gym question' },
        response_payload: { grounded: true, response: 'seeded gym answer' },
        session_id: sessionId,
        token_count: 140 + memberIndex + threadIndex,
        user_id: ctx.state.userIds[memberKey],
      });
    }
  });

  await ctx.prisma.gymChatSession.createMany({
    data: sessionRows,
    skipDuplicates: true,
  });
  await ctx.prisma.gymChatMessage.createMany({
    data: messageRows,
    skipDuplicates: true,
  });
  await ctx.prisma.gymChatInteractionLog.createMany({
    data: interactionRows,
    skipDuplicates: true,
  });
}

async function seedAuditAndAnalytics(ctx: DynamicSeedContext) {
  const adminId = ctx.state.userIds.admin;
  const staffId = ctx.state.userIds.staff;
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
  ];

  await ctx.prisma.auditLog.createMany({
    data: auditRows,
    skipDuplicates: true,
  });

  await ctx.prisma.businessInsightRun.createMany({
    data: [
      {
        id: seedId('business-insight:overview:monthly'),
        created_at: daysFrom(ctx.config.anchorDate, -1, 8),
        end_date: dateOnly(ctx.config.anchorDate, 0),
        focus: InsightFocus.overview,
        insight_payload: {
          opportunities: ['Premium coaching utilization is strong.'],
          risks: ['Pending payments need staff follow-up.'],
          summary:
            'Monthly overview with revenue, attendance, and coaching signals.',
        },
        latency_ms: 1450,
        model_used: 'seeded-business-insight',
        period: InsightPeriod.monthly,
        request_payload: { source: 'dynamic-seed', includeNarrative: true },
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
          opportunities: ['Bundle protein bars with coaching check-ins.'],
          risks: ['Low stock products should be reordered this week.'],
          summary: 'Inventory insight for admin analytics review.',
        },
        latency_ms: 1180,
        model_used: 'seeded-business-insight',
        period: InsightPeriod.weekly,
        request_payload: { source: 'dynamic-seed', includeNarrative: true },
        requested_by: adminId,
        start_date: dateOnly(ctx.config.anchorDate, -7),
        token_count: 760,
      },
    ],
    skipDuplicates: true,
  });
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
