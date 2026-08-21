# FitTrack — S7 — Fitness & Training
_Always include `00-global-contracts.md` alongside this file._

---

# S7 — Fitness & Training

## Overview
Exercise catalog (seeded + admin-managed), AI-generated and manual training plans, workout session logging, and pose detection via WebSocket. All registered users including walk-ins have full access.

## Prisma Schema

```prisma
model ExerciseCatalog {
  id            String           @id @default(uuid()) @db.Uuid
  name          String           @unique @db.VarChar(255)
  muscle_group  String           @db.VarChar(100)
  category      ExerciseCategory
  description   String?
  instructions  String?
  video_url     String?          @db.VarChar(500)
  image_url     String?          @db.VarChar(500)
  is_active     Boolean          @default(true)
  created_at    DateTime         @default(now()) @db.Timestamptz(6)
  updated_at    DateTime         @updatedAt @db.Timestamptz(6)

  plan_exercises PlanExercise[]
  exercise_logs  ExerciseLog[]

  @@index([muscle_group, is_active])
  @@index([category])
  @@map("exercise_catalog")
}

enum ExerciseCategory { strength cardio flexibility balance }

model TrainingPlan {
  id                   String     @id @default(uuid()) @db.Uuid
  user_id              String     @db.Uuid
  coach_id             String?    @db.Uuid
  source               PlanSource
  title                String     @db.VarChar(255)
  goal                 FitnessGoal
  duration_weeks       Int
  days_per_week        Int        @db.SmallInt
  is_active            Boolean    @default(false)
  is_template          Boolean    @default(false)
  ai_generation_prompt Json?
  created_at           DateTime   @default(now()) @db.Timestamptz(6)
  updated_at           DateTime   @updatedAt @db.Timestamptz(6)

  user                 User          @relation(fields: [user_id], references: [id])
  coach                CoachProfile? @relation(fields: [coach_id], references: [id])
  schedule_days        TrainingScheduleDay[]
  sessions             WorkoutSession[]

  // Partial unique via raw migration:
  // CREATE UNIQUE INDEX one_active_plan_per_user
  //   ON training_plans(user_id) WHERE is_active=true AND is_template=false;
  @@index([user_id, is_active])
  @@map("training_plans")
}

enum PlanSource { ai_generated coach_assigned self_created }

model TrainingScheduleDay {
  id          String   @id @default(uuid()) @db.Uuid
  plan_id     String   @db.Uuid
  week_number Int      @db.SmallInt
  day_of_week Int      @db.SmallInt
  focus_label String?  @db.VarChar(100)
  notes       String?
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  plan      TrainingPlan   @relation(fields: [plan_id], references: [id], onDelete: Cascade)
  exercises PlanExercise[]

  @@index([plan_id, week_number, day_of_week])
  @@map("training_schedule_days")
}

model PlanExercise {
  id               String   @id @default(uuid()) @db.Uuid
  schedule_day_id  String   @db.Uuid
  exercise_id      String   @db.Uuid
  sets             Int      @db.SmallInt
  reps             Int?     @db.SmallInt
  duration_seconds Int?
  rest_seconds     Int      @default(60)
  weight_kg_target Decimal? @db.Decimal(6,2)
  notes            String?
  order_index      Int      @default(0) @db.SmallInt
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  schedule_day TrainingScheduleDay @relation(fields: [schedule_day_id], references: [id], onDelete: Cascade)
  exercise     ExerciseCatalog     @relation(fields: [exercise_id], references: [id])

  @@index([schedule_day_id, order_index])
  @@map("plan_exercises")
}

model WorkoutSession {
  id               String        @id @default(uuid()) @db.Uuid
  user_id          String        @db.Uuid
  plan_id          String?       @db.Uuid
  status           SessionStatus @default(in_progress)
  started_at       DateTime      @db.Timestamptz(6)
  completed_at     DateTime?     @db.Timestamptz(6)
  cancelled_at     DateTime?     @db.Timestamptz(6)
  duration_seconds Int?
  total_volume_kg  Decimal?      @db.Decimal(10,2)
  last_activity_at DateTime      @db.Timestamptz(6)
  created_at       DateTime      @default(now()) @db.Timestamptz(6)
  updated_at       DateTime      @updatedAt @db.Timestamptz(6)

  user          User           @relation(fields: [user_id], references: [id])
  plan          TrainingPlan?  @relation(fields: [plan_id], references: [id])
  exercise_logs ExerciseLog[]

  @@index([user_id, status])
  @@index([user_id, started_at(sort: Desc)])
  @@map("workout_sessions")
}

enum SessionStatus { in_progress completed cancelled }

model ExerciseLog {
  id               String   @id @default(uuid()) @db.Uuid
  session_id       String   @db.Uuid
  user_id          String   @db.Uuid
  plan_exercise_id String?  @db.Uuid
  exercise_id      String   @db.Uuid
  set_number       Int      @db.SmallInt
  reps_target      Int?     @db.SmallInt
  reps_completed   Int?     @db.SmallInt
  reps_ai_counted  Int?     @db.SmallInt
  weight_kg        Decimal? @db.Decimal(6,2)
  duration_seconds Int?
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  session      WorkoutSession  @relation(fields: [session_id], references: [id], onDelete: Cascade)
  user         User            @relation(fields: [user_id], references: [id])
  exercise     ExerciseCatalog @relation(fields: [exercise_id], references: [id])
  pose_session PoseSession?

  // Partial unique via raw migration:
  // CREATE UNIQUE INDEX exercise_log_set_unique
  //   ON exercise_logs(session_id, exercise_id, set_number);
  @@index([session_id])
  @@index([exercise_id, created_at(sort: Desc)])
  @@map("exercise_logs")
}

model PoseSession {
  id              String    @id @default(uuid()) @db.Uuid
  user_id         String    @db.Uuid
  exercise_log_id String?   @unique @db.Uuid
  exercise_hint   String?   @db.VarChar(255)
  rep_count_ai    Int       @default(0) @db.SmallInt
  confidence_avg  Decimal?  @db.Decimal(4,3)
  started_at      DateTime  @db.Timestamptz(6)
  ended_at        DateTime? @db.Timestamptz(6)  // set on WS disconnect
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @updatedAt @db.Timestamptz(6)

  user         User         @relation(fields: [user_id], references: [id])
  exercise_log ExerciseLog? @relation(fields: [exercise_log_id], references: [id])

  @@index([user_id])
  @@map("pose_sessions")
}
```

