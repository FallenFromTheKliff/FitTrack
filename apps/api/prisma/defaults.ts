import {
  AmenityType,
  AuthProvider,
  CreatorState,
  IntegrityRiskLevel,
  MilestoneCategory,
  MilestoneDefinitionStatus,
  MilestoneEvidenceRequirement,
  MilestoneTriggerType,
  MilestoneVerificationPolicy,
  Prisma,
  PrismaClient,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const DEFAULT_AMENITIES = [
  {
    name: 'Basketball Court',
    type: AmenityType.basketball_court,
    description:
      'Full-sized indoor basketball court with hardwood flooring and adjustable hoops.',
    capacity: 10,
    hourly_rate: new Prisma.Decimal(153),
    minimum_hours: 1,
    icon_key: 'basketball',
    grid_column: 9,
    grid_row: 1,
    grid_width: 6,
    grid_height: 4,
    is_reservable: true,
    display_order: 3,
    floor_id: 'floor-1',
    requires_subscription: false,
    is_active: true,
  },
  {
    name: 'Boxing Ring',
    type: AmenityType.boxing_ring,
    description:
      'Professional boxing ring for sparring, pad work, and coached sessions.',
    capacity: 4,
    hourly_rate: new Prisma.Decimal(29),
    minimum_hours: 1,
    icon_key: 'boxing',
    grid_column: 3,
    grid_row: 3,
    grid_width: 5,
    grid_height: 4,
    is_reservable: true,
    display_order: 1,
    floor_id: 'floor-2',
    requires_subscription: false,
    is_active: true,
  },
  {
    name: 'Multi-Purpose Studio',
    type: AmenityType.other,
    description:
      'Flexible studio space for classes, warmups, and small-group training.',
    capacity: 16,
    hourly_rate: new Prisma.Decimal(75),
    minimum_hours: 1,
    icon_key: 'yoga',
    grid_column: 4,
    grid_row: 2,
    grid_width: 8,
    grid_height: 6,
    is_reservable: true,
    display_order: 1,
    floor_id: 'floor-3',
    requires_subscription: true,
    is_active: true,
  },
] as const satisfies ReadonlyArray<Prisma.AmenityCreateInput>;

const DEFAULT_MUSCLE_DEFINITIONS = [
  {
    aliases: ['pecs', 'pectorals'],
    body_region: 'upper_body_push',
    key: 'chest',
    name: 'Chest',
    sort_order: 10,
  },
  {
    aliases: ['upper chest'],
    body_region: 'upper_body_push',
    key: 'upper_chest',
    name: 'Upper Chest',
    sort_order: 11,
  },
  {
    aliases: ['latissimus dorsi'],
    body_region: 'upper_body_pull',
    key: 'lats',
    name: 'Lats',
    sort_order: 20,
  },
  {
    aliases: ['mid back', 'rhomboids'],
    body_region: 'upper_body_pull',
    key: 'upper_back',
    name: 'Upper Back',
    sort_order: 21,
  },
  {
    aliases: ['trapezius'],
    body_region: 'upper_body_pull',
    key: 'traps',
    name: 'Traps',
    sort_order: 22,
  },
  {
    aliases: ['delts', 'deltoids'],
    body_region: 'shoulders',
    key: 'shoulders',
    name: 'Shoulders',
    sort_order: 30,
  },
  {
    aliases: ['anterior delts'],
    body_region: 'shoulders',
    key: 'front_delts',
    name: 'Front Delts',
    sort_order: 31,
  },
  {
    aliases: ['lateral delts'],
    body_region: 'shoulders',
    key: 'side_delts',
    name: 'Side Delts',
    sort_order: 32,
  },
  {
    aliases: ['posterior delts'],
    body_region: 'shoulders',
    key: 'rear_delts',
    name: 'Rear Delts',
    sort_order: 33,
  },
  {
    aliases: ['bis'],
    body_region: 'arms',
    key: 'biceps',
    name: 'Biceps',
    sort_order: 40,
  },
  {
    aliases: ['tris'],
    body_region: 'arms',
    key: 'triceps',
    name: 'Triceps',
    sort_order: 41,
  },
  {
    aliases: ['grip'],
    body_region: 'arms',
    key: 'forearms',
    name: 'Forearms',
    sort_order: 42,
  },
  {
    aliases: ['abdominals'],
    body_region: 'core',
    key: 'abs',
    name: 'Abs',
    sort_order: 50,
  },
  {
    aliases: ['side abs'],
    body_region: 'core',
    key: 'obliques',
    name: 'Obliques',
    sort_order: 51,
  },
  {
    aliases: ['trunk'],
    body_region: 'core',
    key: 'core',
    name: 'Core',
    sort_order: 52,
  },
  {
    aliases: ['spinal erectors', 'erectors'],
    body_region: 'core',
    key: 'lower_back',
    name: 'Lower Back',
    sort_order: 53,
  },
  {
    aliases: ['butt', 'gluteals'],
    body_region: 'lower_body',
    key: 'glutes',
    name: 'Glutes',
    sort_order: 60,
  },
  {
    aliases: ['quadriceps'],
    body_region: 'lower_body',
    key: 'quads',
    name: 'Quads',
    sort_order: 61,
  },
  {
    aliases: ['hams'],
    body_region: 'lower_body',
    key: 'hamstrings',
    name: 'Hamstrings',
    sort_order: 62,
  },
  {
    aliases: ['gastroc', 'soleus'],
    body_region: 'lower_body',
    key: 'calves',
    name: 'Calves',
    sort_order: 63,
  },
  {
    aliases: ['inner thighs'],
    body_region: 'lower_body',
    key: 'adductors',
    name: 'Adductors',
    sort_order: 64,
  },
  {
    aliases: ['outer hips'],
    body_region: 'lower_body',
    key: 'abductors',
    name: 'Abductors',
    sort_order: 65,
  },
  {
    aliases: ['iliopsoas'],
    body_region: 'lower_body',
    key: 'hip_flexors',
    name: 'Hip Flexors',
    sort_order: 66,
  },
] as const;

const ADMIN_EMAIL = 'sertfitadmin@gmail.com';
const ADMIN_PASSWORD = 'aNYTIMEaNYWHERE2@';
const ADMIN_FIRST_NAME = 'FitTrack';
const ADMIN_LAST_NAME = 'Admin';
const DEMO_MEMBER_EMAIL = 'member.demo.fittrack@gmail.com';
const DEMO_MEMBER_PASSWORD = 'Password1!';
const DEMO_MEMBER_FIRST_NAME = 'Demo';
const DEMO_MEMBER_LAST_NAME = 'Member';

type SeededEmailUser = {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  status?: UserStatus;
};

async function ensureEmailUser(prisma: PrismaClient, user: SeededEmailUser) {
  const credentialHash = await bcrypt.hash(user.password, 10);
  const verifiedAt = new Date();
  const existingIdentity = await prisma.authIdentity.findFirst({
    where: {
      provider: AuthProvider.email,
      identifier: user.email,
    },
    select: {
      id: true,
      user_id: true,
    },
  });

  if (existingIdentity) {
    const ensuredUser = await prisma.user.update({
      where: { id: existingIdentity.user_id },
      data: {
        role: user.role,
        status: user.status ?? UserStatus.active,
        email_verified_at: verifiedAt,
        qr_code_token: randomUUID(),
      },
    });

    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });

    await prisma.userProfile.upsert({
      where: { user_id: ensuredUser.id },
      update: {
        first_name: user.firstName,
        last_name: user.lastName,
      },
      create: {
        user_id: ensuredUser.id,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    });

    await prisma.notificationPreference.upsert({
      where: { user_id: ensuredUser.id },
      update: {},
      create: { user_id: ensuredUser.id },
    });

    return ensuredUser;
  }

  return prisma.$transaction(async (tx) => {
    const ensuredUser = await tx.user.create({
      data: {
        role: user.role,
        status: user.status ?? UserStatus.active,
        email_verified_at: verifiedAt,
        qr_code_token: randomUUID(),
      },
    });

    await tx.authIdentity.create({
      data: {
        user_id: ensuredUser.id,
        provider: AuthProvider.email,
        identifier: user.email,
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });

    await tx.userProfile.create({
      data: {
        user_id: ensuredUser.id,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    });

    await tx.notificationPreference.create({
      data: { user_id: ensuredUser.id },
    });

    return ensuredUser;
  });
}

async function ensureAdmin(prisma: PrismaClient) {
  return ensureEmailUser(prisma, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: UserRole.admin,
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
  });
}

async function ensureDemoMember(prisma: PrismaClient) {
  return ensureEmailUser(prisma, {
    email: DEMO_MEMBER_EMAIL,
    password: DEMO_MEMBER_PASSWORD,
    role: UserRole.member,
    firstName: DEMO_MEMBER_FIRST_NAME,
    lastName: DEMO_MEMBER_LAST_NAME,
  });
}

async function ensureDefaultAmenities(prisma: PrismaClient) {
  const existingAmenities = await prisma.amenity.findMany({
    where: {
      name: {
        in: DEFAULT_AMENITIES.map((amenity) => amenity.name),
      },
    },
    select: {
      id: true,
      name: true,
      is_active: true,
    },
  });
  const existingAmenityByName = new Map(
    existingAmenities.map((amenity) => [amenity.name, amenity]),
  );

  let createdCount = 0;
  let existingCount = 0;
  let reactivatedCount = 0;

  for (const amenity of DEFAULT_AMENITIES) {
    const existingAmenity = existingAmenityByName.get(amenity.name);

    if (!existingAmenity) {
      await prisma.amenity.create({
        data: amenity,
      });
      createdCount += 1;
      continue;
    }

    if (!existingAmenity.is_active) {
      await prisma.amenity.update({
        where: { id: existingAmenity.id },
        data: {
          ...amenity,
          is_active: true,
        },
      });
      reactivatedCount += 1;
      continue;
    }

    await prisma.amenity.update({
      where: { id: existingAmenity.id },
      data: amenity,
    });
    existingCount += 1;
  }

  return { createdCount, existingCount, reactivatedCount };
}

async function ensureDefaultMuscleDefinitions(prisma: PrismaClient) {
  let createdCount = 0;
  let existingCount = 0;

  for (const muscle of DEFAULT_MUSCLE_DEFINITIONS) {
    const existing = await prisma.muscleDefinition.findUnique({
      where: { key: muscle.key },
      select: { id: true },
    });

    await prisma.muscleDefinition.upsert({
      where: { key: muscle.key },
      update: {
        aliases: [...muscle.aliases],
        body_region: muscle.body_region,
        is_active: true,
        is_system: true,
        name: muscle.name,
        sort_order: muscle.sort_order,
      },
      create: {
        aliases: [...muscle.aliases],
        body_region: muscle.body_region,
        is_system: true,
        key: muscle.key,
        name: muscle.name,
        sort_order: muscle.sort_order,
      },
    });

    if (existing) existingCount += 1;
    else createdCount += 1;
  }

  return { createdCount, existingCount };
}

function buildQuarterSeason(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  const quarterStartMonth = (quarter - 1) * 3;
  const startsAt = new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0));
  const endsAt = new Date(
    Date.UTC(year, quarterStartMonth + 3, 0, 23, 59, 59, 999),
  );

  return {
    title: `Capstone Season ${year} Q${quarter}`,
    startsAt,
    endsAt,
  };
}

