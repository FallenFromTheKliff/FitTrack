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

export type SeedAccount = {
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
  password: string;
  phone: string;
  role: UserRole;
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
  coachAccountKeys: string[];
  coachProfileIds: Record<string, string>;
  demoCredentials: SeedCredential[];
  exerciseIds: Record<string, string>;
  macroTargetIds: Record<string, string>;
  memberKeys: string[];
  membershipPlanIds: Record<string, string>;
  premiumMemberKeys: string[];
  productIds: Record<string, string>;
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
    coachAccountKeys: [],
    coachProfileIds: {},
    demoCredentials: [],
    exerciseIds: {},
    macroTargetIds: {},
    memberKeys: [],
    membershipPlanIds: {},
    premiumMemberKeys: [],
    productIds: {},
    staffKeys: [],
    tdeeProfileIds: {},
    userIds: {},
  };
}
