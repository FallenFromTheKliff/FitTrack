import {
  AccountDeletionRequestStatus,
  ActivityLevel,
  AmenityType,
  AppointmentStatus,
  AuthProvider,
  BookingStatus,
  CoachScheduleType,
  ExerciseCategory,
  FitnessGoal,
  Gender,
  GymChatRole,
  GymFaqCategory,
  InsightFocus,
  InsightPeriod,
  MasteryRank,
  MembershipCardSource,
  MembershipCardStatus,
  MilestoneCategory,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  NutritionUnit,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PoseProfileKind,
  Prisma,
  PrismaClient,
  ProgressionGrantStatus,
  ProgressionGrantType,
  ProgressionSourceStatus,
  ProgressionSourceType,
  RankingGovernanceStatus,
  RankingVisibility,
  RelationshipStatus,
  SalePaymentMethod,
  SaleSource,
  SaleStatus,
  SeasonStatus,
  SessionStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';

import { localEnvFilePath } from '../env-path';
import { TEST_ACCOUNTS, type TestAccount, seedId } from './test-data/constants';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed defense demo data.');
}

const PASSWORD_HASH_ROUNDS = 12;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type MemberState =
  | 'active'
  | 'premium'
  | 'non_member'
  | 'frozen'
  | 'pending'
  | 'expired'
  | 'revoked'
  | 'archived'
  | 'suspended';

type DemoAccount = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
  memberState?: MemberState;
  deletedAt?: Date | null;
  gender?: Gender;
  weightKg?: number;
  heightCm?: number;
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoal;
};

type EnsuredAccount = DemoAccount & {
  userId: string;
};

type PlanSeed = {
  id: string;
  name: string;
  description: string;
  price: Prisma.Decimal;
  durationDays: number;
  includesCoaching: boolean;
  sortOrder: number;
  features: Prisma.InputJsonValue;
};

type ExerciseSeed = {
  name: string;
  muscleGroup: string;
  category: ExerciseCategory;
  dominantJoint: string;
};

type ProductSeed = {
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorder: number;
};

const GENERATED_PASSWORDS = {
  [UserRole.admin]: 'DefenseAdmin!2026',
  [UserRole.staff]: 'DefenseStaff!2026',
  [UserRole.coach]: 'DefenseCoach!2026',
  [UserRole.member]: 'DefenseMember!2026',
} as const;

const ANCHOR_MEMBER_STATES: Record<string, MemberState> = {
  'member-active': 'active',
  'member-premium': 'premium',
  'member-frozen': 'frozen',
  'member-pending': 'pending',
  'member-expired': 'expired',
  'member-nomembership': 'non_member',
};

const FIRST_NAMES = [
  'Alyssa',
  'Miguel',
  'Camille',
  'Rafael',
  'Nicole',
  'Daniel',
  'Andrea',
  'Joshua',
  'Mariel',
  'Patrick',
  'Rica',
  'Jerome',
  'Trisha',
  'Carlo',
  'Bianca',
  'Lance',
  'Katrina',
  'Gabriel',
  'Mika',
  'Renzo',
] as const;

const LAST_NAMES = [
  'Santos',
  'Reyes',
  'Cruz',
  'Garcia',
  'Ramos',
  'Mendoza',
  'Torres',
  'Navarro',
  'Bautista',
  'Aquino',
  'Castillo',
  'Flores',
  'Villanueva',
  'Rivera',
  'Morales',
  'Del Rosario',
] as const;

const MEMBER_STATE_CYCLE: readonly MemberState[] = [
  'active',
  'active',
  'premium',
  'active',
  'non_member',
  'pending',
  'frozen',
  'expired',
  'revoked',
  'suspended',
  'archived',
];

const PLAN_SEEDS: readonly PlanSeed[] = [
  {
    id: seedId('membership-plan:starter-monthly'),
    name: 'Starter Monthly',
    description: 'General gym access with member-card-based attendance.',
    durationDays: 30,
    features: json({ perks: ['gym_access', 'attendance_tracking'] }),
    includesCoaching: false,
    price: money(799),
    sortOrder: 1,
  },
  {
    id: seedId('membership-plan:strength-monthly'),
    name: 'Strength Monthly',
    description: 'Priority gym access for regular lifters and class users.',
    durationDays: 30,
    features: json({
      perks: ['gym_access', 'attendance_tracking', 'priority_slots'],
    }),
    includesCoaching: false,
    price: money(1199),
    sortOrder: 2,
  },
  {
    id: seedId('membership-plan:coaching-plus'),
    name: 'Coaching Plus',
    description: 'Premium gym access with coaching-compatible booking perks.',
    durationDays: 30,
    features: json({
      perks: ['gym_access', 'attendance_tracking', 'coach_addon'],
    }),
    includesCoaching: true,
    price: money(1699),
    sortOrder: 3,
  },
];

function id(key: string) {
  return seedId(`defense-demo:${key}`);
}

