import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserRole } from '@prisma/client';
import { createInitialSeedState } from './types';
import type { DynamicSeedContext } from './types';
import { parseDynamicSeedConfig } from './config';
import { SeedRandom } from './random';
import { seedId } from './ids';
import { seedUsersAuthProfiles } from './domains/users-auth-profiles';
import { seedMembershipPayments } from './domains/membership-payments';
import { bootstrapDefaults } from '../defaults';
import {
  seedCheckoutHolds,
  seedFacilitiesCoaching,
} from './domains/facilities-coaching';
import { seedFitnessGamification } from './domains/fitness-gamification';
import { seedNutritionInventory } from './domains/nutrition-inventory';
import { seedAiGymAnalytics } from './domains/ai-gym-analytics';
import { reconcileCoachingContracts } from './reconcile';
import { CANONICAL_MUSCLE_DEFINITIONS } from '../../../../packages/utils/fitness-catalog';
import {
  assertMembershipCommerceLineage,
  assertVenueBookingLineage,
  hasVenueCapacityOverflow,
  runSeedIntegrityAudit,
} from './integrity';

type Row = Record<string, unknown>;

type UpsertInput = {
  create: Row;
  update: Row;
  where: Row;
};

type CreateManyInput = {
  data: readonly Row[];
};

function rowValue(row: Row, key: string) {
  return row[key];
}

function userKey(input: UpsertInput) {
  return String(rowValue(input.create, 'user_id'));
}

function idKey(input: UpsertInput) {
  return String(rowValue(input.create, 'id'));
}

function upsertRow(rows: Map<string, Row>, key: string, input: UpsertInput) {
  const existing = rows.get(key);
  const row = {
    ...(existing ?? input.create),
    ...(existing ? input.update : {}),
  };
  rows.set(key, row);
  return row;
}

function createManyRows(rows: Row[], input: CreateManyInput) {
  const existingIds = new Set(rows.map((row) => String(rowValue(row, 'id'))));
  for (const row of input.data) {
    const id = String(rowValue(row, 'id'));
    if (!existingIds.has(id)) {
      rows.push({ ...row });
      existingIds.add(id);
    }
  }
}

function matchesWhere(row: Row, where?: Row) {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    const actual = rowValue(row, key);
    if (
      expected &&
      typeof expected === 'object' &&
      'in' in (expected as Record<string, unknown>)
    ) {
      return (
        (expected as { in: readonly unknown[] }).in.includes(actual) ||
        ((actual === undefined || actual === null) &&
          (expected as { in: readonly unknown[] }).in.includes(actual))
      );
    }
    if (
      expected &&
      typeof expected === 'object' &&
      'some' in (expected as Record<string, unknown>)
    ) {
      return Array.isArray(actual) && actual.length > 0;
    }
    return actual === expected;
  });
}

function selectedRows(
  rows: readonly Row[],
  input: { where?: Row; select?: Row },
) {
  const filtered = rows.filter((row) => matchesWhere(row, input.where));
  if (!input.select) return filtered.map((row) => ({ ...row }));
  return filtered.map((row) =>
    Object.fromEntries(
      Object.keys(input.select!).map((key) => [key, rowValue(row, key)]),
    ),
  );
}

/** The seed domains only need these Prisma operations for this regression. */
class InMemorySeedPrisma {
  readonly users = new Map<string, Row>();
  readonly authIdentities = new Map<string, Row>();
  readonly userProfiles = new Map<string, Row>();
  readonly notificationPreferences = new Map<string, Row>();
  readonly membershipPlans = new Map<string, Row>();
  readonly membershipCatalogSettingsRows = new Map<string, Row>();
  readonly membershipCards = new Map<string, Row>();
  readonly subscriptions = new Map<string, Row>();
  readonly commerceCheckoutHolds: Row[] = [];
  readonly appFeedbackRows: Row[] = [];
  readonly progressMetrics: Row[] = [];
  readonly attendanceLogs: Row[] = [];
  readonly accountDeletionRequests: Row[] = [];
  readonly refreshTokens: Row[] = [];
  readonly otpVerifications: Row[] = [];
  readonly payments: Row[] = [];
  readonly amenities = new Map<string, Row>();
  readonly floorPlanMedia = new Map<string, Row>();
  readonly coachProfiles = new Map<string, Row>();
  readonly coachSpecialties = new Map<string, Row>();
  readonly coachProfileSpecialties: Row[] = [];
  readonly coachAvailabilitySlots: Row[] = [];
  readonly coachClientRelationships: Row[] = [];
  readonly recurringCoachingPlans = new Map<string, Row>();
  readonly recurringCoachingBillingCycles: Row[] = [];
  readonly coachAppointments: Row[] = [];
  readonly coachReviews: Row[] = [];
  readonly amenityBookings: Row[] = [];
  readonly amenityFeedbackRows: Row[] = [];
  readonly auditLogs: Row[] = [];
  readonly exerciseCatalogRows: Row[] = [];
  readonly muscleDefinitionRows: Row[] = [];
  readonly trainingPlans = new Map<string, Row>();
  readonly trainingScheduleDays: Row[] = [];
  readonly planExercises: Row[] = [];
  readonly workoutSessions: Row[] = [];
  readonly coachWorkoutAssignments: Row[] = [];
  readonly exerciseLogs: Row[] = [];
  readonly poseExerciseProfiles: Row[] = [];
  readonly poseSessions: Row[] = [];
  readonly genericRows = new Map<string, Row[]>();