## DTOs

```typescript
class CreateExerciseDTO {
  name: string                   // @IsString() @IsNotEmpty() @MaxLength(255)
  muscle_group: string           // @IsString() @IsNotEmpty() @MaxLength(100)
  category: ExerciseCategory     // @IsEnum(ExerciseCategory)
  description?: string
  instructions?: string
  video_url?: string             // @IsOptional() @IsUrl()
  image_url?: string             // @IsOptional() @IsUrl()
}

class UpdateExerciseDTO {
  name?: string
  muscle_group?: string
  category?: ExerciseCategory
  description?: string
  instructions?: string
  video_url?: string
  image_url?: string
  is_active?: boolean
}

class ExerciseFilterDTO extends PaginationDTO {
  muscle_group?: string          // @IsOptional()
  category?: ExerciseCategory    // @IsOptional()
  search?: string                // @IsOptional()
}

class CreateTrainingPlanDTO {
  title: string                  // @IsString() @IsNotEmpty() @MaxLength(255)
  goal: FitnessGoal              // @IsEnum(FitnessGoal)
  duration_weeks: number         // @IsInt() @Min(1) @Max(52)
  days_per_week: number          // @IsInt() @Min(1) @Max(7)
  schedule: Array<{
    week_number: number          // @IsInt() @Min(1)
    day_of_week: number          // @IsInt() @Min(0) @Max(6)
    focus_label?: string
    exercises: Array<{
      exercise_id: string        // @IsUUID()
      sets: number               // @IsInt() @Min(1)
      reps?: number
      duration_seconds?: number
      rest_seconds?: number
      weight_kg_target?: number
      order_index?: number
    }>
  }>
}

class GeneratePlanDTO {
  duration_weeks: number         // @IsInt() @Min(1) @Max(52)
  days_per_week: number          // @IsInt() @Min(1) @Max(7)
  preferences?: string           // @IsOptional() @MaxLength(500)
}

class StartSessionDTO {
  plan_id?: string               // @IsOptional() @IsUUID()
  schedule_day_id?: string       // @IsOptional() @IsUUID()
}

class LogExerciseSetDTO {
  exercise_id: string            // @IsUUID()
  set_number: number             // @IsInt() @Min(1)
  reps_completed?: number        // @IsOptional() @IsInt() @Min(0)
  weight_kg?: number             // @IsOptional() @IsPositive()
  duration_seconds?: number      // @IsOptional() @IsInt() @Min(1)
  pose_session_id?: string       // @IsOptional() @IsUUID()
}

class MasteryFilterDTO {
  muscle_group?: string          // @IsOptional()
  rank?: MasteryRank             // @IsOptional()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/fitness/exercises | JWT | ExerciseFilterDTO | Browse exercise catalog |
| GET | /v1/fitness/exercises/:id | JWT | — | Single exercise |
| POST | /v1/fitness/exercises | Admin | CreateExerciseDTO | Add exercise |
| PATCH | /v1/fitness/exercises/:id | Admin | UpdateExerciseDTO | Update or deactivate |
| GET | /v1/fitness/plans | JWT | PaginationDTO | Own training plans |
| GET | /v1/fitness/plans/:id | JWT | — | Full plan with schedule |
| POST | /v1/fitness/plans | JWT | CreateTrainingPlanDTO | Manual plan creation |
| DELETE | /v1/fitness/plans/:id | JWT | — | Delete own plan |
| POST | /v1/fitness/plans/:id/assign | Coach | — | Assign plan copy to member (?member_id=) |
| POST | /v1/ai/generate-plan | JWT | GeneratePlanDTO | AI-generated plan |
| POST | /v1/fitness/sessions/start | JWT | StartSessionDTO | Begin workout session |
| POST | /v1/fitness/sessions/:id/sets | JWT | LogExerciseSetDTO | Log one set |
| POST | /v1/fitness/sessions/:id/complete | JWT | — | Finish session |
| POST | /v1/fitness/sessions/:id/cancel | JWT | — | Abandon session |
| GET | /v1/fitness/sessions | JWT | DateRangeDTO | Session history |
| GET | /v1/fitness/sessions/:id | JWT | — | Session with all logs |
| GET | /v1/fitness/mastery | JWT | MasteryFilterDTO | Own muscle mastery progress |
| GET | /v1/fitness/leaderboard | JWT | PaginationDTO | Gym-wide XP leaderboard |

## Process Flows

### Flow 7A — AI Training Plan Generation

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | POST /v1/ai/generate-plan (GeneratePlanDTO) | |
| 2 | FitnessService | Load user_profiles: weight_kg, height_cm, activity_level, fitness_goal, date_of_birth | Throw 422 if weight_kg or gender null |
| 3 | FitnessService | SELECT exercise_catalog WHERE is_active=true | Builds allowed_exercises[] for AI constraint |
| 4 | FitnessService | GET /health on Python AI | Throw 503 if unhealthy |
| 5 | FitnessService | POST /generate-plan { user_context, plan_input, allowed_exercises[] } | |
| 6 | Python AI | LLaMA generates plan; Pydantic validates; exercise names must match catalog exactly; retry 2x on bad JSON | |
| 7 | FitnessService | INSERT ai_interaction_logs (latency_ms, token_count, payloads) | |
| 8 | FitnessService | Resolve exercise names → exercise_catalog IDs | Throw 422 if any not found |
| 9 | FitnessService | BEGIN TRANSACTION: INSERT training_plans (source=ai_generated); INSERT schedule_days + plan_exercises; UPDATE old active plan is_active=false; UPDATE new plan is_active=true; COMMIT | |
| 10 | EventEmitter2 | Emit TrainingPlanCreatedEvent | |

### Flow 7B — Workout Session Logging

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | POST /v1/fitness/sessions/start | |
| 2 | FitnessService | INSERT workout_sessions (status=in_progress, started_at=now, last_activity_at=now) | Return { session_id } |
| 3 | User | POST .../sets (LogExerciseSetDTO) — repeated per set | |
| 4 | FitnessService | Verify session.user_id=requester AND status=in_progress | Throw 403/404/422 |
| 5 | FitnessService | Check (session_id, exercise_id, set_number) uniqueness | Throw 409 CONFLICT |
| 6 | FitnessService | INSERT exercise_logs; UPDATE workout_sessions.last_activity_at=now | |
| 7 | FitnessService | If pose_session_id: UPDATE pose_sessions SET exercise_log_id=X | One-way link |
| 8 | User | POST .../complete | |
| 9 | FitnessService | duration_seconds = now - started_at; total_volume_kg = SUM(COALESCE(reps,0) × COALESCE(weight,0)) | |
| 10 | FitnessService | UPDATE workout_sessions: status=completed, completed_at, duration_seconds, total_volume_kg | Emit WorkoutSessionCompletedEvent |

### Flow 7C — Pose Detection (WebSocket)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | Connect WS /pose?exercise_hint=X (JWT validated) | |
| 2 | PoseGateway | INSERT pose_sessions (user_id, exercise_hint, started_at=now) | Return { pose_session_id } to client |
| 3 | User | Stream base64 camera frames | |
| 4 | PoseGateway | Per frame: POST /pose/analyze { frame_b64, exercise_hint } | Non-blocking per frame |
| 5 | Python AI | MediaPipe inference → { rep_event, confidence, exercise_class } | |
| 6 | PoseGateway | If rep_event: increment rep_count_ai; emit { rep_count_ai } to client | Real-time feedback |
| 7 | PoseGateway | On disconnect: UPDATE pose_sessions SET ended_at=now, rep_count_ai, confidence_avg | |

### BullMQ Jobs

| Queue | Job | Schedule | Logic |
|-------|-----|----------|-------|
| session-cleanup | mark-abandoned | CRON Hourly | `UPDATE workout_sessions SET status='cancelled' WHERE status='in_progress' AND last_activity_at < now() - interval '2 hours'` |

## Service Functions

```typescript
// FitnessService
listExercises(dto: ExerciseFilterDTO): Promise<PaginatedResult<ExerciseCatalog>>
getExerciseById(id: string): Promise<ExerciseCatalog>
createExercise(dto: CreateExerciseDTO): Promise<ExerciseCatalog>
updateExercise(id: string, dto: UpdateExerciseDTO): Promise<ExerciseCatalog>
getMyPlans(userId: string, dto: PaginationDTO): Promise<PaginatedResult<TrainingPlan>>
getPlanById(userId: string, planId: string): Promise<TrainingPlan>
createPlan(userId: string, dto: CreateTrainingPlanDTO): Promise<TrainingPlan>
deletePlan(userId: string, planId: string): Promise<void>
assignPlan(coachId: string, planId: string, memberId: string): Promise<TrainingPlan>
generateAiPlan(userId: string, dto: GeneratePlanDTO): Promise<TrainingPlan>
startSession(userId: string, dto: StartSessionDTO): Promise<WorkoutSession>
logSet(userId: string, sessionId: string, dto: LogExerciseSetDTO): Promise<ExerciseLog>
completeSession(userId: string, sessionId: string): Promise<WorkoutSession>
cancelSession(userId: string, sessionId: string): Promise<void>
getMySessions(userId: string, dto: DateRangeDTO): Promise<PaginatedResult<WorkoutSession>>
getSessionById(userId: string, sessionId: string): Promise<WorkoutSession>
getMuscleMastery(userId: string, dto: MasteryFilterDTO): Promise<MuscleMasteryProgress[]>
getLeaderboard(dto: PaginationDTO): Promise<PaginatedResult<LeaderboardEntry>>
runSessionCleanupCron(): Promise<void>

// PoseGateway (WebSocket)
handleConnection(client: Socket): Promise<void>
handleFrame(client: Socket, payload: { frame_b64: string }): Promise<void>
handleDisconnect(client: Socket): Promise<void>
```

---