function money(value: number | string) {
  return new Prisma.Decimal(value);
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nowPlusDays(days: number, hour = 9, minute = 0) {
  const target = new Date();
  target.setDate(target.getDate() + days);
  target.setHours(hour, minute, 0, 0);
  return target;
}

function dateOnly(days: number) {
  const target = nowPlusDays(days, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target;
}

function fixedTime(value: string) {
  return new Date(`1970-01-01T${value}.000Z`);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function qrToken(key: string) {
  return createHash('sha256')
    .update(`fittrack-defense-demo:${key}`)
    .digest('hex');
}

function decimalNumber(value: Prisma.Decimal | null | undefined) {
  return Number(value?.toString() ?? 0);
}

function fullName(account: DemoAccount) {
  return `${account.firstName} ${account.lastName}`.trim();
}

function accountFromTestAccount(account: TestAccount): DemoAccount {
  return {
    key: account.key,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    password: account.password,
    role: account.role,
    memberState:
      account.role === UserRole.member
        ? (ANCHOR_MEMBER_STATES[account.key] ?? 'active')
        : undefined,
    gender: account.role === UserRole.member ? Gender.other : undefined,
    weightKg: account.role === UserRole.member ? 68 : undefined,
    heightCm: account.role === UserRole.member ? 168 : undefined,
    activityLevel:
      account.role === UserRole.member ? ActivityLevel.moderate : undefined,
    fitnessGoal:
      account.role === UserRole.member ? FitnessGoal.maintenance : undefined,
  };
}

function generatedAccount(
  role: UserRole,
  index: number,
  memberState?: MemberState,
): DemoAccount {
  const firstName = FIRST_NAMES[(index - 1) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index - 1) % LAST_NAMES.length];
  const suffix = String(index).padStart(3, '0');
  const status =
    memberState === 'suspended' ? UserStatus.suspended : UserStatus.active;
  return {
    key: `demo-${role}-${suffix}`,
    email: `demo.${role}.${suffix}@fittrack.com`,
    firstName,
    lastName,
    phone: `+63918${String(1000000 + index).slice(1)}`,
    password: GENERATED_PASSWORDS[role],
    role,
    status,
    memberState,
    deletedAt:
      memberState === 'archived' ? nowPlusDays(-(12 + index), 18) : null,
    gender: index % 2 === 0 ? Gender.female : Gender.male,
    weightKg: 58 + (index % 38),
    heightCm: 155 + (index % 34),
    activityLevel: [
      ActivityLevel.light,
      ActivityLevel.moderate,
      ActivityLevel.active,
      ActivityLevel.very_active,
    ][index % 4],
    fitnessGoal: [
      FitnessGoal.cutting,
      FitnessGoal.maintenance,
      FitnessGoal.bulking,
      FitnessGoal.sport_specific,
    ][index % 4],
  };
}

function buildAccounts() {
  const accounts = TEST_ACCOUNTS.map(accountFromTestAccount);

  for (let index = 1; index <= 3; index += 1) {
    accounts.push(generatedAccount(UserRole.admin, index));
  }
  for (let index = 1; index <= 9; index += 1) {
    accounts.push(generatedAccount(UserRole.staff, index));
  }
  for (let index = 1; index <= 8; index += 1) {
    accounts.push(generatedAccount(UserRole.coach, index));
  }
  for (let index = 1; index <= 68; index += 1) {
    accounts.push(
      generatedAccount(
        UserRole.member,
        index,
        MEMBER_STATE_CYCLE[(index - 1) % MEMBER_STATE_CYCLE.length],
      ),
    );
  }

  return accounts;
}

function buildExercises(): ExerciseSeed[] {
  return [
    ['Push-Up', 'chest', 'shoulder'],
    ['Incline Push-Up', 'chest', 'shoulder'],
    ['Bench Press', 'chest', 'elbow'],
    ['Dumbbell Bench Press', 'chest', 'elbow'],
    ['Chest Fly', 'chest', 'shoulder'],
    ['Pull-Up', 'back', 'elbow'],
    ['Lat Pulldown', 'back', 'elbow'],
    ['Seated Cable Row', 'back', 'elbow'],
    ['Bent-Over Row', 'back', 'hip'],
    ['Single-Arm Row', 'back', 'elbow'],
    ['Bodyweight Squat', 'quads', 'knee'],
    ['Goblet Squat', 'quads', 'knee'],
    ['Back Squat', 'quads', 'knee'],
    ['Front Squat', 'quads', 'knee'],
    ['Leg Press', 'quads', 'knee'],
    ['Walking Lunge', 'quads', 'knee'],
    ['Reverse Lunge', 'glutes', 'knee'],
    ['Romanian Deadlift', 'hamstrings', 'hip'],
    ['Conventional Deadlift', 'hamstrings', 'hip'],
    ['Hip Thrust', 'glutes', 'hip'],
    ['Glute Bridge', 'glutes', 'hip'],
    ['Leg Curl', 'hamstrings', 'knee'],
    ['Leg Extension', 'quads', 'knee'],
    ['Standing Calf Raise', 'calves', 'ankle'],
    ['Seated Calf Raise', 'calves', 'ankle'],
    ['Shoulder Press', 'shoulders', 'shoulder'],
    ['Lateral Raise', 'shoulders', 'shoulder'],
    ['Rear Delt Fly', 'shoulders', 'shoulder'],
    ['Face Pull', 'shoulders', 'shoulder'],
    ['Biceps Curl', 'biceps', 'elbow'],
    ['Hammer Curl', 'biceps', 'elbow'],
    ['Triceps Pushdown', 'triceps', 'elbow'],
    ['Overhead Triceps Extension', 'triceps', 'elbow'],
    ['Plank', 'core', 'hip'],
    ['Side Plank', 'core', 'hip'],
    ['Dead Bug', 'core', 'hip'],
    ['Mountain Climber', 'core', 'hip'],
    ['Russian Twist', 'core', 'spine'],
    ['Burpee', 'full_body', 'hip'],
    ['Jumping Jack', 'cardio', 'shoulder'],
    ['High Knees', 'cardio', 'hip'],
    ['Box Jump', 'power', 'knee'],
    ['Kettlebell Swing', 'power', 'hip'],
    ['Battle Rope Slam', 'conditioning', 'shoulder'],
    ['Rowing Machine Pull', 'cardio', 'elbow'],
    ['Stationary Bike Sprint', 'cardio', 'knee'],
    ['Treadmill Run', 'cardio', 'knee'],
    ['Medicine Ball Slam', 'power', 'shoulder'],
    ['Cable Woodchop', 'core', 'spine'],
    ['Assisted Dip', 'triceps', 'elbow'],
  ].map(([name, muscleGroup, dominantJoint], index) => ({
    name,
    muscleGroup,
    dominantJoint,
    category:
      index >= 39 && index <= 46
        ? ExerciseCategory.cardio
        : ExerciseCategory.strength,
  }));
}

function buildProducts(): ProductSeed[] {
  return [
    ['Optimum Whey 2 lb', 'protein powder', 2089, 1590, 24],
    ['Optimum Whey 5 lb', 'protein powder', 3175, 2480, 16],
    ['Wheyl Isolate 2 lb', 'protein powder', 2399, 1760, 18],
    ['Wheyl KREA Creatine 150 g', 'creatine', 850, 510, 28],
    ['Salamat Whey Creatine 150 g', 'creatine', 350, 210, 40],
    ['Creatine Monohydrate 300 g', 'creatine', 1199, 720, 20],
    ['Pre-Workout Orange Burst', 'pre workout', 1399, 860, 18],
    ['Pre-Workout Blue Raspberry', 'pre workout', 1499, 920, 16],
    ['Caffeine-Free Pump Formula', 'pre workout', 1299, 780, 14],
    ['BCAA Lemon Lime', 'amino acids', 899, 540, 22],
    ['EAA Watermelon', 'amino acids', 999, 610, 21],
    ['Electrolyte Tabs Citrus', 'hydration', 299, 150, 54],
    ['Electrolyte Powder Sachet', 'hydration', 65, 32, 120],
    ['FitTrack Energy Drink', 'energy drink', 120, 70, 90],
    ['Sugar-Free Energy Drink', 'energy drink', 130, 76, 84],
    ['Protein Bar Chocolate', 'protein snack', 115, 68, 100],
    ['Protein Bar Peanut Butter', 'protein snack', 120, 72, 96],
    ['Protein Cookie', 'protein snack', 99, 58, 88],
    ['Ready-To-Drink Whey Shake', 'protein drink', 155, 96, 70],
    ['Greek Yogurt Protein Cup', 'protein snack', 170, 105, 44],
    ['Overnight Oats Protein Cup', 'meal prep', 180, 110, 42],
    ['Tuna Rice Bowl', 'meal prep', 210, 135, 26],
    ['Chicken Adobo Rice Bowl', 'meal prep', 235, 150, 28],
    ['Banana Oat Recovery Cup', 'meal prep', 145, 86, 50],
    ['Peanut Butter Sachet', 'meal add-on', 35, 18, 140],
    ['Sports Water 500 ml', 'hydration', 35, 18, 160],
    ['Coconut Water 330 ml', 'hydration', 75, 42, 72],
    ['Zero Sugar Sports Drink', 'hydration', 85, 49, 76],
    ['Multivitamin Daily Pack', 'wellness', 499, 270, 24],
    ['Fish Oil Softgels', 'wellness', 699, 390, 18],
    ['Vitamin D3 Capsules', 'wellness', 399, 220, 20],
    ['Magnesium Glycinate', 'wellness', 650, 380, 17],
    ['Collagen Peptides Sachet', 'wellness', 95, 52, 60],
    ['Mass Gainer Vanilla 6 lb', 'mass gainer', 2299, 1580, 12],
    ['Lean Gainer Chocolate 4 lb', 'mass gainer', 1899, 1260, 14],
    ['Casein Protein 2 lb', 'protein powder', 2199, 1500, 12],
    ['Plant Protein 2 lb', 'protein powder', 1999, 1320, 13],
    ['L-Carnitine Drink', 'fat support', 115, 65, 80],
    ['Green Tea Extract', 'fat support', 449, 255, 20],
    ['Beta-Alanine Capsules', 'performance', 699, 410, 17],
    ['Citrulline Malate Powder', 'performance', 799, 470, 15],
    ['Carb Powder 1 kg', 'performance', 599, 340, 19],
    ['Dextrose Recovery Mix', 'performance', 450, 260, 24],
    ['Rice Cakes Pack', 'snack', 85, 48, 75],
    ['Almond Trail Mix', 'snack', 140, 82, 58],
    ['Low-Calorie Granola', 'snack', 180, 108, 45],
    ['Protein Pancake Mix', 'meal prep', 399, 230, 22],
    ['Egg White Carton', 'meal prep', 180, 110, 32],
    ['Instant Coffee Protein Latte', 'protein drink', 145, 88, 52],
    ['Recovery Chocolate Milk', 'protein drink', 95, 55, 66],
  ].map(([name, category, price, cost, stock], index) => ({
    name: String(name),
    category: String(category),
    price: Number(price),
    cost: Number(cost),
    stock: Number(stock),
    reorder: index % 5 === 0 ? 20 : 10,
  }));
}

function buildMilestones() {
  const seeds = [
    ['first_workout', 'First Workout', 'Complete your first workout session.'],
    ['first_meal', 'First Meal Logged', 'Log your first nutrition entry.'],
    ['first_attendance', 'First Check-In', 'Scan in at the gym once.'],
    ['first_booking', 'First Booking', 'Create your first booking.'],
    [
      'first_coach_session',
      'First Coach Session',
      'Complete one coach session.',
    ],
    ['first_feedback', 'First Feedback', 'Submit your first coach feedback.'],
    ['three_day_streak', 'Three-Day Streak', 'Train or check in for 3 days.'],
    ['weekly_regular', 'Weekly Regular', 'Complete 3 visits in one week.'],
    ['monthly_regular', 'Monthly Regular', 'Complete 12 visits in a month.'],
    ['ten_workouts', '10 Workouts', 'Complete 10 workout sessions.'],
    ['twenty_five_workouts', '25 Workouts', 'Complete 25 workout sessions.'],
    ['fifty_workouts', '50 Workouts', 'Complete 50 workout sessions.'],
    ['hundred_workouts', '100 Workouts', 'Complete 100 workout sessions.'],
    ['pushup_50', '50 Push-Ups Logged', 'Log 50 push-up reps.'],
    ['squat_100', '100 Squats Logged', 'Log 100 squat reps.'],
    ['bench_50kg', '50 kg Bench Press', 'Record a 50 kg bench press set.'],
    ['bench_75kg', '75 kg Bench Press', 'Record a 75 kg bench press set.'],
    ['bench_100kg', '100 kg Bench Press', 'Record a 100 kg bench press set.'],
    ['deadlift_100kg', '100 kg Deadlift', 'Record a 100 kg deadlift set.'],
    ['deadlift_140kg', '140 kg Deadlift', 'Record a 140 kg deadlift set.'],
    ['squat_100kg', '100 kg Squat', 'Record a 100 kg squat set.'],
    ['leg_press_200kg', '200 kg Leg Press', 'Record a 200 kg leg press set.'],
    ['pullup_10', '10 Pull-Ups', 'Log 10 pull-up reps in a session.'],
    ['plank_2min', 'Two-Minute Plank', 'Hold a plank for 2 minutes.'],
    ['bike_10km', '10 km Bike', 'Log a 10 km bike session.'],
    ['run_5km', '5 km Run', 'Log a 5 km treadmill or outdoor run.'],
    ['protein_week', 'Protein Week', 'Hit protein target 5 days in a week.'],
    ['hydration_week', 'Hydration Week', 'Log hydration 5 days in a week.'],
    [
      'calorie_consistency',
      'Calorie Consistency',
      'Stay within target 7 days.',
    ],
    ['coach_review_5star', 'Five-Star Coach Review', 'Leave a 5-star review.'],
    ['first_no_miss_week', 'No-Miss Week', 'Complete all planned sessions.'],
    ['early_bird', 'Early Bird', 'Check in before 8 AM.'],
    ['night_grind', 'Night Grind', 'Check in after 7 PM.'],
    ['class_regular', 'Class Regular', 'Join 5 class-style sessions.'],
    ['mobility_streak', 'Mobility Streak', 'Complete mobility work 5 times.'],
    ['core_builder', 'Core Builder', 'Complete 10 core sessions.'],
    ['upper_body_builder', 'Upper Body Builder', 'Earn 1,000 upper body XP.'],
    ['lower_body_builder', 'Lower Body Builder', 'Earn 1,000 lower body XP.'],
    [
      'conditioning_builder',
      'Conditioning Builder',
      'Complete 10 conditioning sessions.',
    ],
    ['nutrition_starter', 'Nutrition Starter', 'Log meals for 3 days.'],
    ['nutrition_tracker', 'Nutrition Tracker', 'Log meals for 14 days.'],
    ['first_purchase', 'First Shop Purchase', 'Buy one retail item.'],
    ['repeat_purchase', 'Repeat Shop Purchase', 'Complete 5 retail purchases.'],
    [
      'membership_verified',
      'Membership Verified',
      'Activate a membership card.',
    ],
    ['premium_member', 'Premium Member', 'Activate Coaching Plus.'],
    ['booking_balance_paid', 'Balance Settled', 'Pay a booking balance.'],
    [
      'camera_rep_tracker',
      'Camera Rep Tracker',
      'Finish one camera-tracked set.',
    ],
    ['form_feedback', 'Form Feedback', 'Receive one pose analysis result.'],
    ['season_points_500', '500 Season Points', 'Earn 500 points in a season.'],
    [
      'season_points_1000',
      '1,000 Season Points',
      'Earn 1,000 points in a season.',
    ],
    ['top_10_rank', 'Top 10 Rank', 'Reach the top 10 in a season.'],
  ];

  return seeds.map(([key, title, description], index) => ({
    key: `defense_${key}`,
    title,
    description,
    category:
      index % 5 === 0
        ? MilestoneCategory.consistency
        : index % 7 === 0
          ? MilestoneCategory.season
          : MilestoneCategory.training,
    triggerType:
      index % 3 === 0
        ? MilestoneTriggerType.source_event
        : index % 3 === 1
          ? MilestoneTriggerType.summary_threshold
          : MilestoneTriggerType.streak,
    target: index < 10 ? index + 1 : (index + 1) * 5,
    xp: 100 + index * 15,
  }));
}

async function ensureMembershipPlans() {
  for (const plan of PLAN_SEEDS) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        description: plan.description,
        currency: 'PHP',
        duration_days: plan.durationDays,
        features: plan.features,
        includes_coaching: plan.includesCoaching,
        is_active: true,
        price: plan.price,
        sort_order: plan.sortOrder,
      },
      create: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        currency: 'PHP',
        duration_days: plan.durationDays,
        features: plan.features,
        includes_coaching: plan.includesCoaching,
        is_active: true,
        price: plan.price,
        sort_order: plan.sortOrder,
      },
    });
  }
}