  readonly user = {
    findMany: (input: { where?: Row; select?: Row }) => {
      const rows = [...this.users.values()].map((row) => ({
        ...row,
        profile: this.userProfiles.get(String(rowValue(row, 'id'))) ?? null,
      }));
      return Promise.resolve(selectedRows(rows, input));
    },
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(this.users, String(rowValue(input.create, 'id')), input),
      ),
  };

  readonly authIdentity = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.authIdentities.values()], input)),
    upsert: (input: UpsertInput) => {
      const key = [
        rowValue(input.create, 'user_id'),
        rowValue(input.create, 'provider'),
        rowValue(input.create, 'identifier'),
      ].join(':');
      return Promise.resolve(upsertRow(this.authIdentities, key, input));
    },
  };

  readonly userProfile = {
    upsert: (input: UpsertInput) =>
      Promise.resolve(upsertRow(this.userProfiles, userKey(input), input)),
  };

  readonly notificationPreference = {
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(this.notificationPreferences, userKey(input), input),
      ),
  };

  readonly appFeedback = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.appFeedbackRows, input)),
  };

  readonly progressMetric = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.progressMetrics, input)),
  };

  readonly attendanceLog = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.attendanceLogs, input)),
  };

  readonly accountDeletionRequest = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.accountDeletionRequests, input)),
  };

  readonly refreshToken = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.refreshTokens, input)),
  };

  readonly otpVerification = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.otpVerifications, input)),
  };

  readonly membershipPlan = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.membershipPlans.values()], input)),
    upsert: (input: UpsertInput) =>
      Promise.resolve(upsertRow(this.membershipPlans, idKey(input), input)),
  };

  readonly membershipCatalogSettings = {
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(this.membershipCatalogSettingsRows, idKey(input), input),
      ),
  };

  readonly membershipCard = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.membershipCards.values()], input)),
    upsert: (input: UpsertInput) =>
      Promise.resolve(upsertRow(this.membershipCards, userKey(input), input)),
  };

  readonly subscription = {
    findMany: (input: { where?: Row; select?: Row }) => {
      const rows = [...this.subscriptions.values()].map((row) => ({
        ...row,
        plan:
          this.membershipPlans.get(String(rowValue(row, 'plan_id'))) ?? null,
      }));
      return Promise.resolve(selectedRows(rows, input));
    },
    upsert: (input: UpsertInput) =>
      Promise.resolve(upsertRow(this.subscriptions, idKey(input), input)),
  };

  readonly payment = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.paymentRowsById.values()], input)),
    upsert: (input: UpsertInput) =>
      Promise.resolve(upsertRow(this.paymentRowsById, idKey(input), input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(
        (() => {
          createManyRows(this.payments, input);
          for (const row of input.data) {
            this.paymentRowsById.set(String(rowValue(row, 'id')), { ...row });
          }
        })(),
      ),
  };

  private readonly paymentRowsById = new Map<string, Row>();

  readonly commerceCheckoutHold = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(
        selectedRows([...this.commerceCheckoutHoldsById.values()], input),
      ),
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(this.commerceCheckoutHoldsById, idKey(input), input),
      ),
    update: (input: { where: { id: string }; data: Row }) => {
      const row = this.commerceCheckoutHoldsById.get(input.where.id);
      assert.ok(row, `hold ${input.where.id} should exist before update`);
      Object.assign(row, input.data);
      return Promise.resolve(row);
    },
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.commerceCheckoutHolds, input)),
  };

  private readonly commerceCheckoutHoldsById = new Map<string, Row>();

  readonly amenity = {
    findUnique: (input: { where: Row; select?: Row }) =>
      Promise.resolve(
        selectedRows(
          [...this.amenities.values()].filter((row) =>
            matchesWhere(row, input.where),
          ),
          { select: input.select },
        )[0] ?? null,
      ),
    findFirst: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(
        selectedRows([...this.amenities.values()], input)[0] ?? null,
      ),
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.amenities.values()], input)),
    create: (input: { data: Row; select?: Row }) => {
      const row = { ...input.data };
      if (row.status === undefined) row.status = null;
      this.amenities.set(String(rowValue(row, 'id')), row);
      return Promise.resolve(
        input.select ? selectedRows([row], { select: input.select })[0] : row,
      );
    },
    update: (input: { where: Row; data: Row }) => {
      const id = String(rowValue(input.where, 'id'));
      const row = this.amenities.get(id);
      assert.ok(row, `amenity ${id} should exist before update`);
      Object.assign(row, input.data);
      if (row.status === undefined) row.status = null;
      return Promise.resolve(row);
    },
  };

  readonly facilityFloorPlanMedia = {
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(
          this.floorPlanMedia,
          String(rowValue(input.create, 'floor_id')),
          input,
        ),
      ),
  };

  readonly coachProfile = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.coachProfiles.values()], input)),
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(
          this.coachProfiles,
          String(rowValue(input.create, 'user_id')),
          input,
        ),
      ),
  };

  readonly coachSpecialty = {
    upsert: (input: UpsertInput) =>
      Promise.resolve(
        upsertRow(
          this.coachSpecialties,
          String(rowValue(input.create, 'normalized_label')),
          input,
        ),
      ),
  };

  readonly coachProfileSpecialty = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.coachProfileSpecialties, input)),
  };

  readonly coachAvailabilitySlot = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.coachAvailabilitySlots, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.coachAvailabilitySlots, input)),
    updateMany: (input: { where?: Row; data: Row }) => {
      for (const row of this.coachAvailabilitySlots.filter((candidate) =>
        matchesWhere(candidate, input.where),
      )) {
        Object.assign(row, input.data);
      }
      return Promise.resolve({ count: 0 });
    },
  };

  readonly coachClientRelationship = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.coachClientRelationships, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.coachClientRelationships, input)),
  };

  readonly recurringCoachingPlan = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(
        selectedRows([...this.recurringCoachingPlans.values()], input),
      ),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(
        (() => {
          for (const row of input.data) {
            this.recurringCoachingPlans.set(String(rowValue(row, 'id')), {
              ...row,
            });
          }
        })(),
      ),
    update: (input: { where: Row; data: Row }) => {
      const id = String(rowValue(input.where, 'id'));
      const row = this.recurringCoachingPlans.get(id);
      assert.ok(row, `recurring plan ${id} should exist before update`);
      Object.assign(row, input.data);
      return Promise.resolve(row);
    },
  };

  readonly recurringCoachingBillingCycle = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.recurringCoachingBillingCycles, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(
        createManyRows(this.recurringCoachingBillingCycles, input),
      ),
  };

  readonly coachAppointment = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.coachAppointments, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.coachAppointments, input)),
    update: (input: { where: Row; data: Row }) => {
      const row = this.coachAppointments.find((candidate) =>
        matchesWhere(candidate, input.where),
      );
      assert.ok(row, 'appointment should exist before update');
      Object.assign(row, input.data);
      return Promise.resolve(row);
    },
  };

  readonly coachReview = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.coachReviews, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.coachReviews, input)),
  };

  readonly amenityBooking = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.amenityBookings, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.amenityBookings, input)),
  };

  readonly amenityFeedback = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.amenityFeedbackRows, input)),
  };

  readonly auditLog = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.auditLogs, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.auditLogs, input)),
  };

  readonly trainingPlan = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows([...this.trainingPlans.values()], input)),
    upsert: (input: UpsertInput) =>
      Promise.resolve(upsertRow(this.trainingPlans, idKey(input), input)),
  };

  readonly trainingScheduleDay = {
    findMany: (input: { where?: Row; select?: Row }) => {
      const rows = this.trainingScheduleDays.map((row) => ({
        ...row,
        exercises: this.planExercises
          .filter(
            (exercise) =>
              rowValue(exercise, 'schedule_day_id') === rowValue(row, 'id'),
          )
          .map((exercise) => ({
            duration_seconds: rowValue(exercise, 'duration_seconds'),
            exercise_id: rowValue(exercise, 'exercise_id'),
            id: rowValue(exercise, 'id'),
            reps: rowValue(exercise, 'reps'),
            sets: rowValue(exercise, 'sets'),
            weight_kg_target: rowValue(exercise, 'weight_kg_target'),
          })),
      }));
      return Promise.resolve(selectedRows(rows, input));
    },
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.trainingScheduleDays, input)),
  };

  readonly planExercise = {
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.planExercises, input)),
  };

  readonly workoutSession = {
    findMany: (input: { where?: Row; select?: Row; orderBy?: unknown }) => {
      const rows = [...this.workoutSessions].sort((left, right) => {
        const leftTime = rowValue(left, 'started_at');
        const rightTime = rowValue(right, 'started_at');
        if (!(leftTime instanceof Date) || !(rightTime instanceof Date)) {
          return 0;
        }
        return leftTime.getTime() - rightTime.getTime();
      });
      return Promise.resolve(selectedRows(rows, input));
    },
    create: (input: { data: Row }) => {
      const nestedUser = input.data.user as
        | { connect?: { id?: string } }
        | undefined;
      const nestedPlan = input.data.plan as
        | { connect?: { id?: string } }
        | undefined;
      const row = {
        ...input.data,
        plan_id:
          rowValue(input.data, 'plan_id') ?? nestedPlan?.connect?.id ?? null,
        user_id: rowValue(input.data, 'user_id') ?? nestedUser?.connect?.id,
      };
      this.workoutSessions.push(row);
      const nestedLogs = input.data.exercise_logs as
        | { create?: readonly Row[] }
        | undefined;
      for (const log of nestedLogs?.create ?? []) {
        const nestedLogUser = log.user as
          | { connect?: { id?: string } }
          | undefined;
        const nestedExercise = log.exercise as
          | { connect?: { id?: string } }
          | undefined;
        this.exerciseLogs.push({
          ...log,
          exercise_id:
            rowValue(log, 'exercise_id') ?? nestedExercise?.connect?.id,
          session_id: rowValue(row, 'id'),
          user_id:
            rowValue(log, 'user_id') ??
            nestedLogUser?.connect?.id ??
            rowValue(row, 'user_id'),
        });
      }
      return Promise.resolve(row);
    },
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.workoutSessions, input)),
  };

  readonly coachWorkoutAssignment = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.coachWorkoutAssignments, input)),
    upsert: (input: UpsertInput) => {
      const existing = this.coachWorkoutAssignments.find((row) =>
        matchesWhere(row, input.where),
      );
      const row = existing
        ? Object.assign(existing, input.update)
        : { ...input.create };
      if (!existing) this.coachWorkoutAssignments.push(row);
      return Promise.resolve(row);
    },
  };

  readonly exerciseCatalog = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.exerciseCatalogRows, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.exerciseCatalogRows, input)),
    upsert: (input: UpsertInput) => {
      const row = upsertRow(this.exerciseCatalogById, idKey(input), input);
      const index = this.exerciseCatalogRows.findIndex(
        (candidate) => rowValue(candidate, 'id') === rowValue(row, 'id'),
      );
      if (index < 0) this.exerciseCatalogRows.push(row);
      else this.exerciseCatalogRows[index] = row;
      return Promise.resolve(row);
    },
  };
  private readonly exerciseCatalogById = new Map<string, Row>();

  readonly exerciseLog = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.exerciseLogs, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.exerciseLogs, input)),
  };

  readonly poseExerciseProfile = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.poseExerciseProfiles, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.poseExerciseProfiles, input)),
    upsert: (input: UpsertInput) => {
      const row = upsertRow(this.poseExerciseProfileById, idKey(input), input);
      if (row.is_active === undefined) row.is_active = true;
      const index = this.poseExerciseProfiles.findIndex(
        (candidate) => rowValue(candidate, 'id') === rowValue(row, 'id'),
      );
      if (index < 0) this.poseExerciseProfiles.push(row);
      else this.poseExerciseProfiles[index] = row;
      return Promise.resolve(row);
    },
  };
  private readonly poseExerciseProfileById = new Map<string, Row>();

  readonly poseSession = {
    findMany: (input: { where?: Row; select?: Row }) =>
      Promise.resolve(selectedRows(this.poseSessions, input)),
    createMany: (input: CreateManyInput) =>
      Promise.resolve(createManyRows(this.poseSessions, input)),
  };

  delegateRows(delegate: string) {
    switch (delegate) {
      case 'user':
        return [...this.users.values()];
      case 'authIdentity':
        return [...this.authIdentities.values()];
      case 'userProfile':
        return [...this.userProfiles.values()];
      case 'notificationPreference':
        return [...this.notificationPreferences.values()];
      case 'membershipPlan':
        return [...this.membershipPlans.values()];
      case 'membershipCatalogSettings':
        return [...this.membershipCatalogSettingsRows.values()];
      case 'membershipCard':
        return [...this.membershipCards.values()];
      case 'subscription':
        return [...this.subscriptions.values()];
      case 'payment':
        return [...this.paymentRowsById.values()];
      case 'commerceCheckoutHold':
        return [...this.commerceCheckoutHoldsById.values()];
      case 'amenity':
        return [...this.amenities.values()];
      case 'facilityFloorPlanMedia':
        return [...this.floorPlanMedia.values()];
      case 'appFeedback':
        return [...this.appFeedbackRows];
      case 'progressMetric':
        return [...this.progressMetrics];
      case 'attendanceLog':
        return [...this.attendanceLogs];
      case 'accountDeletionRequest':
        return [...this.accountDeletionRequests];
      case 'refreshToken':
        return [...this.refreshTokens];
      case 'otpVerification':
        return [...this.otpVerifications];
      case 'coachProfile':
        return [...this.coachProfiles.values()];
      case 'coachSpecialty':
        return [...this.coachSpecialties.values()];
      case 'coachProfileSpecialty':
        return [...this.coachProfileSpecialties];
      case 'coachAvailabilitySlot':
        return [...this.coachAvailabilitySlots];
      case 'coachClientRelationship':
        return [...this.coachClientRelationships];
      case 'recurringCoachingPlan':
        return [...this.recurringCoachingPlans.values()];
      case 'recurringCoachingBillingCycle':
        return [...this.recurringCoachingBillingCycles];
      case 'coachAppointment':
        return [...this.coachAppointments];
      case 'coachReview':
        return [...this.coachReviews];
      case 'amenityBooking':
        return [...this.amenityBookings];
      case 'amenityFeedback':
        return [...this.amenityFeedbackRows];
      case 'auditLog':
        return [...this.auditLogs];
      case 'exerciseCatalog':
        return [...this.exerciseCatalogRows];
      case 'muscleDefinition':
        return this.muscleDefinitionRows;
      case 'trainingPlan':
        return [...this.trainingPlans.values()];
      case 'trainingScheduleDay':
        return [...this.trainingScheduleDays];
      case 'planExercise':
        return [...this.planExercises];
      case 'workoutSession':
        return [...this.workoutSessions];
      case 'coachWorkoutAssignment':
        return [...this.coachWorkoutAssignments];
      case 'exerciseLog':
        return [...this.exerciseLogs];
      case 'poseExerciseProfile':
        return [...this.poseExerciseProfiles];
      case 'poseSession':
        return [...this.poseSessions];
      default: {
        const rows = this.genericRows.get(delegate) ?? [];
        this.genericRows.set(delegate, rows);
        return rows;
      }
    }
  }

  genericDelegate(delegate: string) {
    const rows = () => this.delegateRows(delegate);
    const withDefaults = (row: Row) => {
      const normalized = { ...row };
      if (
        (delegate === 'muscleDefinition' ||
          delegate === 'poseExerciseProfile') &&
        normalized.is_active === undefined
      ) {
        normalized.is_active = true;
      }
      return normalized;
    };
    return {
      count: () => Promise.resolve(rows().length),
      create: (input: { data: Row }) => {
        const row = withDefaults(input.data);
        rows().push(row);
        return Promise.resolve(row);
      },
      createMany: (input: CreateManyInput) =>
        Promise.resolve(
          createManyRows(rows(), {
            data: input.data.map((row) => withDefaults(row)),
          }),
        ),
      findFirst: (input: { where?: Row; select?: Row }) =>
        Promise.resolve(selectedRows(rows(), input)[0] ?? null),
      findMany: (input: { where?: Row; select?: Row }) =>
        Promise.resolve(selectedRows(rows(), input)),
      findUnique: (input: { where?: Row; select?: Row }) =>
        Promise.resolve(
          selectedRows(rows(), {
            where: input.where,
            select: input.select,
          })[0] ?? null,
        ),
      update: (input: { where?: Row; data: Row }) => {
        const row = rows().find((candidate) =>
          matchesWhere(candidate, input.where),
        );
        assert.ok(row, `${delegate} row should exist before update`);
        Object.assign(row, input.data);
        return Promise.resolve(row);
      },
      updateMany: (input: { where?: Row; data: Row }) => {
        const matchingRows = rows().filter((candidate) =>
          matchesWhere(candidate, input.where),
        );
        for (const row of matchingRows) Object.assign(row, input.data);
        return Promise.resolve({ count: matchingRows.length });
      },
      upsert: (input: UpsertInput) => {
        const existing = rows().find((row) => matchesWhere(row, input.where));
        if (existing) {
          Object.assign(existing, input.update);
          return Promise.resolve(existing);
        }
        const row = withDefaults(input.create);
        rows().push(row);
        return Promise.resolve(row);
      },
    };
  }

  syncCommerceRows() {
    this.commerceCheckoutHolds.length = 0;
    this.commerceCheckoutHolds.push(...this.commerceCheckoutHoldsById.values());
    this.payments.length = 0;
    this.payments.push(...this.paymentRowsById.values());
  }
}

