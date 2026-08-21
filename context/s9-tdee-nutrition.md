# FitTrack — S9 — TDEE & Nutrition
_Always include `00-global-contracts.md` alongside this file._

---

# S9 — TDEE & Nutrition

## Overview
TDEE calculation via Python AI (Mifflin-St Jeor), versioned macro snapshots, and daily food logging. No cross-reference to inventory products — kept separate for simplicity.

## Prisma Schema

```prisma
model TdeeProfile {
  id             String        @id @default(uuid()) @db.Uuid
  user_id        String        @db.Uuid
  weight_kg      Decimal       @db.Decimal(5,2)
  height_cm      Decimal       @db.Decimal(5,2)
  age            Int           @db.SmallInt  // computed from DOB at calc time; stored as snapshot
  gender         Gender
  activity_level ActivityLevel
  fitness_goal   FitnessGoal
  bmr_calories   Decimal       @db.Decimal(8,2)
  tdee_calories  Decimal       @db.Decimal(8,2)
  is_active      Boolean       @default(true)
  calculated_at  DateTime      @db.Timestamptz(6)
  created_at     DateTime      @default(now()) @db.Timestamptz(6)
  updated_at     DateTime      @updatedAt @db.Timestamptz(6)

  user           User          @relation(fields: [user_id], references: [id])
  macro_targets  MacroTarget[]

  @@index([user_id, is_active])
  // Partial unique via raw migration:
  // CREATE UNIQUE INDEX one_active_tdee ON tdee_profiles(user_id) WHERE is_active=true;
  @@map("tdee_profiles")
}

model MacroTarget {
  id              String      @id @default(uuid()) @db.Uuid
  user_id         String      @db.Uuid
  tdee_profile_id String      @db.Uuid
  target_calories Decimal     @db.Decimal(8,2)
  protein_g       Decimal     @db.Decimal(6,2)
  carbs_g         Decimal     @db.Decimal(6,2)
  fat_g           Decimal     @db.Decimal(6,2)
  is_active       Boolean     @default(true)
  created_at      DateTime    @default(now()) @db.Timestamptz(6)
  updated_at      DateTime    @updatedAt @db.Timestamptz(6)

  user         User        @relation(fields: [user_id], references: [id])
  tdee_profile TdeeProfile @relation(fields: [tdee_profile_id], references: [id])
  logs         NutritionLog[]

  @@index([user_id, is_active])
  // Partial unique via raw migration:
  // CREATE UNIQUE INDEX one_active_macro ON macro_targets(user_id) WHERE is_active=true;
  @@map("macro_targets")
}

model NutritionLog {
  id              String      @id @default(uuid()) @db.Uuid
  user_id         String      @db.Uuid
  macro_target_id String?     @db.Uuid
  log_date        DateTime    @db.Date
  meal_name       String      @db.VarChar(100)
  food_item       String      @db.VarChar(255)
  calories        Decimal     @db.Decimal(8,2)
  protein_g       Decimal     @default(0) @db.Decimal(6,2)
  carbs_g         Decimal     @default(0) @db.Decimal(6,2)
  fat_g           Decimal     @default(0) @db.Decimal(6,2)
  quantity        Decimal     @default(1) @db.Decimal(6,2)
  unit            NutritionUnit @default(serving)
  created_at      DateTime    @default(now()) @db.Timestamptz(6)
  updated_at      DateTime    @updatedAt @db.Timestamptz(6)

  user         User         @relation(fields: [user_id], references: [id])
  macro_target MacroTarget? @relation(fields: [macro_target_id], references: [id])

  @@index([user_id, log_date(sort: Desc)])
  @@map("nutrition_logs")
}

enum NutritionUnit { g kg ml L oz lb cup tbsp tsp serving piece }
```

## DTOs