async function ensureAccount(account: DemoAccount): Promise<EnsuredAccount> {
  const matchingIdentities = await prisma.authIdentity.findMany({
    where: {
      provider: AuthProvider.email,
      identifier: account.email,
    },
    orderBy: { created_at: 'asc' },
    select: { id: true, user_id: true },
  });
  const existingIdentity = matchingIdentities[0] ?? null;
  const duplicateIdentityIds = matchingIdentities.slice(1).map(({ id }) => id);
  const userId = existingIdentity?.user_id ?? id(`user:${account.key}`);
  const now = new Date();
  const memberQrToken =
    account.role === UserRole.member ? qrToken(account.key) : null;
  const credentialHash = await bcrypt.hash(
    account.password,
    PASSWORD_HASH_ROUNDS,
  );

  if (duplicateIdentityIds.length) {
    await prisma.authIdentity.deleteMany({
      where: { id: { in: duplicateIdentityIds } },
    });
  }

  if (memberQrToken) {
    await prisma.user.updateMany({
      where: { id: { not: userId }, qr_code_token: memberQrToken },
      data: { qr_code_token: null, qr_code_rotated_at: null },
    });
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      role: account.role,
      status: account.status ?? UserStatus.active,
      deletedAt: account.deletedAt ?? null,
      email_verified_at: now,
      phone_verified_at: now,
      qr_code_token: memberQrToken,
      qr_code_rotated_at: memberQrToken ? now : null,
      has_accepted_privacy: true,
      privacy_accepted_at: now,
    },
    create: {
      id: userId,
      role: account.role,
      status: account.status ?? UserStatus.active,
      deletedAt: account.deletedAt ?? null,
      email_verified_at: now,
      phone_verified_at: now,
      qr_code_token: memberQrToken,
      qr_code_rotated_at: memberQrToken ? now : null,
      has_accepted_privacy: true,
      privacy_accepted_at: now,
    },
  });

  if (existingIdentity) {
    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        credential_hash: credentialHash,
        verified_at: now,
        is_primary: true,
      },
    });
  } else {
    await prisma.authIdentity.create({
      data: {
        id: id(`auth:${account.key}`),
        user_id: userId,
        provider: AuthProvider.email,
        identifier: account.email,
        credential_hash: credentialHash,
        verified_at: now,
        is_primary: true,
      },
    });
  }

  await prisma.userProfile.upsert({
    where: { user_id: userId },
    update: {
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
      gender: account.gender ?? null,
      weight_kg: account.weightKg ? money(account.weightKg) : null,
      height_cm: account.heightCm ? money(account.heightCm) : null,
      activity_level: account.activityLevel ?? null,
      fitness_goal: account.fitnessGoal ?? null,
      date_of_birth: dateOnly(-(365 * (20 + (account.key.length % 18)))),
    },
    create: {
      id: id(`profile:${account.key}`),
      user_id: userId,
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
      gender: account.gender ?? null,
      weight_kg: account.weightKg ? money(account.weightKg) : null,
      height_cm: account.heightCm ? money(account.heightCm) : null,
      activity_level: account.activityLevel ?? null,
      fitness_goal: account.fitnessGoal ?? null,
      date_of_birth: dateOnly(-(365 * (20 + (account.key.length % 18)))),
    },
  });

  await prisma.notificationPreference.upsert({
    where: { user_id: userId },
    update: {},
    create: {
      id: id(`notification-pref:${account.key}`),
      user_id: userId,
    },
  });

  return { ...account, userId };
}