function createInMemorySeedPrisma() {
  const target = new InMemorySeedPrisma();
  const delegateCache = new Map<string, Row>();
  return new Proxy(target, {
    get(current, property, receiver) {
      if (typeof property !== 'string') {
        return Reflect.get(current, property, receiver) as unknown;
      }
      const value: unknown = Reflect.get(
        current,
        property,
        receiver,
      ) as unknown;
      if (value !== undefined) {
        if (
          value instanceof Map ||
          Array.isArray(value) ||
          typeof value === 'function' ||
          value === null
        ) {
          return value;
        }
        if (typeof value !== 'object') return value;
        const cached = delegateCache.get(property);
        if (cached) return cached;
        const fallback = current.genericDelegate(property);
        const wrapped = new Proxy(value as Row, {
          get(delegate, method, delegateReceiver) {
            const existing: unknown = Reflect.get(
              delegate,
              method,
              delegateReceiver,
            ) as unknown;
            const fallbackValue: unknown = Reflect.get(
              fallback,
              method,
              fallback,
            ) as unknown;
            return existing ?? fallbackValue;
          },
        });
        delegateCache.set(property, wrapped);
        return wrapped;
      }
      const cached = delegateCache.get(property);
      if (cached) return cached;
      const generic = current.genericDelegate(property);
      delegateCache.set(property, generic as unknown as Row);
      return generic;
    },
  });
}

