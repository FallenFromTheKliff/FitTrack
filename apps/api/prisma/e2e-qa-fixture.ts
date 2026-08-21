import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  FitnessGoal,
  PlanSource,
  PrismaClient,
  SessionStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { localEnvFilePath } from "../env-path";

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const FIXTURE_TITLE_PREFIX = "E2E-QA Coach Plan";
const FIXTURE_SCHEDULE_DAYS: ReadonlyArray<{
  dayOfWeek: number;
  focusLabel: string;
}> = [
  { dayOfWeek: 0, focusLabel: "Completed push" },
  { dayOfWeek: 1, focusLabel: "Scheduled pull" },
  { dayOfWeek: 2, focusLabel: "Skipped legs" },
];
const FIXTURE_DIR = resolve(process.cwd(), "..", "..", ".artifacts", "e2e-qa");
const FIXTURE_PATH = resolve(FIXTURE_DIR, "coach-plan-fixture.json");
const DYNAMIC_SEED_MANIFEST_PATH = resolve(
  process.cwd(),
  "..",
  "..",
  ".artifacts",
  "dynamic-seed-manifest.json",
);

type SeedCredential = {
  email: string;
  label: string;
  role: string;
};

type DynamicSeedManifest = {
  credentials: SeedCredential[];
};

type FixtureManifest = {
  coachEmail: string;
  coachId: string;
  createdAt: string;
  memberEmail: string;
  memberId: string;
  inactivePlanId: string;
  planId: string;
  previousActivePlanId: string | null;
  runTag: string;
  sessionIds: string[];
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the scoped E2E-QA fixture.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function getManilaDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(value);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value ?? 1),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    year: Number(parts.find((part) => part.type === "year")?.value ?? 1970),
  };
}