async function ensurePayment(seed: {
  id: string;
  userId: string;
  payableType: PayableType;
  payableId: string;
  stage: PaymentStage;
  amount: Prisma.Decimal;
  provider: PaymentProvider;
  status: PaymentStatus;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const providerRef = `defense-demo:${seed.id}`;
  const idempotencyKey = `defense-demo:${seed.id}`;
  await prisma.payment.upsert({
    where: { id: seed.id },
    update: {
      user_id: seed.userId,
      payable_type: seed.payableType,
      payable_id: seed.payableId,
      payment_stage: seed.stage,
      amount: seed.amount,
      currency: 'PHP',
      provider: seed.provider,
      provider_ref: providerRef,
      idempotency_key: idempotencyKey,
      status: seed.status,
      gateway_metadata: seed.metadata ?? json({ source: 'defense_demo_seed' }),
      verified_by: seed.verifiedBy ?? null,
      verified_at: seed.verifiedAt ?? null,
      rejection_reason: null,
      screenshot_url: null,
    },
    create: {
      id: seed.id,
      user_id: seed.userId,
      payable_type: seed.payableType,
      payable_id: seed.payableId,
      payment_stage: seed.stage,
      amount: seed.amount,
      currency: 'PHP',
      provider: seed.provider,
      provider_ref: providerRef,
      idempotency_key: idempotencyKey,
      status: seed.status,
      gateway_metadata: seed.metadata ?? json({ source: 'defense_demo_seed' }),
      verified_by: seed.verifiedBy ?? null,
      verified_at: seed.verifiedAt ?? null,
    },
  });
}

async function ensureSubscription(seed: {
  key: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startsAt: Date | null;
  expiresAt: Date | null;
}) {
  const targetId = id(`subscription:${seed.key}`);
  const activeLike: SubscriptionStatus[] = [
    SubscriptionStatus.active,
    SubscriptionStatus.past_due,
    SubscriptionStatus.pending_payment,
  ];
  const existing = activeLike.includes(seed.status)
    ? await prisma.subscription.findFirst({
        where: { user_id: seed.userId, status: { in: activeLike } },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      })
    : null;
  const subscriptionId = existing?.id ?? targetId;

  await prisma.subscription.upsert({
    where: { id: subscriptionId },
    update: {
      user_id: seed.userId,
      plan_id: seed.planId,
      status: seed.status,
      starts_at: seed.startsAt,
      expires_at: seed.expiresAt,
      cancelled_at:
        seed.status === SubscriptionStatus.cancelled ||
        seed.status === SubscriptionStatus.expired
          ? (seed.expiresAt ?? new Date())
          : null,
      cancellation_reason:
        seed.status === SubscriptionStatus.cancelled
          ? 'Seeded demo cancellation state.'
          : null,
    },
    create: {
      id: subscriptionId,
      user_id: seed.userId,
      plan_id: seed.planId,
      status: seed.status,
      starts_at: seed.startsAt,
      expires_at: seed.expiresAt,
      cancelled_at:
        seed.status === SubscriptionStatus.cancelled ||
        seed.status === SubscriptionStatus.expired
          ? (seed.expiresAt ?? new Date())
          : null,
      cancellation_reason:
        seed.status === SubscriptionStatus.cancelled
          ? 'Seeded demo cancellation state.'
          : null,
    },
  });

  return subscriptionId;
}

async function ensureMemberState(
  account: EnsuredAccount,
  adminUserId: string,
  staffUserId: string,
) {
  if (account.role !== UserRole.member) {
    return;
  }

  const state = account.memberState ?? 'active';
  const now = new Date();
  const startsAt = nowPlusDays(-(7 + account.key.length), 8);
  const expiresAt = nowPlusDays(30 + (account.key.length % 21), 23);
  const cardId = id(`membership-card:${account.key}`);
  const cardStatus =
    state === 'pending'
      ? MembershipCardStatus.pending_verification
      : state === 'expired' || state === 'revoked' || state === 'archived'
        ? MembershipCardStatus.revoked
        : MembershipCardStatus.active;

  if (state === 'non_member') {
    await prisma.subscription.updateMany({
      where: {
        user_id: account.userId,
        status: {
          in: [
            SubscriptionStatus.active,
            SubscriptionStatus.past_due,
            SubscriptionStatus.pending_payment,
          ],
        },
      },
      data: {
        status: SubscriptionStatus.cancelled,
        cancelled_at: now,
        cancellation_reason: 'Seeded verified non-member demo state.',
      },
    });
    return;
  }

  await prisma.membershipCard.upsert({
    where: { user_id: account.userId },
    update: {
      status: cardStatus,
      source:
        state === 'pending'
          ? MembershipCardSource.cash
          : MembershipCardSource.admin_grant,
      price: money(400),
      purchased_at: startsAt,
      verified_at:
        cardStatus === MembershipCardStatus.pending_verification
          ? null
          : startsAt,
      verified_by:
        cardStatus === MembershipCardStatus.pending_verification
          ? null
          : staffUserId,
      activated_at:
        cardStatus === MembershipCardStatus.active ? startsAt : null,
      revoked_at:
        cardStatus === MembershipCardStatus.revoked
          ? nowPlusDays(-3, 17)
          : null,
      revoked_by:
        cardStatus === MembershipCardStatus.revoked ? adminUserId : null,
      revoke_reason:
        cardStatus === MembershipCardStatus.revoked
          ? `Seeded ${state} membership-card demo state.`
          : null,
    },
    create: {
      id: cardId,
      user_id: account.userId,
      status: cardStatus,
      source:
        state === 'pending'
          ? MembershipCardSource.cash
          : MembershipCardSource.admin_grant,
      price: money(400),
      purchased_at: startsAt,
      verified_at:
        cardStatus === MembershipCardStatus.pending_verification
          ? null
          : startsAt,
      verified_by:
        cardStatus === MembershipCardStatus.pending_verification
          ? null
          : staffUserId,
      activated_at:
        cardStatus === MembershipCardStatus.active ? startsAt : null,
      revoked_at:
        cardStatus === MembershipCardStatus.revoked
          ? nowPlusDays(-3, 17)
          : null,
      revoked_by:
        cardStatus === MembershipCardStatus.revoked ? adminUserId : null,
      revoke_reason:
        cardStatus === MembershipCardStatus.revoked
          ? `Seeded ${state} membership-card demo state.`
          : null,
    },
  });

  await ensurePayment({
    id: id(`payment:membership-card:${account.key}`),
    userId: account.userId,
    payableType: PayableType.membership_card,
    payableId: cardId,
    stage: PaymentStage.full,
    amount: money(400),
    provider:
      state === 'pending' ? PaymentProvider.cash : PaymentProvider.paymongo,
    status:
      state === 'pending'
        ? PaymentStatus.awaiting_verification
        : PaymentStatus.completed,
    verifiedBy: state === 'pending' ? null : staffUserId,
    verifiedAt: state === 'pending' ? null : startsAt,
    metadata: json({ checkout: 'defense_demo', state }),
  });

  const plan =
    state === 'premium'
      ? PLAN_SEEDS[2]
      : state === 'active'
        ? PLAN_SEEDS[1]
        : PLAN_SEEDS[0];
  const subscriptionStatus =
    state === 'pending'
      ? SubscriptionStatus.pending_payment
      : state === 'expired'
        ? SubscriptionStatus.expired
        : state === 'revoked' || state === 'archived'
          ? SubscriptionStatus.cancelled
          : state === 'frozen' || state === 'suspended'
            ? SubscriptionStatus.suspended
            : SubscriptionStatus.active;
  const subscriptionId = await ensureSubscription({
    key: account.key,
    userId: account.userId,
    planId: plan.id,
    status: subscriptionStatus,
    startsAt:
      subscriptionStatus === SubscriptionStatus.pending_payment
        ? null
        : startsAt,
    expiresAt:
      subscriptionStatus === SubscriptionStatus.expired
        ? nowPlusDays(-12, 23)
        : subscriptionStatus === SubscriptionStatus.cancelled
          ? nowPlusDays(-5, 23)
          : subscriptionStatus === SubscriptionStatus.pending_payment
            ? null
            : expiresAt,
  });

  await ensurePayment({
    id: id(`payment:subscription:${account.key}`),
    userId: account.userId,
    payableType: PayableType.subscription,
    payableId: subscriptionId,
    stage: PaymentStage.full,
    amount: plan.price,
    provider:
      account.key.length % 2 === 0
        ? PaymentProvider.cash
        : PaymentProvider.paymongo,
    status:
      subscriptionStatus === SubscriptionStatus.pending_payment
        ? PaymentStatus.processing
        : subscriptionStatus === SubscriptionStatus.active ||
            subscriptionStatus === SubscriptionStatus.suspended ||
            subscriptionStatus === SubscriptionStatus.expired ||
            subscriptionStatus === SubscriptionStatus.cancelled
          ? PaymentStatus.completed
          : PaymentStatus.pending,
    verifiedBy:
      subscriptionStatus === SubscriptionStatus.pending_payment
        ? null
        : staffUserId,
    verifiedAt:
      subscriptionStatus === SubscriptionStatus.pending_payment
        ? null
        : startsAt,
    metadata: json({ checkout: 'defense_demo_membership', state }),
  });

  if (state === 'frozen') {
    await prisma.accountDeletionRequest.upsert({
      where: { id: id(`freeze-request:${account.key}`) },
      update: {
        userId: account.userId,
        reason: 'Seeded freeze review while the member is deciding on renewal.',
        status: AccountDeletionRequestStatus.pending,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      },
      create: {
        id: id(`freeze-request:${account.key}`),
        userId: account.userId,
        reason: 'Seeded freeze review while the member is deciding on renewal.',
        status: AccountDeletionRequestStatus.pending,
      },
    });
  }
}

async function ensureCoachProfiles(accounts: readonly EnsuredAccount[]) {
  const coachAccounts = accounts.filter(({ role }) => role === UserRole.coach);
  const specializations = [
    'Strength programming and compound lifting',
    'Conditioning, mobility, and recovery',
    'Body recomposition and lifestyle coaching',
    'Boxing conditioning and athletic footwork',
    'Beginner strength foundations',
    'Hypertrophy and accessory training',
  ];

  for (const [index, account] of coachAccounts.entries()) {
    const profile = await prisma.coachProfile.upsert({
      where: { user_id: account.userId },
      update: {
        display_name: fullName(account),
        contact_email: account.email,
        contact_phone: account.phone,
        specialization: specializations[index % specializations.length],
        bio: 'Defense demo coach profile linked to a real coach-role account.',
        certification: index % 2 === 0 ? 'NASM-CPT' : 'ACE-CPT',
        hourly_rate: money(700 + (index % 5) * 100),
        gym_commission_pct: money(20),
        is_available_for_booking: true,
        schedule_type:
          index % 3 === 0
            ? CoachScheduleType.full_time
            : CoachScheduleType.part_time,
      },
      create: {
        id: id(`coach-profile:${account.key}`),
        user_id: account.userId,
        display_name: fullName(account),
        contact_email: account.email,
        contact_phone: account.phone,
        specialization: specializations[index % specializations.length],
        bio: 'Defense demo coach profile linked to a real coach-role account.',
        certification: index % 2 === 0 ? 'NASM-CPT' : 'ACE-CPT',
        hourly_rate: money(700 + (index % 5) * 100),
        gym_commission_pct: money(20),
        average_rating: money(4.7),
        rating_count: 8,
        is_available_for_booking: true,
        schedule_type:
          index % 3 === 0
            ? CoachScheduleType.full_time
            : CoachScheduleType.part_time,
      },
    });

    for (const [slotIndex, day] of [1, 2, 3, 4, 5, 6].entries()) {
      const start = ['07:00:00', '09:00:00', '16:00:00'][slotIndex % 3];
      const existing = await prisma.coachAvailabilitySlot.findFirst({
        where: {
          coach_id: profile.id,
          day_of_week: day,
          start_time: fixedTime(start),
          is_active: true,
        },
        select: { id: true },
      });
      const data = {
        coach_id: profile.id,
        day_of_week: day,
        start_time: fixedTime(start),
        end_time: fixedTime(start === '16:00:00' ? '18:00:00' : '11:00:00'),
        is_active: true,
      };
      if (existing) {
        await prisma.coachAvailabilitySlot.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.coachAvailabilitySlot.create({
          data: {
            id: id(`coach-slot:${account.key}:${day}:${start}`),
            ...data,
          },
        });
      }
    }
  }
}

async function ensureAmenities() {
  const amenities = [
    {
      key: 'basketball-court',
      name: 'Basketball Court',
      type: AmenityType.basketball_court,
      rate: 1500,
      capacity: 12,
    },
    {
      key: 'boxing-ring',
      name: 'Boxing Ring',
      type: AmenityType.boxing_ring,
      rate: 1200,
      capacity: 4,
    },
    {
      key: 'yoga-room',
      name: 'Yoga Room',
      type: AmenityType.other,
      rate: 900,
      capacity: 10,
    },
    {
      key: 'functional-area',
      name: 'Functional Training Area',
      type: AmenityType.other,
      rate: 1000,
      capacity: 8,
    },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { id: id(`amenity:${amenity.key}`) },
      update: {
        name: amenity.name,
        type: amenity.type,
        capacity: amenity.capacity,
        hourly_rate: money(amenity.rate),
        minimum_hours: 1,
        is_reservable: true,
        is_active: true,
        requires_subscription: false,
        display_order:
          amenities.findIndex(({ key }) => key === amenity.key) + 1,
      },
      create: {
        id: id(`amenity:${amenity.key}`),
        name: amenity.name,
        type: amenity.type,
        description: `Defense demo reservable venue: ${amenity.name}.`,
        capacity: amenity.capacity,
        hourly_rate: money(amenity.rate),
        minimum_hours: 1,
        is_reservable: true,
        is_active: true,
        requires_subscription: false,
        display_order:
          amenities.findIndex(({ key }) => key === amenity.key) + 1,
      },
    });
  }
}

async function ensureExercises() {
  for (const exercise of buildExercises()) {
    const exerciseId = id(`exercise:${slugify(exercise.name)}`);
    await prisma.exerciseCatalog.upsert({
      where: { id: exerciseId },
      update: {
        name: exercise.name,
        muscle_group: exercise.muscleGroup,
        category: exercise.category,
        muscle_targets: json({
          primary: [exercise.muscleGroup],
          secondary: ['core', 'stabilizers'],
        }),
        movement_profile: json({
          pattern: exercise.dominantJoint === 'hip' ? 'hinge' : 'flex_extend',
          dominantJoint: exercise.dominantJoint,
        }),
        hand_shape_profile: json({ grip: 'neutral_or_standard' }),
        is_active: true,
        description: `${exercise.name} seeded for camera-assisted rep tracking demos.`,
        instructions:
          'Use controlled tempo and complete the full safe range of motion.',
      },
      create: {
        id: exerciseId,
        name: exercise.name,
        muscle_group: exercise.muscleGroup,
        category: exercise.category,
        muscle_targets: json({
          primary: [exercise.muscleGroup],
          secondary: ['core', 'stabilizers'],
        }),
        movement_profile: json({
          pattern: exercise.dominantJoint === 'hip' ? 'hinge' : 'flex_extend',
          dominantJoint: exercise.dominantJoint,
        }),
        hand_shape_profile: json({ grip: 'neutral_or_standard' }),
        description: `${exercise.name} seeded for camera-assisted rep tracking demos.`,
        instructions:
          'Use controlled tempo and complete the full safe range of motion.',
      },
    });

    await prisma.poseExerciseProfile.upsert({
      where: { id: id(`pose-profile:${slugify(exercise.name)}`) },
      update: {
        exercise_id: exerciseId,
        canonical_name: exercise.name,
        profile_kind: PoseProfileKind.seed,
        landmark_signature: json({
          required: ['shoulder', 'hip', 'knee', 'ankle', 'elbow', 'wrist'],
        }),
        angle_signature: json({
          primary: exercise.dominantJoint,
          minDegrees: 55,
          maxDegrees: 170,
        }),
        orientation_signature: json({ accepted: ['front', 'side'] }),
        movement_pattern: json({
          phase: ['eccentric', 'concentric'],
          repSignal: `${exercise.dominantJoint}_angle_delta`,
        }),
        visibility_pattern: json({ minLandmarks: 8, minVisibility: 0.55 }),
        dominant_joint: exercise.dominantJoint,
        tolerance: money(0.18),
        rep_thresholds: json({ bottom: 70, top: 155, minDelta: 35 }),
        rep_rules: json({ requireLockout: false, debounceMs: 250 }),
        sample_count: 12,
        confidence_threshold: money('0.760'),
        is_active: true,
      },
      create: {
        id: id(`pose-profile:${slugify(exercise.name)}`),
        exercise_id: exerciseId,
        canonical_name: exercise.name,
        profile_kind: PoseProfileKind.seed,
        landmark_signature: json({
          required: ['shoulder', 'hip', 'knee', 'ankle', 'elbow', 'wrist'],
        }),
        angle_signature: json({
          primary: exercise.dominantJoint,
          minDegrees: 55,
          maxDegrees: 170,
        }),
        orientation_signature: json({ accepted: ['front', 'side'] }),
        movement_pattern: json({
          phase: ['eccentric', 'concentric'],
          repSignal: `${exercise.dominantJoint}_angle_delta`,
        }),
        visibility_pattern: json({ minLandmarks: 8, minVisibility: 0.55 }),
        dominant_joint: exercise.dominantJoint,
        tolerance: money(0.18),
        rep_thresholds: json({ bottom: 70, top: 155, minDelta: 35 }),
        rep_rules: json({ requireLockout: false, debounceMs: 250 }),
        sample_count: 12,
        confidence_threshold: money('0.760'),
      },
    });
  }
}