function seedConfig() {
  return parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--users=180',
    '--seed=20260523',
    '--anchor-date=2026-08-21T09:00:00.000Z',
    '--from=2025-08-21T09:00:00.000Z',
    '--to=2026-08-21T09:00:00.000Z',
  ]);
}

async function seedFixtureGymSchedules(
  prisma: ReturnType<typeof createInMemorySeedPrisma>,
  anchor: Date,
) {
  const schedulePrisma = prisma as unknown as {
    gymOperatingHour: { createMany: (input: CreateManyInput) => Promise<void> };
    gymSpecialSchedule: {
      createMany: (input: CreateManyInput) => Promise<void>;
    };
  };
  const fixed = (value: string) => new Date(`1970-01-01T${value}.000Z`);
  const dateOnly = (days: number) => {
    const value = new Date(anchor);
    value.setUTCDate(value.getUTCDate() + days);
    value.setUTCHours(0, 0, 0, 0);
    return value;
  };
  await schedulePrisma.gymOperatingHour.createMany({
    data: Array.from({ length: 7 }, (_, day) => ({
      id: seedId(`operating-hour:${day}`),
      closes_at: fixed(day === 0 ? '18:00:00' : '22:00:00'),
      day_of_week: day,
      is_active: true,
      is_closed: false,
      label: day === 0 ? 'Sunday short day' : 'Regular seeded hours',
      opens_at: fixed(day === 0 ? '08:00:00' : '06:00:00'),
    })),
  });
  await schedulePrisma.gymSpecialSchedule.createMany({
    data: [
      {
        id: seedId('special-schedule:maintenance-night'),
        closes_at: fixed('18:00:00'),
        ends_on: dateOnly(14),
        is_active: true,
        is_closed: false,
        opens_at: fixed('08:00:00'),
        pricing_note: 'Off-peak booking discount after maintenance window.',
        reason: 'Quarterly equipment maintenance',
        starts_on: dateOnly(14),
      },
      {
        id: seedId('special-schedule:holiday'),
        closes_at: null,
        ends_on: dateOnly(32),
        is_active: true,
        is_closed: true,
        opens_at: null,
        pricing_note: null,
        reason: 'Local holiday closure',
        starts_on: dateOnly(32),
      },
    ],
  });
}

async function seedFixtureMuscles(
  prisma: ReturnType<typeof createInMemorySeedPrisma>,
) {
  const musclePrisma = prisma as unknown as {
    muscleDefinition: { createMany: (input: CreateManyInput) => Promise<void> };
  };
  await musclePrisma.muscleDefinition.createMany({
    data: CANONICAL_MUSCLE_DEFINITIONS.map((muscle, index) => ({
      aliases: [...muscle.aliases, muscle.key],
      body_region: muscle.bodyRegion,
      id: seedId(`muscle-definition:${muscle.key}`),
      is_active: true,
      is_system: true,
      key: muscle.key,
      name: muscle.name,
      sort_order: muscle.sortOrder ?? index,
    })),
  });
}

function dateValue(row: Row, key: string) {
  const value = rowValue(row, key);
  assert.ok(value instanceof Date, `${key} should be a Date`);
  return value;
}

function numericValue(row: Row, key: string) {
  return Number(rowValue(row, key));
}

function rowsForUser(rows: readonly Row[], userId: string) {
  return rows.filter((row) => rowValue(row, 'user_id') === userId);
}