function getWeekDate(dayOfWeek: number) {
  const today = getManilaDateParts();
  const todayAtNoonUtc = new Date(
    Date.UTC(today.year, today.month - 1, today.day, 12),
  );
  const sundayOffset = todayAtNoonUtc.getUTCDay();

  return new Date(
    Date.UTC(
      today.year,
      today.month - 1,
      today.day - sundayOffset + dayOfWeek,
      2,
      0,
      0,
    ),
  );
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function getSeedUsers() {
  const seed = await readJson<DynamicSeedManifest>(DYNAMIC_SEED_MANIFEST_PATH);
  if (!seed) {
    throw new Error(
      "Dynamic seed manifest is missing. Run the realistic local seed before real-data E2E QA.",
    );
  }

  const memberCredential = seed.credentials.find(
    (credential) =>
      credential.role.toLowerCase() === "member" &&
      credential.label.toLowerCase().includes("active"),
  );
  const coachCredential = seed.credentials.find(
    (credential) => credential.role.toLowerCase() === "coach",
  );

  if (!memberCredential || !coachCredential) {
    throw new Error(
      "The realistic seed manifest needs one active member and one coach credential.",
    );
  }

  const [member, coach] = await Promise.all([
    prisma.user.findFirst({
      where: {
        auth_identities: { some: { identifier: memberCredential.email } },
        role: UserRole.member,
        status: UserStatus.active,
      },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: {
        auth_identities: { some: { identifier: coachCredential.email } },
        role: UserRole.coach,
        status: UserStatus.active,
      },
      select: { id: true },
    }),
  ]);

  if (!member || !coach) {
    throw new Error(
      "The selected realistic seed users are not available in the local database.",
    );
  }

  return {
    coachEmail: coachCredential.email,
    coachId: coach.id,
    memberEmail: memberCredential.email,
    memberId: member.id,
  };
}

async function cleanupFixture(fixture: FixtureManifest | null) {
  if (!fixture) return;

  const plans = await prisma.trainingPlan.findMany({
    where: { id: { in: [fixture.planId, fixture.inactivePlanId] } },
    select: { id: true, title: true, user_id: true },
  });

  if (
    plans.some(
      (plan) =>
        plan.user_id !== fixture.memberId ||
        !plan.title.startsWith(FIXTURE_TITLE_PREFIX),
    )
  ) {
    throw new Error("Refusing to clean a fixture that is outside the E2E-QA scope.");
  }

  if (plans.length > 0) {
    await prisma.$transaction(async (transaction) => {
      await transaction.workoutSession.deleteMany({
        where: {
          id: { in: fixture.sessionIds },
          plan_id: { in: [fixture.planId, fixture.inactivePlanId] },
          user_id: fixture.memberId,
        },
      });
      await transaction.trainingPlan.deleteMany({
        where: { id: { in: [fixture.planId, fixture.inactivePlanId] } },
      });

      await transaction.trainingPlan.updateMany({
        where: {
          user_id: fixture.memberId,
          is_active: true,
          is_template: false,
        },
        data: { is_active: false },
      });

      if (fixture.previousActivePlanId) {
        await transaction.trainingPlan.updateMany({
          where: {
            id: fixture.previousActivePlanId,
            user_id: fixture.memberId,
            is_template: false,
          },
          data: { is_active: true },
        });
      }
    });
  }

  await rm(FIXTURE_PATH, { force: true });
}

async function applyFixture() {
  await cleanupFixture(await readJson<FixtureManifest>(FIXTURE_PATH));

  const users = await getSeedUsers();
  const exercise = await prisma.exerciseCatalog.findFirst({
    where: { is_active: true },
    select: { id: true },
  });
  if (!exercise) {
    throw new Error("No active exercise exists for the E2E-QA coach plan.");
  }

  const runTag = `E2E-QA-${Date.now()}`;
  const completedAt = getWeekDate(0);
  const skippedAt = getWeekDate(2);
  const previousActivePlan = await prisma.trainingPlan.findFirst({
    where: {
      user_id: users.memberId,
      is_active: true,
      is_template: false,
    },
    orderBy: { updated_at: "desc" },
    select: { id: true },
  });

  const created = await prisma.$transaction(async (transaction) => {
    await transaction.trainingPlan.updateMany({
      where: {
        user_id: users.memberId,
        is_active: true,
        is_template: false,
      },
      data: { is_active: false },
    });

    const plan = await transaction.trainingPlan.create({
      data: {
        coach_id: users.coachId,
        days_per_week: 3,
        duration_weeks: 4,
        goal: FitnessGoal.maintenance,
        is_active: true,
        is_template: false,
        source: PlanSource.coach_assigned,
        title: `${FIXTURE_TITLE_PREFIX} ${runTag}`,
        user_id: users.memberId,
        schedule_days: {
          create: FIXTURE_SCHEDULE_DAYS.map(({ dayOfWeek, focusLabel }) => ({
            day_of_week: dayOfWeek,
            focus_label: `E2E-QA ${focusLabel}`,
            notes: "Temporary real-data QA fixture.",
            week_number: 1,
            exercises: {
              create: {
                exercise_id: exercise.id,
                order_index: 0,
                reps: 8,
                rest_seconds: 90,
                sets: 3,
                weight_kg_target: 30,
              },
            },
          })),
        },
      },
      select: { id: true },
    });

    const inactivePlan = await transaction.trainingPlan.create({
      data: {
        coach_id: users.coachId,
        days_per_week: 1,
        duration_weeks: 4,
        goal: FitnessGoal.maintenance,
        is_active: false,
        is_template: false,
        source: PlanSource.coach_assigned,
        title: `${FIXTURE_TITLE_PREFIX} Selectable ${runTag}`,
        user_id: users.memberId,
        schedule_days: {
          create: {
            day_of_week: 4,
            focus_label: "E2E-QA Selectable full body",
            notes: "Temporary real-data QA fixture.",
            week_number: 1,
            exercises: {
              create: {
                exercise_id: exercise.id,
                order_index: 0,
                reps: 10,
                rest_seconds: 90,
                sets: 3,
                weight_kg_target: 20,
              },
            },
          },
        },
      },
      select: { id: true },
    });

    const sessions = await transaction.workoutSession.createManyAndReturn({
      data: [
      {
        completed_at: new Date(completedAt.getTime() + 45 * 60 * 1000),
          last_activity_at: new Date(completedAt.getTime() + 45 * 60 * 1000),
          plan_id: plan.id,
          started_at: completedAt,
        status: SessionStatus.completed,
        user_id: users.memberId,
      },
      {
        last_activity_at: new Date(completedAt.getTime() - 30 * 60 * 1000),
        plan_id: plan.id,
        started_at: new Date(completedAt.getTime() - 30 * 60 * 1000),
        status: SessionStatus.in_progress,
        user_id: users.memberId,
      },
      {
          cancelled_at: new Date(skippedAt.getTime() + 10 * 60 * 1000),
          last_activity_at: new Date(skippedAt.getTime() + 10 * 60 * 1000),
          plan_id: plan.id,
          started_at: skippedAt,
          status: SessionStatus.cancelled,
          user_id: users.memberId,
        },
      ],
      select: { id: true },
    });

    return { inactivePlan, plan, sessions };
  });

  const fixture: FixtureManifest = {
    ...users,
    createdAt: new Date().toISOString(),
    inactivePlanId: created.inactivePlan.id,
    planId: created.plan.id,
    previousActivePlanId: previousActivePlan?.id ?? null,
    runTag,
    sessionIds: created.sessions.map((session) => session.id),
  };

  try {
    await mkdir(FIXTURE_DIR, { recursive: true });
    await writeFile(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  } catch (error) {
    await cleanupFixture(fixture);
    throw error;
  }
  console.log(
    JSON.stringify({
      status: "APPLIED",
      planId: fixture.planId,
      runTag: fixture.runTag,
      sessionCount: fixture.sessionIds.length,
    }),
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "apply") {
    await applyFixture();
    return;
  }
  if (command === "cleanup") {
    await cleanupFixture(await readJson<FixtureManifest>(FIXTURE_PATH));
    console.log(JSON.stringify({ status: "CLEANED" }));
    return;
  }

  throw new Error("Usage: e2e-qa-fixture.ts <apply|cleanup>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