async function ensureMilestonesAndProgress(
  accounts: readonly EnsuredAccount[],
) {
  const seasonId = id('season:defense-demo');
  const memberAccounts = accounts.filter(
    ({ role, deletedAt }) => role === UserRole.member && !deletedAt,
  );

  await prisma.seasonDefinition.upsert({
    where: { id: seasonId },
    update: {
      title: 'Defense Demo Strength Season',
      description: 'Seeded season used for capstone defense analytics.',
      status: SeasonStatus.active,
      starts_at: nowPlusDays(-20, 0),
      ends_at: nowPlusDays(25, 23),
      rules_version: 'defense-demo-v1',
    },
    create: {
      id: seasonId,
      title: 'Defense Demo Strength Season',
      description: 'Seeded season used for capstone defense analytics.',
      status: SeasonStatus.active,
      starts_at: nowPlusDays(-20, 0),
      ends_at: nowPlusDays(25, 23),
      rules_version: 'defense-demo-v1',
    },
  });

  const milestoneSeeds = buildMilestones();
  for (const seed of milestoneSeeds) {
    await prisma.milestoneDefinition.upsert({
      where: { key: seed.key },
      update: {
        title: seed.title,
        description: seed.description,
        category: seed.category,
        trigger_type: seed.triggerType,
        condition_payload: json({ target: seed.target }),
        reward_payload: json({ xp: seed.xp }),
        is_active: true,
        is_hidden: false,
        retired_at: null,
      },
      create: {
        id: id(`milestone:${seed.key}`),
        key: seed.key,
        title: seed.title,
        description: seed.description,
        category: seed.category,
        trigger_type: seed.triggerType,
        condition_payload: json({ target: seed.target }),
        reward_payload: json({ xp: seed.xp }),
      },
    });
  }

  for (const [index, account] of memberAccounts.slice(0, 70).entries()) {
    const totalXp = 350 + index * 45;
    await prisma.userProgressionProfile.upsert({
      where: { user_id: account.userId },
      update: {
        active_season_id: seasonId,
        total_xp: totalXp,
        current_streak: index % 11,
        longest_streak: 4 + (index % 20),
        current_season_points: 100 + index * 9,
        last_progressed_at: nowPlusDays(-(index % 10), 19),
      },
      create: {
        id: id(`progression-profile:${account.key}`),
        user_id: account.userId,
        active_season_id: seasonId,
        total_xp: totalXp,
        current_streak: index % 11,
        longest_streak: 4 + (index % 20),
        current_season_points: 100 + index * 9,
        last_progressed_at: nowPlusDays(-(index % 10), 19),
      },
    });

    await prisma.rankingProfile.upsert({
      where: { user_id: account.userId },
      update: {
        visibility: RankingVisibility.public,
        governance_status: RankingGovernanceStatus.normal,
        display_alias: `${account.firstName} ${account.lastName[0]}.`,
      },
      create: {
        id: id(`ranking-profile:${account.key}`),
        user_id: account.userId,
        visibility: RankingVisibility.public,
        governance_status: RankingGovernanceStatus.normal,
        display_alias: `${account.firstName} ${account.lastName[0]}.`,
      },
    });

    await prisma.seasonalStanding.upsert({
      where: {
        season_id_user_id: {
          season_id: seasonId,
          user_id: account.userId,
        },
      },
      update: {
        season_points: 100 + index * 9,
        rank_position: index + 1,
        is_hidden: false,
        is_disqualified: false,
        last_earned_at: nowPlusDays(-(index % 10), 19),
      },
      create: {
        id: id(`season-standing:${account.key}`),
        season_id: seasonId,
        user_id: account.userId,
        season_points: 100 + index * 9,
        rank_position: index + 1,
        last_earned_at: nowPlusDays(-(index % 10), 19),
      },
    });

    for (const milestone of milestoneSeeds.slice(0, 12 + (index % 12))) {
      const unlocked = (index + milestone.target) % 4 !== 0;
      await prisma.userMilestoneProgress.upsert({
        where: {
          user_id_milestone_definition_id: {
            user_id: account.userId,
            milestone_definition_id: id(`milestone:${milestone.key}`),
          },
        },
        update: {
          status: unlocked
            ? MilestoneProgressStatus.claimed
            : MilestoneProgressStatus.in_progress,
          progress_value: unlocked
            ? milestone.target
            : Math.max(1, milestone.target - 1),
          progress_payload: json({ demo: true }),
          unlocked_at: unlocked ? nowPlusDays(-(index % 9), 19) : null,
          claimed_at: unlocked ? nowPlusDays(-(index % 8), 20) : null,
        },
        create: {
          id: id(`milestone-progress:${account.key}:${milestone.key}`),
          user_id: account.userId,
          milestone_definition_id: id(`milestone:${milestone.key}`),
          status: unlocked
            ? MilestoneProgressStatus.claimed
            : MilestoneProgressStatus.in_progress,
          progress_value: unlocked
            ? milestone.target
            : Math.max(1, milestone.target - 1),
          progress_payload: json({ demo: true }),
          unlocked_at: unlocked ? nowPlusDays(-(index % 9), 19) : null,
          claimed_at: unlocked ? nowPlusDays(-(index % 8), 20) : null,
        },
      });
    }

    for (const muscle of ['chest', 'quads', 'back']) {
      await prisma.muscleMasteryProgress.upsert({
        where: {
          user_id_muscle_group: {
            user_id: account.userId,
            muscle_group: muscle,
          },
        },
        update: {
          total_volume_kg: money(1200 + index * 55),
          xp_points: 300 + index * 17,
          rank:
            index % 5 === 0
              ? MasteryRank.gold
              : index % 3 === 0
                ? MasteryRank.silver
                : MasteryRank.bronze,
          last_ranked_at: nowPlusDays(-(index % 7), 20),
        },
        create: {
          id: id(`mastery:${account.key}:${muscle}`),
          user_id: account.userId,
          muscle_group: muscle,
          total_volume_kg: money(1200 + index * 55),
          xp_points: 300 + index * 17,
          rank:
            index % 5 === 0
              ? MasteryRank.gold
              : index % 3 === 0
                ? MasteryRank.silver
                : MasteryRank.bronze,
          last_ranked_at: nowPlusDays(-(index % 7), 20),
        },
      });
    }
  }
}