void test('actual seed domains preserve lifecycle/profile/QR/membership contracts', async () => {
  const prisma = createInMemorySeedPrisma();
  const state = createInitialSeedState();
  const config = seedConfig();
  const ctx: DynamicSeedContext = {
    config,
    notableIds: {},
    prisma: prisma as unknown as DynamicSeedContext['prisma'],
    rng: new SeedRandom(config.seed),
    state,
  };

  await seedUsersAuthProfiles(ctx);
  await seedMembershipPayments(ctx);
  await seedCheckoutHolds(ctx);
  prisma.syncCommerceRows();

  assert.equal(ctx.state.accounts.length, 180);
  assert.equal(prisma.users.size, 180);
  assert.equal(prisma.userProfiles.size, 180);
  assert.deepEqual(
    new Set(ctx.state.accounts.map((account) => account.role)),
    new Set([UserRole.admin, UserRole.staff, UserRole.coach, UserRole.member]),
  );
  for (const account of ctx.state.accounts) {
    assert.ok(prisma.userProfiles.has(ctx.state.userIds[account.key]));
  }

  for (const account of ctx.state.accounts.filter(
    (candidate) => candidate.role === UserRole.member,
  )) {
    const userId = ctx.state.userIds[account.key];
    const profile = prisma.userProfiles.get(userId);
    assert.ok(profile, `${account.key} profile should persist`);
    const metrics = rowsForUser(prisma.progressMetrics, userId).sort(
      (left, right) =>
        dateValue(left, 'recorded_at').getTime() -
        dateValue(right, 'recorded_at').getTime(),
    );
    const lifecycle = account.lifecycle!;
    if (lifecycle.activityStart === null || lifecycle.activityEnd === null) {
      assert.equal(metrics.length, 0, `${account.key} should have no metrics`);
      continue;
    }
    assert.ok(metrics.length > 0, `${account.key} should have metrics`);
    for (const metric of metrics) {
      const recordedAt = dateValue(metric, 'recorded_at');
      assert.ok(recordedAt >= lifecycle.activityStart);
      assert.ok(recordedAt <= lifecycle.activityEnd);
    }
    const latest = metrics.at(-1)!;
    assert.ok(
      Math.abs(
        numericValue(latest, 'weight_kg') - numericValue(profile, 'weight_kg'),
      ) <= 0.5,
      `${account.key} latest metric should match profile weight`,
    );
  }

  for (const otp of prisma.otpVerifications) {
    const createdAt = dateValue(otp, 'created_at');
    const expiresAt = dateValue(otp, 'expires_at');
    assert.ok(createdAt < expiresAt);
    if (rowValue(otp, 'consumed_at') !== null) {
      assert.ok(createdAt <= dateValue(otp, 'consumed_at'));
      assert.ok(dateValue(otp, 'consumed_at') <= expiresAt);
    }
    const account = ctx.state.accounts.find(
      (candidate) =>
        ctx.state.userIds[candidate.key] === String(rowValue(otp, 'user_id')),
    );
    assert.ok(account);
    if (
      account.emailVerified === false ||
      account.memberPersona === 'unverified'
    ) {
      assert.equal(rowValue(otp, 'purpose'), 'registration');
      assert.equal(rowValue(otp, 'consumed_at'), null);
    }
  }

  for (const request of prisma.accountDeletionRequests) {
    const account = ctx.state.accounts.find(
      (candidate) =>
        ctx.state.userIds[candidate.key] ===
        String(rowValue(request, 'userId')),
    );
    assert.ok(account);
    assert.ok(
      dateValue(request, 'createdAt') > account.lifecycle!.registeredAt,
    );
    if (rowValue(request, 'reviewedAt') !== null) {
      assert.ok(
        dateValue(request, 'reviewedAt') >= dateValue(request, 'createdAt'),
      );
    }
    if (account.memberPersona === 'archived') {
      assert.equal(rowValue(request, 'status'), 'approved');
      assert.ok(rowValue(request, 'reviewedAt'));
      assert.ok(
        dateValue(request, 'reviewedAt') <= account.lifecycle!.deletedAt!,
      );
    }
  }

  const noLiveRefreshDemos = [
    'member-archived',
    'member-suspended',
    'member-unverified',
    'member-pending',
    'member-frozen',
    'member-expired',
  ];
  for (const key of noLiveRefreshDemos) {
    assert.equal(
      rowsForUser(prisma.refreshTokens, ctx.state.userIds[key]).length,
      0,
      `${key} should not have a live refresh token`,
    );
  }
  for (const key of [
    'member-active',
    'member-premium',
    'member-checkout-abandoned',
  ]) {
    assert.ok(
      rowsForUser(prisma.refreshTokens, ctx.state.userIds[key]).length > 0,
      `${key} should retain active refresh behavior`,
    );
  }

  const checkoutId = ctx.state.userIds['member-checkout-abandoned'];
  const checkout = prisma.users.get(checkoutId)!;
  assert.equal(rowValue(checkout, 'role'), UserRole.member);
  assert.equal(rowValue(checkout, 'status'), 'active');
  assert.ok(rowValue(checkout, 'qr_code_token'));
  const checkoutQrRotatedAt = dateValue(checkout, 'qr_code_rotated_at');
  const checkoutQrExpiresAt = dateValue(checkout, 'qr_code_expires_at');
  assert.ok(
    checkoutQrRotatedAt >=
      ctx.state.accounts.find(
        (account) => account.key === 'member-checkout-abandoned',
      )!.lifecycle!.registeredAt,
  );
  assert.ok(checkoutQrRotatedAt <= config.anchorDate);
  assert.ok(checkoutQrExpiresAt > config.anchorDate);
  assert.equal(
    rowsForUser([...prisma.membershipCards.values()], checkoutId).length,
    0,
  );
  assert.equal(
    rowsForUser([...prisma.subscriptions.values()], checkoutId).length,
    0,
  );
  const checkoutPayments = rowsForUser(prisma.payments, checkoutId);
  assert.equal(checkoutPayments.length, 1);
  assert.equal(rowValue(checkoutPayments[0], 'status'), 'failed');
  assert.equal(
    rowValue(checkoutPayments[0], 'payable_type'),
    'commerce_checkout_hold',
  );
  assert.equal(rowValue(checkoutPayments[0], 'payment_stage'), 'full');
  const checkoutHolds = rowsForUser(prisma.commerceCheckoutHolds, checkoutId);
  assert.equal(checkoutHolds.length, 1);
  assert.equal(rowValue(checkoutHolds[0], 'status'), 'failed');
  assert.equal(rowValue(checkoutHolds[0], 'kind'), 'monthly');
  assert.equal(rowValue(checkoutHolds[0], 'membership_plan_id'), null);
  assert.equal(rowValue(checkoutHolds[0], 'subscription_id'), null);

  assertMembershipCommerceLineage({
    anchor: config.anchorDate,
    cards: [...prisma.membershipCards.values()].map((row) => ({
      id: String(rowValue(row, 'id')),
      price: rowValue(row, 'price'),
      purchased_at: dateValue(row, 'purchased_at'),
      user_id: String(rowValue(row, 'user_id')),
    })),
    holds: prisma.commerceCheckoutHolds.map((row) => ({
      amount: rowValue(row, 'amount'),
      appointment_id:
        (rowValue(row, 'appointment_id') as string | null) ?? null,
      booking_id: (rowValue(row, 'booking_id') as string | null) ?? null,
      consumed_at: (rowValue(row, 'consumed_at') as Date | null) ?? null,
      created_at: dateValue(row, 'created_at'),
      currency: String(rowValue(row, 'currency')),
      expires_at: dateValue(row, 'expires_at'),
      failure_reason:
        (rowValue(row, 'failure_reason') as string | null) ?? null,
      id: String(rowValue(row, 'id')),
      kind: String(rowValue(row, 'kind')),
      membership_card_id:
        (rowValue(row, 'membership_card_id') as string | null) ?? null,
      membership_plan_id:
        (rowValue(row, 'membership_plan_id') as string | null) ?? null,
      payment_id: (rowValue(row, 'payment_id') as string | null) ?? null,
      recurring_plan_id:
        (rowValue(row, 'recurring_plan_id') as string | null) ?? null,
      released_at: (rowValue(row, 'released_at') as Date | null) ?? null,
      status: String(rowValue(row, 'status')),
      subscription_id:
        (rowValue(row, 'subscription_id') as string | null) ?? null,
      user_id: String(rowValue(row, 'user_id')),
    })),
    membershipPlans: [...prisma.membershipPlans.values()].map((row) => ({
      id: String(rowValue(row, 'id')),
      price: rowValue(row, 'price'),
    })),
    payments: prisma.payments.map((row) => ({
      amount: rowValue(row, 'amount'),
      created_at: dateValue(row, 'created_at'),
      currency: String(rowValue(row, 'currency')),
      gateway_event_id:
        (rowValue(row, 'gateway_event_id') as string | null) ?? null,
      gateway_metadata: rowValue(row, 'gateway_metadata'),
      id: String(rowValue(row, 'id')),
      payable_id: String(rowValue(row, 'payable_id')),
      payable_type: String(rowValue(row, 'payable_type')),
      payment_stage: String(rowValue(row, 'payment_stage')),
      provider: String(rowValue(row, 'provider')),
      provider_ref: (rowValue(row, 'provider_ref') as string | null) ?? null,
      status: String(rowValue(row, 'status')),
      user_id: String(rowValue(row, 'user_id')),
      verified_at: (rowValue(row, 'verified_at') as Date | null) ?? null,
    })),
    subscriptions: [...prisma.subscriptions.values()].map((row) => ({
      expires_at: dateValue(row, 'expires_at'),
      id: String(rowValue(row, 'id')),
      payment_id: (rowValue(row, 'payment_id') as string | null) ?? null,
      plan_id: String(rowValue(row, 'plan_id')),
      plan: {
        price: prisma.membershipPlans.get(String(rowValue(row, 'plan_id')))
          ?.price,
      },
      starts_at: dateValue(row, 'starts_at'),
      user_id: String(rowValue(row, 'user_id')),
    })),
  });

  const premiumId = ctx.state.userIds['member-premium'];
  const premiumCycles = rowsForUser(
    [...prisma.subscriptions.values()],
    premiumId,
  ).sort(
    (left, right) =>
      dateValue(left, 'starts_at').getTime() -
      dateValue(right, 'starts_at').getTime(),
  );
  assert.ok(premiumCycles.length >= 4);
  const currentPremiumCycle = premiumCycles.at(-1);
  assert.ok(currentPremiumCycle);
  assert.equal(rowValue(currentPremiumCycle, 'status'), 'active');
  assert.ok(dateValue(currentPremiumCycle, 'expires_at') > config.anchorDate);
  for (let index = 1; index < premiumCycles.length; index += 1) {
    assert.ok(
      dateValue(premiumCycles[index - 1], 'expires_at') <=
        dateValue(premiumCycles[index], 'starts_at'),
    );
  }
  for (const cycle of premiumCycles) {
    assert.equal(
      dateValue(cycle, 'expires_at').getTime() -
        dateValue(cycle, 'starts_at').getTime(),
      30 * 24 * 60 * 60 * 1_000,
    );
  }

  const expiredId = ctx.state.userIds['member-expired'];
  const expiredCycles = rowsForUser(
    [...prisma.subscriptions.values()],
    expiredId,
  );
  assert.ok(expiredCycles.length >= 1);
  assert.ok(
    expiredCycles.every(
      (cycle) =>
        rowValue(cycle, 'status') === 'expired' &&
        dateValue(cycle, 'expires_at') < config.anchorDate,
    ),
  );

  const frozenId = ctx.state.userIds['member-frozen'];
  const frozenCycles = rowsForUser(
    [...prisma.subscriptions.values()],
    frozenId,
  );
  assert.equal(rowValue(frozenCycles.at(-1)!, 'status'), 'suspended');
  assert.ok(dateValue(frozenCycles.at(-1)!, 'expires_at') < config.anchorDate);
  assert.ok(
    prisma.commerceCheckoutHolds.some(
      (hold) =>
        rowValue(hold, 'user_id') === frozenId &&
        rowValue(hold, 'status') === 'failed',
    ),
  );
  assert.equal(
    prisma.payments.some(
      (payment) =>
        rowValue(payment, 'status') === 'pending' ||
        rowValue(payment, 'status') === 'processing',
    ),
    false,
  );
});

