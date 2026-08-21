import type {
  ActivityLevel,
  FitnessGoal,
  Gender,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { SeedRandom } from './random';

export type DynamicSeedMode = 'additive' | 'reset';
export type DynamicSeedTarget = 'local' | 'railway';
export type DynamicSeedScope = 'all' | 'body-nutrition' | 'coaching-payments';

export type MemberCohort =
  | 'power'
  | 'frequent'
  | 'regular'
  | 'light_trial'
  | 'historical_only'
  | 'pending_unverified_suspended';

export type DynamicSeedConfig = {
  allowRemoteReset: boolean;
  anchorDate: Date;
  bookingDensity: 'low' | 'normal' | 'high';
  coachActiveRate: number;
  coachFormerRate: number;
  coachPausedRate: number;
  confirmRemoteReset?: string;
  exerciseHistory: number;
  historyEndDate: Date;
  historyMonths: number;
  historyStartDate: Date;
  mode: DynamicSeedMode;
  pendingPaymentRate: number;
  seed: number;
  sessionDensity: 'low' | 'normal' | 'high';
  scope: DynamicSeedScope;
  splitPresetsPerMember: number;
  target: DynamicSeedTarget;
  users: number;
  workoutDensity: 'low' | 'normal' | 'high';
};

export type MemberPersona =
  | 'active'
  | 'premium'
  | 'frozen'
  | 'pending'
  | 'expired'
  | 'unverified'
  | 'archived'
  | 'suspended'
  | 'trial';

export type MemberEngagement =
  | 'gym_rat'
  | 'frequent'
  | 'regular'
  | 'casual'
  | 'lazy'
  | 'zero_use';

export type MembershipLifecycle =
  | 'active'
  | 'trial_or_new'
  | 'expired'
  | 'frozen'
  | 'none_or_pending'
  | 'cancelled_former';

export type BookingProfile = 'none' | 'occasional' | 'regular' | 'heavy';

export type CoachingProfile =
  | 'none'
  | 'one_time'
  | 'recurring_active'
  | 'recurring_former'
  | 'checkout_failed';

export type PaymentProfile =
  | 'reliable'
  | 'failed_then_successful'
  | 'abandoned_or_failed';

export type CoachLifecycle = 'active' | 'paused' | 'former';
export type CoachQuality = 'excellent' | 'good' | 'average' | 'poor';
export type CoachWorkload = 'high' | 'medium' | 'low';

export type ScenarioDimensionCounts = Record<string, Record<string, number>>;

export type SeedLifecycle = {
  registeredAt: Date;
  verifiedAt: Date | null;
  accessStart: Date | null;
  accessEnd: Date | null;
  activityStart: Date | null;
  activityEnd: Date | null;
  deletedAt: Date | null;
  deletionRequestedAt: Date | null;
  deletionReviewedAt: Date | null;
  historicalOnly: boolean;
};

export type PhysicalTrend = 'cutting' | 'bulking' | 'maintenance';

export type SeedPhysicalBaseline = {
  heightCm: number;
  weightKg: number;
  bmi: number;
  baselineWeightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  waistCm: number;
  chestCm: number;
  trend: PhysicalTrend;
};

export type SeedScenario = {
  memberEngagement?: MemberEngagement;
  engagement?: MemberEngagement;
  membershipLifecycle?: MembershipLifecycle;
  membership?: MembershipLifecycle;
  bookingProfile?: BookingProfile;
  booking?: BookingProfile;
  /** Canonical venue-booking behavior alias used by domain allocators. */
  bookingBehavior?: BookingProfile;
  coachingProfile?: CoachingProfile;
  coaching?: CoachingProfile;
  paymentProfile?: PaymentProfile;
  payment?: PaymentProfile;
  coachLifecycle?: CoachLifecycle;
  coachQuality?: CoachQuality;
  coachWorkload?: CoachWorkload;
  hasCompletedHistory?: boolean;
  hasFutureBookings?: boolean;
  hasCurrentAccess?: boolean;
  currentAccess?: boolean;
  canAcceptFutureBookings?: boolean;
  futureBookingAcceptance?: boolean;
};

export type SeedAccount = SeedScenario & {
  activityLevel?: ActivityLevel | null;
  dateOfBirth?: Date | null;
  deletedAt?: Date | null;
  email: string;
  emailVerified?: boolean;
  firstName: string;
  fitnessGoal?: FitnessGoal | null;
  gender?: Gender | null;
  heightCm?: number | null;
  isDemo: boolean;
  key: string;
  label: string;
  lastName: string;
  memberPersona?: MemberPersona;
  fixedScenario?: string;
  pinned?: boolean;
  password: string;
  phone: string;
  role: UserRole;
  scenario?: SeedScenario;
  lifecycle?: SeedLifecycle;
  physicalBaseline?: SeedPhysicalBaseline;
  status?: UserStatus;
  weightKg?: number | null;
};

export type SeedCredential = {
  email: string;
  label: string;
  password: string;
  role: string;
};

export type SeedState = {
  accounts: SeedAccount[];
  activeMemberKeys: string[];
  adminKeys: string[];
  amenityIds: Record<string, string>;
  coachAccountKeys: string[];
  coachProfileIds: Record<string, string>;
  demoCredentials: SeedCredential[];
  exerciseIds: Record<string, string>;
  historicalMemberKeys: string[];
  macroTargetIds: Record<string, string>;
  memberKeys: string[];
  memberCohorts: Record<string, MemberCohort>;
  membershipPlanIds: Record<string, string>;
  operatingHourIds: Record<string, string>;
  premiumMemberKeys: string[];
  productIds: Record<string, string>;
  restrictedMemberKeys: string[];
  roleCounts: Record<string, number>;
  scenarioCounts: ScenarioDimensionCounts;
  seasonId?: string;
  staffKeys: string[];
  tdeeProfileIds: Record<string, string>;
  userIds: Record<string, string>;
};

export type SeedDomainResult = {
  counts?: Record<string, number>;
  notableIds?: Record<string, string>;
};

export type DynamicSeedContext = {
  config: DynamicSeedConfig;
  notableIds: Record<string, string>;
  prisma: PrismaClient;
  rng: SeedRandom;
  state: SeedState;
};

export function createInitialSeedState(): SeedState {
  return {
    accounts: [],
    activeMemberKeys: [],
    adminKeys: [],
    amenityIds: {},
    coachAccountKeys: [],
    coachProfileIds: {},
    demoCredentials: [],
    exerciseIds: {},
    historicalMemberKeys: [],
    macroTargetIds: {},
    memberKeys: [],
    memberCohorts: {},
    membershipPlanIds: {},
    operatingHourIds: {},
    premiumMemberKeys: [],
    productIds: {},
    restrictedMemberKeys: [],
    roleCounts: {},
    scenarioCounts: {},
    staffKeys: [],
    tdeeProfileIds: {},
    userIds: {},
  };
}