async function ensureAttendanceNutritionAndWorkouts(
  accounts: readonly EnsuredAccount[],
) {
  const memberAccounts = accounts.filter(
    ({ role, deletedAt }) => role === UserRole.member && !deletedAt,
  );
  const staff = accounts.find(({ role }) => role === UserRole.staff);
  const exercises = buildExercises();

  for (const [index, account] of memberAccounts.slice(0, 75).entries()) {
    for (let visit = 0; visit < 4; visit += 1) {
      const checkIn = nowPlusDays(-(visit * 7 + (index % 6)), 6 + (visit % 5));
      await prisma.attendanceLog.upsert({
        where: { id: id(`attendance:${account.key}:${visit}`) },
        update: {
          user_id: account.userId,
          scanned_by: staff?.userId ?? null,
          check_in_at: checkIn,
          check_out_at: addMinutes(checkIn, 70 + (index % 40)),
        },
        create: {
          id: id(`attendance:${account.key}:${visit}`),
          user_id: account.userId,
          scanned_by: staff?.userId ?? null,
          check_in_at: checkIn,
          check_out_at: addMinutes(checkIn, 70 + (index % 40)),
        },
      });
    }

    const tdeeId = id(`tdee:${account.key}`);
    const existingTdee = await prisma.tdeeProfile.findFirst({
      where: { user_id: account.userId, is_active: true },
      select: { id: true },
    });
    await prisma.tdeeProfile.upsert({
      where: { id: existingTdee?.id ?? tdeeId },
      update: {
        weight_kg: money(account.weightKg ?? 68),
        height_cm: money(account.heightCm ?? 168),
        age: 23 + (index % 18),
        gender: account.gender ?? Gender.other,
        activity_level: account.activityLevel ?? ActivityLevel.moderate,
        fitness_goal: account.fitnessGoal ?? FitnessGoal.maintenance,
        bmr_calories: money(1500 + index * 4),
        tdee_calories: money(2150 + index * 6),
        is_active: true,
        calculated_at: nowPlusDays(-(index % 14), 8),
      },
      create: {
        id: existingTdee?.id ?? tdeeId,
        user_id: account.userId,
        weight_kg: money(account.weightKg ?? 68),
        height_cm: money(account.heightCm ?? 168),
        age: 23 + (index % 18),
        gender: account.gender ?? Gender.other,
        activity_level: account.activityLevel ?? ActivityLevel.moderate,
        fitness_goal: account.fitnessGoal ?? FitnessGoal.maintenance,
        bmr_calories: money(1500 + index * 4),
        tdee_calories: money(2150 + index * 6),
        calculated_at: nowPlusDays(-(index % 14), 8),
      },
    });

    const macroId = id(`macro:${account.key}`);
    const existingMacro = await prisma.macroTarget.findFirst({
      where: { user_id: account.userId, is_active: true },
      select: { id: true },
    });
    await prisma.macroTarget.upsert({
      where: { id: existingMacro?.id ?? macroId },
      update: {
        user_id: account.userId,
        tdee_profile_id: existingTdee?.id ?? tdeeId,
        target_calories: money(2100 + index * 5),
        protein_g: money(120 + (index % 45)),
        carbs_g: money(210 + (index % 80)),
        fat_g: money(55 + (index % 25)),
        is_active: true,
      },
      create: {
        id: existingMacro?.id ?? macroId,
        user_id: account.userId,
        tdee_profile_id: existingTdee?.id ?? tdeeId,
        target_calories: money(2100 + index * 5),
        protein_g: money(120 + (index % 45)),
        carbs_g: money(210 + (index % 80)),
        fat_g: money(55 + (index % 25)),
      },
    });

    for (let meal = 0; meal < 5; meal += 1) {
      await prisma.nutritionLog.upsert({
        where: { id: id(`nutrition:${account.key}:${meal}`) },
        update: {
          user_id: account.userId,
          macro_target_id: existingMacro?.id ?? macroId,
          log_date: dateOnly(-(meal + (index % 7))),
          meal_name: ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Post-workout'][
            meal
          ],
          food_item: [
            'Oats with whey protein',
            'Chicken rice bowl',
            'Greek yogurt cup',
            'Tuna with vegetables',
            'Recovery milk shake',
          ][meal],
          calories: money(260 + meal * 120),
          protein_g: money(18 + meal * 8),
          carbs_g: money(28 + meal * 10),
          fat_g: money(6 + meal * 3),
          quantity: money(1),
          unit: NutritionUnit.serving,
        },
        create: {
          id: id(`nutrition:${account.key}:${meal}`),
          user_id: account.userId,
          macro_target_id: existingMacro?.id ?? macroId,
          log_date: dateOnly(-(meal + (index % 7))),
          meal_name: ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Post-workout'][
            meal
          ],
          food_item: [
            'Oats with whey protein',
            'Chicken rice bowl',
            'Greek yogurt cup',
            'Tuna with vegetables',
            'Recovery milk shake',
          ][meal],
          calories: money(260 + meal * 120),
          protein_g: money(18 + meal * 8),
          carbs_g: money(28 + meal * 10),
          fat_g: money(6 + meal * 3),
          quantity: money(1),
          unit: NutritionUnit.serving,
        },
      });
    }

    for (let session = 0; session < 2; session += 1) {
      const startedAt = nowPlusDays(-(session * 5 + (index % 9)), 17);
      const sessionId = id(`workout:${account.key}:${session}`);
      await prisma.workoutSession.upsert({
        where: { id: sessionId },
        update: {
          user_id: account.userId,
          status: SessionStatus.completed,
          started_at: startedAt,
          completed_at: addMinutes(startedAt, 65),
          duration_seconds: 3900,
          total_volume_kg: money(1800 + index * 70),
          last_activity_at: addMinutes(startedAt, 65),
        },
        create: {
          id: sessionId,
          user_id: account.userId,
          status: SessionStatus.completed,
          started_at: startedAt,
          completed_at: addMinutes(startedAt, 65),
          duration_seconds: 3900,
          total_volume_kg: money(1800 + index * 70),
          last_activity_at: addMinutes(startedAt, 65),
        },
      });

      for (let set = 1; set <= 2; set += 1) {
        const exercise = exercises[(index + session + set) % exercises.length];
        const exerciseId = id(`exercise:${slugify(exercise.name)}`);
        const exerciseLogId = id(
          `exercise-log:${account.key}:${session}:${set}`,
        );
        await prisma.exerciseLog.upsert({
          where: { id: exerciseLogId },
          update: {
            session_id: sessionId,
            user_id: account.userId,
            exercise_id: exerciseId,
            set_number: set,
            reps_target: 10,
            reps_completed: 10 + (index % 4),
            reps_ai_counted: 10 + (index % 4),
            weight_kg: money(20 + (index % 16) * 2.5),
          },
          create: {
            id: exerciseLogId,
            session_id: sessionId,
            user_id: account.userId,
            exercise_id: exerciseId,
            set_number: set,
            reps_target: 10,
            reps_completed: 10 + (index % 4),
            reps_ai_counted: 10 + (index % 4),
            weight_kg: money(20 + (index % 16) * 2.5),
          },
        });

        const poseProfileId = id(`pose-profile:${slugify(exercise.name)}`);
        await prisma.poseSession.upsert({
          where: { id: id(`pose-session:${account.key}:${session}:${set}`) },
          update: {
            user_id: account.userId,
            exercise_log_id: exerciseLogId,
            exercise_hint: exercise.name,
            rep_count_ai: 10 + (index % 4),
            confidence_avg: money('0.860'),
            detected_exercise_name: exercise.name,
            detected_profile_id: poseProfileId,
            classification_confidence: money('0.840'),
            subject_lock_confidence: money('0.910'),
            analysis_summary: json({
              form_feedback: 'Stable tempo and clean lockout on most reps.',
              demo: true,
            }),
            started_at: startedAt,
            ended_at: addMinutes(startedAt, 8),
          },
          create: {
            id: id(`pose-session:${account.key}:${session}:${set}`),
            user_id: account.userId,
            exercise_log_id: exerciseLogId,
            exercise_hint: exercise.name,
            rep_count_ai: 10 + (index % 4),
            confidence_avg: money('0.860'),
            detected_exercise_name: exercise.name,
            detected_profile_id: poseProfileId,
            classification_confidence: money('0.840'),
            subject_lock_confidence: money('0.910'),
            analysis_summary: json({
              form_feedback: 'Stable tempo and clean lockout on most reps.',
              demo: true,
            }),
            started_at: startedAt,
            ended_at: addMinutes(startedAt, 8),
          },
        });
      }
    }
  }
}