void test('actual facilities seed preserves amenity identity, venue capacity, and commerce lineage', async () => {
  const prisma = createInMemorySeedPrisma();
  // This additive admin row intentionally shares the canonical name but is
  // not a production-bookable resource.
  prisma.amenities.set('admin-boxing-ring', {
    id: 'admin-boxing-ring',
    name: 'Boxing Ring',
    capacity: 0,
    is_active: true,
    is_mapped: true,
    is_reservable: true,
    status: null,
    minimum_hours: 1,
    requires_subscription: false,
    hourly_rate: 450,
  });
  const state = createInitialSeedState();
  const config = seedConfig();
  const ctx: DynamicSeedContext = {
    config,
    notableIds: {},
    prisma: prisma as unknown as DynamicSeedContext['prisma'],
    rng: new SeedRandom(config.seed),
    state,
  };

  await seedUsersAuthProfiles(ctx);
  await seedMembershipPayments(ctx);
  await seedFacilitiesCoaching(ctx);
  prisma.syncCommerceRows();

  const coachAccountByProfile = new Map(
    [...prisma.coachProfiles.values()].map((profile) => [
      String(rowValue(profile, 'id')),
      ctx.state.accounts.find(
        (account) =>
          ctx.state.userIds[account.key] ===
          String(rowValue(profile, 'user_id')),
      ),
    ]),
  );
  const activeCoachIds = new Set(
    [...coachAccountByProfile.entries()]
      .filter(([, account]) => account?.coachLifecycle === 'active')
      .map(([id]) => id),
  );
  for (const profile of prisma.coachProfiles.values()) {
    const account = coachAccountByProfile.get(String(rowValue(profile, 'id')));
    const active = account?.coachLifecycle === 'active';
    assert.equal(rowValue(profile, 'is_available_for_booking'), active);
    assert.equal(rowValue(profile, 'monthly_offer_active'), active);
    const reviews = prisma.coachReviews.filter(
      (review) => rowValue(review, 'coach_id') === rowValue(profile, 'id'),
    );
    assert.equal(rowValue(profile, 'rating_count'), reviews.length);
    assert.equal(
      reviews.length === 0
        ? rowValue(profile, 'average_rating') === null
        : Number(rowValue(profile, 'average_rating')) ===
            Number(
              (
                reviews.reduce(
                  (sum, review) => sum + Number(rowValue(review, 'rating')),
                  0,
                ) / reviews.length
              ).toFixed(2),
            ),
      true,
    );
  }
  assert.ok(
    ctx.state.accounts.some(
      (account) =>
        account.role === UserRole.coach &&
        account.coachQuality === 'excellent' &&
        account.coachWorkload === 'low',
    ),
  );
  assert.ok(
    ctx.state.accounts.some(
      (account) =>
        account.role === UserRole.coach &&
        account.coachLifecycle === 'active' &&
        account.coachQuality === 'poor',
    ),
  );
  for (const account of ctx.state.accounts.filter(
    (candidate) =>
      candidate.role === UserRole.coach &&
      (candidate.coachLifecycle === 'paused' ||
        candidate.coachLifecycle === 'former'),
  )) {
    const profileId = [...prisma.coachProfiles.values()].find(
      (profile) =>
        rowValue(profile, 'user_id') === ctx.state.userIds[account.key],
    )?.id;
    assert.ok(
      prisma.coachReviews.some(
        (review) => rowValue(review, 'coach_id') === profileId,
      ),
      `${account.key} should retain historical review evidence`,
    );
  }
  assert.ok(
    prisma.coachAvailabilitySlots.every((slot) =>
      activeCoachIds.has(String(rowValue(slot, 'coach_id'))),
    ),
  );
  const coachingProfiles = new Map(
    ctx.state.accounts
      .filter((account) => account.role === UserRole.member)
      .map((account) => [
        ctx.state.userIds[account.key],
        account.coachingProfile,
      ]),
  );
  for (const appointment of prisma.coachAppointments) {
    const behavior = coachingProfiles.get(
      String(rowValue(appointment, 'user_id')),
    );
    assert.ok(
      behavior === 'one_time' ||
        behavior === 'recurring_active' ||
        behavior === 'recurring_former',
      `appointment ${String(rowValue(appointment, 'id'))} has implicit coaching behavior`,
    );
    if (rowValue(appointment, 'status') === 'confirmed') {
      assert.ok(dateValue(appointment, 'scheduled_at') >= config.anchorDate);
      assert.ok(
        activeCoachIds.has(String(rowValue(appointment, 'coach_id'))),
        'future coaching appointment must use an active coach',
      );
    }
    const hold = prisma.commerceCheckoutHolds.find(
      (candidate) =>
        rowValue(candidate, 'appointment_id') === rowValue(appointment, 'id'),
    );
    if (rowValue(appointment, 'recurring_plan_id') === null) {
      assert.ok(hold);
      const holdRow = hold;
      assert.equal(rowValue(holdRow, 'kind'), 'one_time');
      assert.equal(rowValue(holdRow, 'status'), 'consumed');
      const payment = prisma.payments.find(
        (candidate) =>
          rowValue(candidate, 'id') === rowValue(holdRow, 'payment_id'),
      );
      assert.ok(payment);
      const paymentRow = payment;
      assert.equal(
        rowValue(paymentRow, 'payable_type'),
        'commerce_checkout_hold',
      );
      assert.equal(rowValue(paymentRow, 'status'), 'completed');
      assert.equal(rowValue(paymentRow, 'payment_stage'), 'full');
      assert.equal(
        Number(rowValue(paymentRow, 'amount')),
        Number(rowValue(appointment, 'total_amount')),
      );
    }
  }
  const coachingProducts = new Set(
    prisma.coachAppointments.map((appointment) =>
      String(rowValue(appointment, 'user_id')),
    ),
  );
  for (const account of ctx.state.accounts.filter(
    (candidate) =>
      candidate.role === UserRole.member &&
      candidate.coachingProfile === 'checkout_failed',
  )) {
    const userId = ctx.state.userIds[account.key];
    assert.equal(coachingProducts.has(userId), false);
    assert.equal(
      prisma.recurringCoachingPlans.has(
        seedId(`recurring-plan:${account.key}`),
      ),
      false,
    );
    const failedHolds = prisma.commerceCheckoutHolds.filter(
      (hold) => rowValue(hold, 'user_id') === userId,
    );
    assert.ok(
      failedHolds.some(
        (hold) =>
          (rowValue(hold, 'kind') === 'one_time' ||
            rowValue(hold, 'kind') === 'monthly') &&
          (rowValue(hold, 'status') === 'failed' ||
            rowValue(hold, 'status') === 'expired') &&
          rowValue(hold, 'appointment_id') === null &&
          rowValue(hold, 'recurring_plan_id') === null,
      ),
    );
  }
  for (const plan of prisma.recurringCoachingPlans.values()) {
    const account = ctx.state.accounts.find(
      (candidate) =>
        ctx.state.userIds[candidate.key] ===
        String(rowValue(plan, 'member_id')),
    );
    assert.ok(
      account?.coachingProfile === 'recurring_active' ||
        account?.coachingProfile === 'recurring_former',
    );
    const relationship = prisma.coachClientRelationships.find(
      (candidate) =>
        rowValue(candidate, 'coach_id') === rowValue(plan, 'coach_id') &&
        rowValue(candidate, 'member_id') === rowValue(plan, 'member_id'),
    );
    assert.ok(relationship);
    assert.equal(
      rowValue(relationship, 'status'),
      account?.coachingProfile === 'recurring_active' ? 'active' : 'terminated',
    );
    assert.ok(
      prisma.recurringCoachingBillingCycles.some(
        (cycle) =>
          rowValue(cycle, 'recurring_plan_id') === rowValue(plan, 'id'),
      ),
    );
    assert.equal(
      rowValue(plan, 'completed_sessions'),
      prisma.coachAppointments.filter(
        (appointment) =>
          rowValue(appointment, 'recurring_plan_id') === rowValue(plan, 'id') &&
          rowValue(appointment, 'status') === 'completed',
      ).length,
    );
  }

  assert.equal(ctx.state.amenityIds['boxing-ring'], 'admin-boxing-ring');
  assert.equal(prisma.amenities.get('admin-boxing-ring')?.capacity, 0);
  assert.ok(prisma.amenities.size >= 3);
  assert.ok(prisma.amenityBookings.length > 0);
  for (const booking of prisma.amenityBookings) {
    const amenity = prisma.amenities.get(
      String(rowValue(booking, 'amenity_id')),
    );
    assert.ok(amenity);
    assert.ok(Number(rowValue(amenity, 'capacity')) > 0);
    assert.notEqual(rowValue(booking, 'amenity_id'), 'admin-boxing-ring');
  }
  for (const hold of prisma.commerceCheckoutHolds) {
    if (rowValue(hold, 'amenity_id') !== null) {
      assert.notEqual(rowValue(hold, 'amenity_id'), 'admin-boxing-ring');
    }
  }

  const activeId = ctx.state.userIds['member-active'];
  const premiumId = ctx.state.userIds['member-premium'];
  const frozenId = ctx.state.userIds['member-frozen'];
  const expiredId = ctx.state.userIds['member-expired'];
  assert.ok(
    prisma.amenityBookings.some(
      (row) =>
        rowValue(row, 'user_id') === activeId &&
        rowValue(row, 'status') === 'confirmed' &&
        dateValue(row, 'starts_at') >= config.anchorDate,
    ),
  );
  assert.ok(
    prisma.amenityBookings.some(
      (row) =>
        rowValue(row, 'user_id') === premiumId &&
        rowValue(row, 'status') === 'completed' &&
        dateValue(row, 'starts_at') < config.anchorDate,
    ),
  );
  assert.ok(
    prisma.amenityBookings.some(
      (row) =>
        rowValue(row, 'user_id') === frozenId &&
        rowValue(row, 'status') === 'cancelled',
    ),
  );
  assert.ok(
    prisma.amenityBookings.some(
      (row) =>
        rowValue(row, 'user_id') === expiredId &&
        rowValue(row, 'status') === 'no_show',
    ),
  );

  const paidBooking = prisma.amenityBookings.find(
    (row) => rowValue(row, 'status') === 'completed',
  );
  assert.ok(paidBooking);
  const paidHold = prisma.commerceCheckoutHolds.find(
    (row) => rowValue(row, 'booking_id') === rowValue(paidBooking, 'id'),
  );
  assert.ok(paidHold);
  const paidPayment = prisma.payments.find(
    (row) => rowValue(row, 'payable_id') === rowValue(paidHold, 'id'),
  );
  assert.ok(paidPayment);
  const lineageBooking = {
    id: String(rowValue(paidBooking, 'id')),
    amenity_id: String(rowValue(paidBooking, 'amenity_id')),
    starts_at: dateValue(paidBooking, 'starts_at'),
    ends_at: dateValue(paidBooking, 'ends_at'),
    total_amount: rowValue(paidBooking, 'total_amount'),
    downpayment_amount: rowValue(paidBooking, 'downpayment_amount'),
    balance_amount: rowValue(paidBooking, 'balance_amount'),
    downpayment_paid_at: dateValue(paidBooking, 'downpayment_paid_at'),
    balance_paid_at: dateValue(paidBooking, 'balance_paid_at'),
  };
  const lineageHold = {
    id: String(rowValue(paidHold, 'id')),
    kind: String(rowValue(paidHold, 'kind')),
    status: String(rowValue(paidHold, 'status')),
    booking_id: String(rowValue(paidHold, 'booking_id')),
    amenity_id: String(rowValue(paidHold, 'amenity_id')),
    scheduled_at: dateValue(paidHold, 'scheduled_at'),
    ends_at: dateValue(paidHold, 'ends_at'),
    amount: rowValue(paidHold, 'amount'),
    created_at: dateValue(paidHold, 'created_at'),
    expires_at: dateValue(paidHold, 'expires_at'),
    consumed_at: dateValue(paidHold, 'consumed_at'),
    released_at: null,
    failure_reason: null,
    payment_id: String(rowValue(paidHold, 'payment_id')),
  };
  const lineagePayment = {
    id: String(rowValue(paidPayment, 'id')),
    amount: rowValue(paidPayment, 'amount'),
    status: String(rowValue(paidPayment, 'status')),
    payment_stage: String(rowValue(paidPayment, 'payment_stage')),
    provider: String(rowValue(paidPayment, 'provider')),
    payable_type: String(rowValue(paidPayment, 'payable_type')),
    payable_id: String(rowValue(paidPayment, 'payable_id')),
  };
  assert.doesNotThrow(() =>
    assertVenueBookingLineage({
      booking: lineageBooking,
      holds: [lineageHold],
      payments: [lineagePayment],
    }),
  );

  const start = new Date(config.anchorDate.getTime() + 24 * 60 * 60 * 1_000);
  const interval = (source: 'booking' | 'hold') => ({
    amenityId: 'capacity-four',
    capacity: 4,
    start,
    end: new Date(start.getTime() + 60 * 60 * 1_000),
    source,
  });
  assert.equal(
    hasVenueCapacityOverflow([interval('booking'), interval('hold')]),
    false,
  );
  assert.equal(
    hasVenueCapacityOverflow([
      interval('booking'),
      interval('hold'),
      interval('booking'),
      interval('hold'),
    ]),
    false,
  );
  assert.equal(
    hasVenueCapacityOverflow([
      interval('booking'),
      interval('hold'),
      interval('hold'),
      interval('hold'),
      interval('hold'),
    ]),
    true,
  );

  assert.throws(() =>
    assertVenueBookingLineage({
      booking: lineageBooking,
      holds: [lineageHold, { ...lineageHold, id: 'duplicate-hold' }],
      payments: [
        lineagePayment,
        { ...lineagePayment, id: 'duplicate-payment' },
      ],
    }),
  );
  assert.throws(() =>
    assertVenueBookingLineage({
      booking: lineageBooking,
      holds: [
        {
          ...lineageHold,
          consumed_at: new Date(lineageHold.expires_at.getTime() + 1),
        },
      ],
      payments: [lineagePayment],
    }),
  );
  assert.doesNotThrow(() =>
    assertVenueBookingLineage({
      booking: {
        ...lineageBooking,
        total_amount: 0,
        downpayment_amount: 0,
        balance_amount: 0,
        balance_paid_at: null,
      },
      holds: [],
      payments: [],
    }),
  );
  assert.throws(() =>
    assertVenueBookingLineage({
      booking: lineageBooking,
      holds: [],
      payments: [lineagePayment],
    }),
  );
});