async function ensureDefaultGamificationBackbone(prisma: PrismaClient) {
  const now = new Date();
  const currentSeason = buildQuarterSeason(now);

  await prisma.seasonDefinition.updateMany({
    where: {
      status: SeasonStatus.active,
      title: {
        not: currentSeason.title,
      },
    },
    data: {
      status: SeasonStatus.closed,
      closed_at: now,
    },
  });

  const existingSeason = await prisma.seasonDefinition.findFirst({
    where: {
      title: currentSeason.title,
    },
    select: {
      id: true,
    },
  });

  if (existingSeason) {
    await prisma.seasonDefinition.update({
      where: { id: existingSeason.id },
      data: {
        status: SeasonStatus.active,
        starts_at: currentSeason.startsAt,
        ends_at: currentSeason.endsAt,
        closed_at: null,
        archived_at: null,
        description:
          'Default capstone season used to exercise the gamification backbone.',
        rules_version: 'capstone-v1',
      },
    });
  } else {
    await prisma.seasonDefinition.create({
      data: {
        title: currentSeason.title,
        description:
          'Default capstone season used to exercise the gamification backbone.',
        status: SeasonStatus.active,
        rules_version: 'capstone-v1',
        starts_at: currentSeason.startsAt,
        ends_at: currentSeason.endsAt,
      },
    });
  }

  const milestoneDefinitions = [
    {
      key: 'first-workout-complete',
      title: 'First Workout Complete',
      description: 'Complete your first validated workout session.',
      category: MilestoneCategory.training,
      trigger_type: MilestoneTriggerType.source_event,
      condition_payload: {
        metric: 'completed_workout_sessions',
        target: 1,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'ember',
        icon: 'flame',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 10,
    },
    {
      key: 'first-weighted-lift',
      title: 'First Weighted Lift',
      description:
        'Log your first weighted exercise set with a positive load value.',
      category: MilestoneCategory.weighted_lifting,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'weighted_exercise_logs',
        target: 1,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'iron',
        icon: 'dumbbell',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 20,
    },
    {
      key: 'fifty-kg-verified-lift',
      title: '50 kg Verified Lift',
      description:
        'Reach a 50 kg logged lift and submit image or MP4 proof for staff review.',
      category: MilestoneCategory.weighted_lifting,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'max_weight_kg',
        target: 50,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'gold',
        icon: 'shield-check',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.manual_required,
      evidence_requirement: MilestoneEvidenceRequirement.image_or_video,
      is_hidden: false,
      sort_order: 30,
    },
    {
      key: 'first-nutrition-log',
      title: 'First Nutrition Log',
      description: 'Create your first nutrition log entry.',
      category: MilestoneCategory.nutrition,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'nutrition_logs',
        target: 1,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'green',
        icon: 'apple',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 40,
    },
    {
      key: 'streak-starter-3',
      title: 'Streak Starter',
      description: 'Build a three-day validated workout streak.',
      category: MilestoneCategory.consistency,
      trigger_type: MilestoneTriggerType.streak,
      condition_payload: {
        metric: 'current_streak',
        target: 3,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'gold',
        icon: 'calendar',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 50,
    },
    {
      key: 'season-100-points',
      title: 'Season Starter 100',
      description: 'Earn 100 season points in the active capstone season.',
      category: MilestoneCategory.season,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'current_season_points',
        target: 100,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'blue',
        icon: 'trophy',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 60,
    },
    {
      key: 'coaching-session-complete',
      title: 'Coaching Session Complete',
      description:
        'Complete a booked coaching appointment and keep proof available for review.',
      category: MilestoneCategory.coaching,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'coaching_appointments_completed',
        target: 1,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'purple',
        icon: 'clipboard-check',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto_then_review,
      evidence_requirement: MilestoneEvidenceRequirement.image_or_video,
      is_hidden: false,
      sort_order: 70,
    },
    {
      key: 'first-venue-booking-complete',
      title: 'First Venue Booking Complete',
      description: 'Complete your first venue or amenity booking.',
      category: MilestoneCategory.booking,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'venue_bookings_completed',
        target: 1,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'cyan',
        icon: 'calendar-check',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 80,
    },
    {
      key: 'brodigy-ai-10',
      title: 'Brodigy AI 10',
      description: 'Send 10 Brodigy AI chat messages.',
      category: MilestoneCategory.ai,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'ai_chat_messages',
        target: 10,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'blue',
        icon: 'bot',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 90,
    },
    {
      key: 'multi-muscle-foundation',
      title: 'Multi-Muscle Foundation',
      description: 'Track progression across three muscle groups.',
      category: MilestoneCategory.training,
      trigger_type: MilestoneTriggerType.summary_threshold,
      condition_payload: {
        metric: 'tracked_muscle_groups',
        target: 3,
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'green',
        icon: 'layers',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.active,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: false,
      sort_order: 100,
    },
    {
      key: 'grounded-all-rounder',
      title: 'Grounded All-Rounder',
      description:
        'Complete workouts, log nutrition, use Brodigy AI, and finish a booking without no-show issues.',
      category: MilestoneCategory.governance,
      trigger_type: MilestoneTriggerType.composite,
      condition_payload: {
        all: [
          { metric: 'completed_workout_sessions', target: 5 },
          { metric: 'nutrition_logs', target: 5 },
          { metric: 'venue_bookings_completed', target: 1 },
          { metric: 'ai_chat_messages', target: 5 },
          { metric: 'booking_no_shows', target: 0, operator: 'eq' },
        ],
      } satisfies Prisma.JsonObject,
      reward_payload: {
        badge_tone: 'silver',
        icon: 'sparkles',
      } satisfies Prisma.JsonObject,
      status: MilestoneDefinitionStatus.draft,
      verification_policy: MilestoneVerificationPolicy.auto,
      evidence_requirement: MilestoneEvidenceRequirement.none,
      is_hidden: true,
      sort_order: 110,
    },
  ] as const;

  for (const milestone of milestoneDefinitions) {
    await prisma.milestoneDefinition.upsert({
      where: { key: milestone.key },
      update: {
        title: milestone.title,
        description: milestone.description,
        category: milestone.category,
        trigger_type: milestone.trigger_type,
        condition_payload: milestone.condition_payload,
        reward_payload: milestone.reward_payload,
        status: milestone.status,
        verification_policy: milestone.verification_policy,
        evidence_requirement: milestone.evidence_requirement,
        is_active: milestone.status === MilestoneDefinitionStatus.active,
        is_hidden: milestone.is_hidden,
        sort_order: milestone.sort_order,
        retired_at: null,
        archived_at: null,
        archived_by_user_id: null,
      },
      create: {
        key: milestone.key,
        title: milestone.title,
        description: milestone.description,
        category: milestone.category,
        trigger_type: milestone.trigger_type,
        condition_payload: milestone.condition_payload,
        reward_payload: milestone.reward_payload,
        status: milestone.status,
        verification_policy: milestone.verification_policy,
        evidence_requirement: milestone.evidence_requirement,
        is_active: milestone.status === MilestoneDefinitionStatus.active,
        is_hidden: milestone.is_hidden,
        sort_order: milestone.sort_order,
      },
    });
  }
}

async function ensureDefaultGamificationProfiles(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.admin, UserRole.member],
      },
    },
    select: {
      id: true,
    },
  });

  for (const user of users) {
    await prisma.rankingProfile.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        visibility: RankingVisibility.public,
        governance_status: RankingGovernanceStatus.normal,
      },
    });
    await prisma.integrityProfile.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        risk_level: IntegrityRiskLevel.low,
      },
    });
    await prisma.creatorProfile.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        state: CreatorState.none,
      },
    });
  }
}

type BootstrapDefaultsOptions = {
  includeUsers?: boolean;
};

export async function bootstrapDefaults(
  prisma: PrismaClient,
  options: BootstrapDefaultsOptions = {},
) {
  if (options.includeUsers ?? true) {
    await ensureAdmin(prisma);
    await ensureDemoMember(prisma);
  }

  const amenitySummary = await ensureDefaultAmenities(prisma);
  const muscleSummary = await ensureDefaultMuscleDefinitions(prisma);
  await ensureDefaultGamificationBackbone(prisma);
  await ensureDefaultGamificationProfiles(prisma);

  return {
    adminEmail: ADMIN_EMAIL,
    demoMemberEmail: DEMO_MEMBER_EMAIL,
    defaultAmenityCount: DEFAULT_AMENITIES.length,
    defaultMuscleCount: DEFAULT_MUSCLE_DEFINITIONS.length,
    muscleCreatedCount: muscleSummary.createdCount,
    muscleExistingCount: muscleSummary.existingCount,
    ...amenitySummary,
  };
}