```typescript
class RecalcTDEEDTO {
  // All optional — merged over user_profiles; throws 422 if final gender or weight_kg is null
  activity_level?: ActivityLevel // @IsOptional() @IsEnum(ActivityLevel)
  fitness_goal?: FitnessGoal     // @IsOptional() @IsEnum(FitnessGoal)
  weight_kg?: number             // @IsOptional() @IsPositive()
  height_cm?: number             // @IsOptional() @IsPositive()
  gender?: Gender                // @IsOptional() @IsEnum(Gender)
}

class LogNutritionDTO {
  log_date: string               // @IsISO8601() YYYY-MM-DD
  meal_name: string              // @IsString() @MaxLength(100)
  food_item: string              // @IsString() @MaxLength(255)
  calories: number               // @IsPositive()
  protein_g: number              // @Min(0)
  carbs_g: number                // @Min(0)
  fat_g: number                  // @Min(0)
  quantity: number               // @IsPositive()
  unit: NutritionUnit            // @IsEnum(NutritionUnit)
}

class UpdateNutritionLogDTO {
  meal_name?: string
  food_item?: string
  calories?: number              // @IsOptional() @IsPositive()
  protein_g?: number             // @IsOptional() @Min(0)
  carbs_g?: number               // @IsOptional() @Min(0)
  fat_g?: number                 // @IsOptional() @Min(0)
  quantity?: number              // @IsOptional() @IsPositive()
  unit?: NutritionUnit
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/nutrition/tdee | JWT | — | Active TDEE + macro targets |
| GET | /v1/nutrition/tdee/history | JWT | PaginationDTO | All past TDEE snapshots |
| POST | /v1/nutrition/tdee/recalculate | JWT | RecalcTDEEDTO | Trigger TDEE recalculation |
| POST | /v1/nutrition/logs | JWT | LogNutritionDTO | Log food entry |
| GET | /v1/nutrition/logs | JWT | DateRangeDTO | Food log history |
| PATCH | /v1/nutrition/logs/:id | JWT | UpdateNutritionLogDTO | Edit log entry |
| DELETE | /v1/nutrition/logs/:id | JWT | — | Delete log entry |
| GET | /v1/nutrition/daily-summary | JWT | DateQueryDTO | Logged macros vs targets |

## Process Flows

### Flow 9A — TDEE Recalculation

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Trigger | POST /v1/nutrition/tdee/recalculate OR AI action=ADJUST_TDEE | |
| 2 | NutritionService | Load user_profiles: DOB, gender, weight_kg, height_cm, activity_level, fitness_goal | |
| 3 | NutritionService | Merge RecalcTDEEDTO over profile values | Throw 422 if final gender=null OR weight_kg=null |
| 4 | NutritionService | POST /calculate-tdee to Python AI | |
| 5 | Python AI | Mifflin-St Jeor → activity multiplier → goal surplus/deficit | Return { bmr, tdee, target_calories, protein_g, carbs_g, fat_g } |
| 6 | NutritionService | BEGIN TRANSACTION | |
| 7 | NutritionService | UPDATE tdee_profiles SET is_active=false WHERE user_id=X AND is_active=true | Preserve history |
| 8 | NutritionService | INSERT new tdee_profiles (is_active=true, all input snapshots + AI results) | |
| 9 | NutritionService | UPDATE macro_targets SET is_active=false WHERE user_id=X | |
| 10 | NutritionService | INSERT new macro_targets (is_active=true, tdee_profile_id=new.id) | |
| 11 | NutritionService | COMMIT | |
| 12 | EventEmitter2 | Emit TDEERecalculatedEvent | In-app notification "Macro targets updated" |

## Service Functions

```typescript
// NutritionService
getActiveTdee(userId: string): Promise<{ tdee: TdeeProfile; macros: MacroTarget }>
getTdeeHistory(userId: string, dto: PaginationDTO): Promise<PaginatedResult<TdeeProfile>>
recalculateTdee(userId: string, dto: RecalcTDEEDTO): Promise<{ tdee: TdeeProfile; macros: MacroTarget }>
logNutrition(userId: string, dto: LogNutritionDTO): Promise<NutritionLog>
getNutritionLogs(userId: string, dto: DateRangeDTO): Promise<PaginatedResult<NutritionLog>>
updateNutritionLog(userId: string, logId: string, dto: UpdateNutritionLogDTO): Promise<NutritionLog>
deleteNutritionLog(userId: string, logId: string): Promise<void>
getDailySummary(userId: string, date: string): Promise<DailySummary>
```

---