void test('full coaching fixture runs fitness, reconciliation, and shared integrity', async () => {
  const prisma = createInMemorySeedPrisma();
  const state = createInitialSeedState();
  const config = seedConfig();
  const ctx: DynamicSeedContext = {
    config,
    notableIds: {},
    prisma: prisma as unknown as DynamicSeedContext['prisma'],
    rng: new SeedRandom(config.seed),
    state,
  };

  await seedUsersAuthProfiles(ctx);
  await bootstrapDefaults(prisma as unknown as DynamicSeedContext['prisma'], {
    includeUsers: false,
    referenceDate: config.anchorDate,
  });
  await seedFixtureMuscles(prisma);
  await seedMembershipPayments(ctx);
  await seedFixtureGymSchedules(prisma, config.anchorDate);
  await seedFacilitiesCoaching(ctx);
  await seedFitnessGamification(ctx);
  await reconcileCoachingContracts(ctx);
  await seedNutritionInventory(ctx);
  await seedAiGymAnalytics(ctx);
  prisma.syncCommerceRows();

  const integrity = await runSeedIntegrityAudit(ctx);
  assert.equal(integrity.status, 'passed');

  const seedCoachId = ctx.state.coachProfileIds.coach;
  const activeMemberId = ctx.state.userIds['member-active'];
  const premiumMemberId = ctx.state.userIds['member-premium'];
  const premiumPlanId = seedId('recurring-plan:member-premium');
  const seedCoachAppointments = prisma.coachAppointments.filter(
    (appointment) => rowValue(appointment, 'coach_id') === seedCoachId,
  );
  assert.ok(
    seedCoachAppointments.some(
      (appointment) => rowValue(appointment, 'user_id') === activeMemberId,
    ),
  );
  assert.ok(
    seedCoachAppointments.some(
      (appointment) =>
        rowValue(appointment, 'user_id') === premiumMemberId &&
        rowValue(appointment, 'recurring_plan_id') === premiumPlanId,
    ),
  );

  const completedPremiumAppointments = prisma.coachAppointments.filter(
    (appointment) =>
      rowValue(appointment, 'user_id') === premiumMemberId &&
      rowValue(appointment, 'recurring_plan_id') === premiumPlanId &&
      rowValue(appointment, 'status') === 'completed',
  );
  assert.ok(completedPremiumAppointments.length > 0);
  for (const appointment of completedPremiumAppointments) {
    const assignment = prisma.coachWorkoutAssignments.find(
      (candidate) =>
        rowValue(candidate, 'appointment_id') === rowValue(appointment, 'id'),
    );
    assert.equal(rowValue(assignment!, 'state'), 'completed');
    const session = prisma.workoutSessions.find(
      (candidate) =>
        rowValue(candidate, 'id') ===
        rowValue(assignment!, 'workout_session_id'),
    );
    assert.equal(rowValue(session!, 'status'), 'completed');
  }

  const failedMemberIds = new Set(
    ctx.state.accounts
      .filter((account) => account.coachingProfile === 'checkout_failed')
      .map((account) => ctx.state.userIds[account.key]),
  );
  assert.equal(
    prisma.coachAppointments.some((appointment) =>
      failedMemberIds.has(String(rowValue(appointment, 'user_id'))),
    ),
    false,
  );
  assert.equal(
    [...prisma.recurringCoachingPlans.values()].some((plan) =>
      failedMemberIds.has(String(rowValue(plan, 'member_id'))),
    ),
    false,
  );
  for (const hold of prisma.commerceCheckoutHolds.filter((candidate) =>
    failedMemberIds.has(String(rowValue(candidate, 'user_id'))),
  )) {
    assert.equal(rowValue(hold, 'appointment_id'), null);
    assert.equal(rowValue(hold, 'recurring_plan_id'), null);
  }
});