async function ensureCoachBookingsAndReviews(
  accounts: readonly EnsuredAccount[],
) {
  const members = accounts.filter(
    ({ role, memberState, deletedAt }) =>
      role === UserRole.member &&
      !deletedAt &&
      memberState !== 'archived' &&
      memberState !== 'revoked',
  );
  const coachProfiles = await prisma.coachProfile.findMany({
    where: { user_id: { not: null }, is_available_for_booking: true },
    orderBy: { created_at: 'asc' },
    include: { user: { include: { profile: true } } },
  });
  if (!coachProfiles.length) {
    return;
  }

  for (const [index, member] of members.slice(0, 60).entries()) {
    const coach = coachProfiles[index % coachProfiles.length];
    const scheduledAt = nowPlusDays(-(index % 24), 7 + (index % 7));
    const total = money(decimalNumber(coach.hourly_rate) || 850);
    const gymRevenue = total.mul(coach.gym_commission_pct).div(100);
    const coachEarnings = total.sub(gymRevenue);
    const status = [
      AppointmentStatus.completed,
      AppointmentStatus.completed,
      AppointmentStatus.confirmed,
      AppointmentStatus.pending_payment,
      AppointmentStatus.no_show,
    ][index % 5];
    const appointmentId = id(`coach-appointment:${member.key}:${index}`);

    await prisma.coachAppointment.upsert({
      where: { id: appointmentId },
      update: {
        user_id: member.userId,
        coach_id: coach.id,
        status,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        total_amount: total,
        downpayment_amount:
          status === AppointmentStatus.pending_payment
            ? money(0)
            : total.div(2),
        balance_amount:
          status === AppointmentStatus.completed ? money(0) : total.div(2),
        gym_revenue:
          status === AppointmentStatus.completed ? gymRevenue : money(0),
        coach_earnings:
          status === AppointmentStatus.completed ? coachEarnings : money(0),
        downpayment_paid_at:
          status === AppointmentStatus.pending_payment ? null : scheduledAt,
        balance_paid_at:
          status === AppointmentStatus.completed
            ? addMinutes(scheduledAt, 65)
            : null,
        session_notes: 'Defense demo coaching appointment.',
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member completed the planned session with consistent effort.'
            : null,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Assessment: improved movement control, stable breathing, and better pacing.'
            : status === AppointmentStatus.no_show
              ? 'No-show recorded for scheduling analytics.'
              : null,
        member_notes: 'Seeded member goal: strength and conditioning progress.',
        completed_at:
          status === AppointmentStatus.completed
            ? addMinutes(scheduledAt, 65)
            : null,
        no_show_at:
          status === AppointmentStatus.no_show
            ? addMinutes(scheduledAt, 20)
            : null,
        cancelled_at: null,
        cancellation_reason: null,
      },
      create: {
        id: appointmentId,
        user_id: member.userId,
        coach_id: coach.id,
        status,
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        total_amount: total,
        downpayment_amount:
          status === AppointmentStatus.pending_payment
            ? money(0)
            : total.div(2),
        balance_amount:
          status === AppointmentStatus.completed ? money(0) : total.div(2),
        gym_revenue:
          status === AppointmentStatus.completed ? gymRevenue : money(0),
        coach_earnings:
          status === AppointmentStatus.completed ? coachEarnings : money(0),
        downpayment_paid_at:
          status === AppointmentStatus.pending_payment ? null : scheduledAt,
        balance_paid_at:
          status === AppointmentStatus.completed
            ? addMinutes(scheduledAt, 65)
            : null,
        session_notes: 'Defense demo coaching appointment.',
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member completed the planned session with consistent effort.'
            : null,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Assessment: improved movement control, stable breathing, and better pacing.'
            : status === AppointmentStatus.no_show
              ? 'No-show recorded for scheduling analytics.'
              : null,
        member_notes: 'Seeded member goal: strength and conditioning progress.',
        completed_at:
          status === AppointmentStatus.completed
            ? addMinutes(scheduledAt, 65)
            : null,
        no_show_at:
          status === AppointmentStatus.no_show
            ? addMinutes(scheduledAt, 20)
            : null,
      },
    });

    await ensurePayment({
      id: id(`payment:coach:${member.key}:${index}`),
      userId: member.userId,
      payableType: PayableType.coaching,
      payableId: appointmentId,
      stage:
        status === AppointmentStatus.completed
          ? PaymentStage.full
          : PaymentStage.downpayment,
      amount:
        status === AppointmentStatus.pending_payment ? money(0) : total.div(2),
      provider:
        index % 2 === 0 ? PaymentProvider.cash : PaymentProvider.paymongo,
      status:
        status === AppointmentStatus.pending_payment
          ? PaymentStatus.pending
          : PaymentStatus.completed,
      verifiedBy: accounts.find(({ role }) => role === UserRole.staff)?.userId,
      verifiedAt:
        status === AppointmentStatus.pending_payment
          ? null
          : addMinutes(scheduledAt, 5),
      metadata: json({
        checkout: 'defense_demo_coaching',
        appointmentStatus: status,
      }),
    });

    if (status === AppointmentStatus.completed) {
      await prisma.coachReview.upsert({
        where: { appointment_id: appointmentId },
        update: {
          coach_id: coach.id,
          reviewer_id: member.userId,
          rating: 4 + (index % 2),
          comment:
            index % 2 === 0
              ? 'Coach gave clear cues and the session felt well-paced.'
              : 'Helpful session. I liked the form corrections and progress notes.',
        },
        create: {
          id: id(`coach-review:${member.key}:${index}`),
          appointment_id: appointmentId,
          coach_id: coach.id,
          reviewer_id: member.userId,
          rating: 4 + (index % 2),
          comment:
            index % 2 === 0
              ? 'Coach gave clear cues and the session felt well-paced.'
              : 'Helpful session. I liked the form corrections and progress notes.',
        },
      });
    }

    const relationship = await prisma.coachClientRelationship.findFirst({
      where: {
        coach_id: coach.id,
        member_id: member.userId,
        status: { in: [RelationshipStatus.pending, RelationshipStatus.active] },
      },
      select: { id: true },
    });
    const relationshipData = {
      coach_id: coach.id,
      member_id: member.userId,
      status: RelationshipStatus.active,
      started_at: scheduledAt,
      ended_at: null,
      notes: 'Defense demo coach-client relationship.',
    };
    if (relationship) {
      await prisma.coachClientRelationship.update({
        where: { id: relationship.id },
        data: relationshipData,
      });
    } else {
      await prisma.coachClientRelationship.create({
        data: {
          id: id(`coach-relationship:${coach.id}:${member.userId}`),
          ...relationshipData,
        },
      });
    }
  }

  for (const coach of coachProfiles) {
    const aggregate = await prisma.coachReview.aggregate({
      where: { coach_id: coach.id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.coachProfile.update({
      where: { id: coach.id },
      data: {
        average_rating: money((aggregate._avg.rating ?? 0).toFixed(2)),
        rating_count: aggregate._count._all,
      },
    });
  }
}

async function ensureAmenityBookings(accounts: readonly EnsuredAccount[]) {
  const members = accounts.filter(
    ({ role, deletedAt }) => role === UserRole.member && !deletedAt,
  );
  const amenities = await prisma.amenity.findMany({
    where: {
      id: {
        in: [
          id('amenity:basketball-court'),
          id('amenity:boxing-ring'),
          id('amenity:yoga-room'),
          id('amenity:functional-area'),
        ],
      },
    },
  });
  const allAmenities =
    amenities.length > 0
      ? amenities
      : await prisma.amenity.findMany({ where: { is_reservable: true } });
  if (!allAmenities.length) {
    return;
  }

  for (const [index, member] of members.slice(0, 35).entries()) {
    const amenity = allAmenities[index % allAmenities.length];
    const startsAt = nowPlusDays(-(index % 20), 9 + (index % 8));
    const endsAt = addMinutes(startsAt, 60);
    const total = amenity.hourly_rate;
    const status = [
      BookingStatus.completed,
      BookingStatus.confirmed,
      BookingStatus.pending,
      BookingStatus.balance_pending,
      BookingStatus.no_show,
      BookingStatus.cancelled,
    ][index % 6];
    const bookingId = id(`amenity-booking:${member.key}:${index}`);

    await prisma.amenityBooking.upsert({
      where: { id: bookingId },
      update: {
        user_id: member.userId,
        amenity_id: amenity.id,
        status,
        starts_at: startsAt,
        ends_at: endsAt,
        total_amount: total,
        downpayment_amount:
          status === BookingStatus.pending ? money(0) : total.div(2),
        balance_amount:
          status === BookingStatus.completed ? money(0) : total.div(2),
        downpayment_paid_at: status === BookingStatus.pending ? null : startsAt,
        balance_paid_at:
          status === BookingStatus.completed ? addMinutes(startsAt, 70) : null,
        cancelled_at:
          status === BookingStatus.cancelled
            ? addMinutes(startsAt, -120)
            : null,
        completed_at:
          status === BookingStatus.completed ? addMinutes(startsAt, 70) : null,
        notes: 'Defense demo venue booking.',
      },
      create: {
        id: bookingId,
        user_id: member.userId,
        amenity_id: amenity.id,
        status,
        starts_at: startsAt,
        ends_at: endsAt,
        total_amount: total,
        downpayment_amount:
          status === BookingStatus.pending ? money(0) : total.div(2),
        balance_amount:
          status === BookingStatus.completed ? money(0) : total.div(2),
        downpayment_paid_at: status === BookingStatus.pending ? null : startsAt,
        balance_paid_at:
          status === BookingStatus.completed ? addMinutes(startsAt, 70) : null,
        cancelled_at:
          status === BookingStatus.cancelled
            ? addMinutes(startsAt, -120)
            : null,
        completed_at:
          status === BookingStatus.completed ? addMinutes(startsAt, 70) : null,
        notes: 'Defense demo venue booking.',
      },
    });

    await ensurePayment({
      id: id(`payment:amenity:${member.key}:${index}`),
      userId: member.userId,
      payableType: PayableType.booking,
      payableId: bookingId,
      stage:
        status === BookingStatus.completed
          ? PaymentStage.full
          : PaymentStage.downpayment,
      amount: status === BookingStatus.pending ? money(0) : total.div(2),
      provider:
        index % 2 === 0 ? PaymentProvider.cash : PaymentProvider.paymongo,
      status:
        status === BookingStatus.pending
          ? PaymentStatus.pending
          : PaymentStatus.completed,
      verifiedBy: accounts.find(({ role }) => role === UserRole.staff)?.userId,
      verifiedAt:
        status === BookingStatus.pending ? null : addMinutes(startsAt, 5),
      metadata: json({ checkout: 'defense_demo_venue', bookingStatus: status }),
    });

    if (status === BookingStatus.completed) {
      await prisma.amenityFeedback.upsert({
        where: { id: id(`amenity-feedback:${member.key}:${index}`) },
        update: {
          amenity_id: amenity.id,
          user_id: member.userId,
          rating: 4 + (index % 2),
          comment: 'Venue was clean and ready for the scheduled time.',
        },
        create: {
          id: id(`amenity-feedback:${member.key}:${index}`),
          amenity_id: amenity.id,
          user_id: member.userId,
          rating: 4 + (index % 2),
          comment: 'Venue was clean and ready for the scheduled time.',
        },
      });
    }
  }
}

async function ensureInventoryAndSales(accounts: readonly EnsuredAccount[]) {
  const products = buildProducts();
  const staff = accounts.filter(({ role }) => role === UserRole.staff);
  const members = accounts.filter(
    ({ role, deletedAt }) => role === UserRole.member && !deletedAt,
  );

  for (const [index, product] of products.entries()) {
    await prisma.retailProduct.upsert({
      where: { id: id(`product:${slugify(product.name)}`) },
      update: {
        name: product.name,
        category: product.category,
        description: `${product.name} seeded retail item for gym POS demos.`,
        price: money(product.price),
        cost: money(product.cost),
        stock_quantity: product.stock,
        reorder_threshold: product.reorder,
        is_active: true,
      },
      create: {
        id: id(`product:${slugify(product.name)}`),
        name: product.name,
        category: product.category,
        description: `${product.name} seeded retail item for gym POS demos.`,
        price: money(product.price),
        cost: money(product.cost),
        stock_quantity: product.stock,
        reorder_threshold: product.reorder,
        is_active: true,
      },
    });

    const member = members[index % members.length];
    const staffUser = staff[index % Math.max(staff.length, 1)];
    if (!member || !staffUser) {
      continue;
    }
    const quantity = 1 + (index % 3);
    const transactionId = id(`sale:${index}`);
    const productId = id(`product:${slugify(product.name)}`);
    const subtotal = money(product.price).mul(quantity);
    await prisma.saleTransaction.upsert({
      where: { id: transactionId },
      update: {
        customer_name: fullName(member),
        customer_user_id: member.userId,
        source: index % 3 === 0 ? SaleSource.mobile : SaleSource.manual,
        total_amount: subtotal,
        payment_method:
          index % 2 === 0 ? SalePaymentMethod.cash : SalePaymentMethod.paymongo,
        processed_by: staffUser.userId,
        status: SaleStatus.completed,
        notes: 'Defense demo retail sale.',
        created_at: nowPlusDays(-(index % 45), 10 + (index % 8)),
      },
      create: {
        id: transactionId,
        customer_name: fullName(member),
        customer_user_id: member.userId,
        source: index % 3 === 0 ? SaleSource.mobile : SaleSource.manual,
        total_amount: subtotal,
        payment_method:
          index % 2 === 0 ? SalePaymentMethod.cash : SalePaymentMethod.paymongo,
        processed_by: staffUser.userId,
        status: SaleStatus.completed,
        notes: 'Defense demo retail sale.',
        created_at: nowPlusDays(-(index % 45), 10 + (index % 8)),
      },
    });

    await prisma.saleTransactionItem.upsert({
      where: { id: id(`sale-item:${index}`) },
      update: {
        transaction_id: transactionId,
        product_id: productId,
        quantity,
        unit_price: money(product.price),
        subtotal,
      },
      create: {
        id: id(`sale-item:${index}`),
        transaction_id: transactionId,
        product_id: productId,
        quantity,
        unit_price: money(product.price),
        subtotal,
      },
    });
  }
}

async function ensureGymChatAndBusinessInsights(
  accounts: readonly EnsuredAccount[],
) {
  const member =
    accounts.find(({ key }) => key === 'member-premium') ??
    accounts.find(({ role }) => role === UserRole.member);
  const admin = accounts.find(({ role }) => role === UserRole.admin);

  for (let day = 0; day <= 6; day += 1) {
    await prisma.gymOperatingHour.upsert({
      where: { day_of_week: day },
      update: {
        opens_at: fixedTime(day === 0 ? '08:00:00' : '06:00:00'),
        closes_at: fixedTime(day === 0 ? '20:00:00' : '22:00:00'),
        is_closed: false,
        label:
          day === 0
            ? 'Sunday hours'
            : day === 6
              ? 'Saturday hours'
              : 'Weekday hours',
        is_active: true,
      },
      create: {
        id: id(`gym-hour:${day}`),
        day_of_week: day,
        opens_at: fixedTime(day === 0 ? '08:00:00' : '06:00:00'),
        closes_at: fixedTime(day === 0 ? '20:00:00' : '22:00:00'),
        is_closed: false,
        label:
          day === 0
            ? 'Sunday hours'
            : day === 6
              ? 'Saturday hours'
              : 'Weekday hours',
        is_active: true,
      },
    });
  }

  const faqSeeds = [
    [
      GymFaqCategory.hours,
      'What time does SertFit open and close?',
      'SertFit is open 6:00 AM to 10:00 PM on weekdays and Saturday, and 8:00 AM to 8:00 PM on Sunday.',
      ['hours', 'open', 'close', 'sertfit'],
    ],
    [
      GymFaqCategory.membership,
      'How do memberships work?',
      'Members can activate a card, choose a plan, and renew through the member portal or front desk.',
      ['membership', 'renew', 'card'],
    ],
    [
      GymFaqCategory.coaching,
      'How do I book a coach?',
      'Open Bookings, pick a coach, choose an available slot, and submit the appointment request.',
      ['booking', 'coach', 'appointment'],
    ],
    [
      GymFaqCategory.rates,
      'How do downpayments work?',
      'A downpayment reserves the booking. The remaining balance is settled before the session is completed.',
      ['payment', 'downpayment', 'balance'],
    ],
    [
      GymFaqCategory.amenities,
      'Can I reserve a venue?',
      'Reservable venues can be booked from the member portal or by admin and staff from Gym Operations.',
      ['venue', 'reservation', 'booking'],
    ],
    [
      GymFaqCategory.training,
      'Can the camera tracker count reps?',
      'The camera tracker uses seeded exercise profiles to count reps and give form feedback when confidence is high enough.',
      ['camera', 'rep', 'exercise'],
    ],
    [
      GymFaqCategory.nutrition,
      'Can I ask about nutrition?',
      'You can ask for general fitness nutrition support and log meals to compare against your macro target.',
      ['nutrition', 'meal', 'macro'],
    ],
    [
      GymFaqCategory.rules,
      'Can I ask for private member data?',
      'No. Member chat cannot reveal private records, sales, attendance totals, or staff data.',
      ['privacy', 'private', 'analytics'],
    ],
  ] as const;

  for (const [
    index,
    [category, question, answer, keywords],
  ] of faqSeeds.entries()) {
    await prisma.gymFaqEntry.upsert({
      where: { id: id(`gym-faq:${index}`) },
      update: {
        category,
        question,
        answer,
        keywords: json(keywords),
        sort_order: index + 1,
        is_active: true,
      },
      create: {
        id: id(`gym-faq:${index}`),
        category,
        question,
        answer,
        keywords: json(keywords),
        sort_order: index + 1,
        is_active: true,
      },
    });
  }

  if (member) {
    const sessionId = id(`gym-chat-session:${member.key}`);
    await prisma.gymChatSession.upsert({
      where: { id: sessionId },
      update: {
        user_id: member.userId,
        title: 'Defense demo gym support chat',
        is_active: true,
        last_activity_at: nowPlusDays(-1, 17),
      },
      create: {
        id: sessionId,
        user_id: member.userId,
        title: 'Defense demo gym support chat',
        is_active: true,
        last_activity_at: nowPlusDays(-1, 17),
      },
    });

    const messages = [
      [GymChatRole.user, 'When is SertFit opening and closing time?', null],
      [
        GymChatRole.assistant,
        'SertFit is open 6:00 AM to 10:00 PM on weekdays and Saturday, and 8:00 AM to 8:00 PM on Sunday.',
        json(['operating_hours', 'faqs']),
      ],
      [GymChatRole.user, 'How does a downpayment work?', null],
      [
        GymChatRole.assistant,
        'A downpayment reserves the booking. The remaining balance is settled before the session is completed.',
        json(['faqs']),
      ],
    ] as const;
    for (const [index, [role, content, sources]] of messages.entries()) {
      await prisma.gymChatMessage.upsert({
        where: { id: id(`gym-chat-message:${member.key}:${index}`) },
        update: {
          session_id: sessionId,
          role,
          content,
          grounded_sources: sources ?? Prisma.JsonNull,
          out_of_scope: false,
          created_at: nowPlusDays(-1, 17, index * 3),
        },
        create: {
          id: id(`gym-chat-message:${member.key}:${index}`),
          session_id: sessionId,
          role,
          content,
          grounded_sources: sources ?? Prisma.JsonNull,
          out_of_scope: false,
          created_at: nowPlusDays(-1, 17, index * 3),
        },
      });
    }
  }

  if (admin) {
    for (const [index, focus] of [
      InsightFocus.overview,
      InsightFocus.revenue,
      InsightFocus.attendance,
      InsightFocus.coaching,
      InsightFocus.inventory,
      InsightFocus.membership,
    ].entries()) {
      await prisma.businessInsightRun.upsert({
        where: { id: id(`business-insight:${focus}`) },
        update: {
          requested_by: admin.userId,
          focus,
          period: InsightPeriod.monthly,
          start_date: dateOnly(-30),
          end_date: dateOnly(0),
          request_payload: json({ demo: true, focus }),
          insight_payload: json({
            summary: `Defense demo ${focus} insight with seeded operational data.`,
            signals: ['seeded_memberships', 'seeded_bookings', 'seeded_sales'],
            confidence: 0.86 - index * 0.02,
          }),
          model_used: 'fittrack-business-insights-demo',
          token_count: 420 + index * 25,
          latency_ms: 350 + index * 30,
        },
        create: {
          id: id(`business-insight:${focus}`),
          requested_by: admin.userId,
          focus,
          period: InsightPeriod.monthly,
          start_date: dateOnly(-30),
          end_date: dateOnly(0),
          request_payload: json({ demo: true, focus }),
          insight_payload: json({
            summary: `Defense demo ${focus} insight with seeded operational data.`,
            signals: ['seeded_memberships', 'seeded_bookings', 'seeded_sales'],
            confidence: 0.86 - index * 0.02,
          }),
          model_used: 'fittrack-business-insights-demo',
          token_count: 420 + index * 25,
          latency_ms: 350 + index * 30,
        },
      });
    }
  }
}

async function ensureAppFeedback(accounts: readonly EnsuredAccount[]) {
  const members = accounts.filter(
    ({ role, deletedAt }) => role === UserRole.member && !deletedAt,
  );

  for (const [index, member] of members.slice(0, 40).entries()) {
    await prisma.appFeedback.upsert({
      where: { id: id(`app-feedback:${member.key}`) },
      update: {
        user_id: member.userId,
        category: ['coach_session', 'workout_tracker', 'nutrition', 'booking'][
          index % 4
        ],
        message: [
          'Coach feedback and assessment notes are useful for tracking progress.',
          'Camera rep tracker helped me stay honest with full-range reps.',
          'Nutrition targets made meal logging easier during the week.',
          'Booking flow is clear and reminders are helpful.',
        ][index % 4],
        created_at: nowPlusDays(-(index % 14), 18),
      },
      create: {
        id: id(`app-feedback:${member.key}`),
        user_id: member.userId,
        category: ['coach_session', 'workout_tracker', 'nutrition', 'booking'][
          index % 4
        ],
        message: [
          'Coach feedback and assessment notes are useful for tracking progress.',
          'Camera rep tracker helped me stay honest with full-range reps.',
          'Nutrition targets made meal logging easier during the week.',
          'Booking flow is clear and reminders are helpful.',
        ][index % 4],
        created_at: nowPlusDays(-(index % 14), 18),
      },
    });
  }
}

async function buildCounts() {
  return {
    users: await prisma.user.count(),
    demoUsers: await prisma.authIdentity.count({
      where: {
        provider: AuthProvider.email,
        identifier: {
          in: buildAccounts().map(({ email }) => email),
        },
      },
    }),
    coachProfiles: await prisma.coachProfile.count(),
    exercises: await prisma.exerciseCatalog.count(),
    poseProfiles: await prisma.poseExerciseProfile.count(),
    retailProducts: await prisma.retailProduct.count(),
    milestones: await prisma.milestoneDefinition.count(),
    attendanceLogs: await prisma.attendanceLog.count(),
    nutritionLogs: await prisma.nutritionLog.count(),
    workoutSessions: await prisma.workoutSession.count(),
    coachAppointments: await prisma.coachAppointment.count(),
    coachReviews: await prisma.coachReview.count(),
    amenityBookings: await prisma.amenityBooking.count(),
    saleTransactions: await prisma.saleTransaction.count(),
    gymFaqs: await prisma.gymFaqEntry.count(),
    businessInsightRuns: await prisma.businessInsightRun.count(),
  };
}

async function main() {
  await ensureMembershipPlans();

  const ensuredAccounts: EnsuredAccount[] = [];
  for (const account of buildAccounts()) {
    ensuredAccounts.push(await ensureAccount(account));
  }

  const admin =
    ensuredAccounts.find(({ key }) => key === 'admin') ??
    ensuredAccounts.find(({ role }) => role === UserRole.admin);
  const staff =
    ensuredAccounts.find(({ key }) => key === 'staff') ??
    ensuredAccounts.find(({ role }) => role === UserRole.staff);
  if (!admin || !staff) {
    throw new Error(
      'Defense demo seed requires at least one admin and staff account.',
    );
  }

  for (const account of ensuredAccounts) {
    await ensureMemberState(account, admin.userId, staff.userId);
  }

  await ensureCoachProfiles(ensuredAccounts);
  await ensureAmenities();
  await ensureExercises();
  await ensureMilestonesAndProgress(ensuredAccounts);
  await ensureAttendanceNutritionAndWorkouts(ensuredAccounts);
  await ensureCoachBookingsAndReviews(ensuredAccounts);
  await ensureAmenityBookings(ensuredAccounts);
  await ensureInventoryAndSales(ensuredAccounts);
  await ensureGymChatAndBusinessInsights(ensuredAccounts);
  await ensureAppFeedback(ensuredAccounts);

  const counts = await buildCounts();
  console.log('[defense-demo-seed] complete');
  console.log(
    '[defense-demo-seed] anchored credentials: seed.admin@fittrack.com, seed.staff@fittrack.com, seed.coach@fittrack.com, seed.member.active@fittrack.com, seed.member.premium@fittrack.com, seed.member.frozen@fittrack.com, seed.member.pending@fittrack.com, seed.member.expired@fittrack.com',
  );
  console.log(JSON.stringify(counts, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
