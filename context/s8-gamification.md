# FitTrack — S8 — Gamification
_Always include `00-global-contracts.md` alongside this file._

---

# S8 — Gamification

## Overview
XP-based rank progression per muscle group. All registered users participate including walk-ins. Leaderboard is gym-wide. Adamantite is the max rank; XP continues accumulating past 10,000 and is displayed as "Adamantite+ (N EXP)".

## Prisma Schema

```prisma
model MuscleMasteryProgress {
  id              String      @id @default(uuid()) @db.Uuid
  user_id         String      @db.Uuid
  muscle_group    String      @db.VarChar(100)
  total_volume_kg Decimal     @default(0) @db.Decimal(12,2)
  xp_points       Int         @default(0)  // grows indefinitely past Adamantite threshold
  rank            MasteryRank @default(bronze)
  last_ranked_at  DateTime?   @db.Timestamptz(6)
  created_at      DateTime    @default(now()) @db.Timestamptz(6)
  updated_at      DateTime    @updatedAt @db.Timestamptz(6)

  user            User        @relation(fields: [user_id], references: [id])

  @@unique([user_id, muscle_group])
  @@index([user_id])
  @@map("muscle_mastery_progress")
}

enum MasteryRank { bronze silver gold platinum adamantite }
// Display logic: if rank=adamantite AND xp_points > 10000:
//   show "Adamantite+ ({xp_points - 10000} EXP)"
// xp_points always continues incrementing — never capped
```

## XP Constants

```typescript
// common/constants/xp-thresholds.ts — compile-time, NOT stored in DB
export const XP_THRESHOLDS: Record<MasteryRank, { xp: number; volume_kg: number }> = {
  bronze:     { xp: 0,      volume_kg: 0 },
  silver:     { xp: 500,    volume_kg: 5_000 },
  gold:       { xp: 2_000,  volume_kg: 20_000 },
  platinum:   { xp: 5_000,  volume_kg: 50_000 },
  adamantite: { xp: 10_000, volume_kg: 100_000 },
}
// Rank up when EITHER xp_points OR total_volume_kg threshold is crossed
// XP formula:     floor(sets × reps_completed × COALESCE(weight_kg, 1) / 10)
// Volume formula: SUM(reps_completed × COALESCE(weight_kg, 0))
// Rank stays at adamantite after 10k — xp_points just keeps growing
// Frontend reads: if rank=adamantite && xp > 10000 → display "Adamantite+ ({xp-10000} EXP)"
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/fitness/mastery | JWT | MasteryFilterDTO | Own mastery per muscle group |
| GET | /v1/fitness/leaderboard | JWT | PaginationDTO | All users ranked by total XP |

## Process Flows

### Flow 8A — XP Accrual + Rank Check

**Triggered by WorkoutSessionCompletedEvent. @OnEvent() handler — never throws; errors logged silently so session completion is never blocked.**

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | GamificationService | Receive WorkoutSessionCompletedEvent { sessionId, userId } | @OnEvent() |
| 2 | GamificationService | SELECT exercise_logs WHERE session_id=X AND reps_completed IS NOT NULL | |
| 3 | GamificationService | JOIN exercise_catalog per log → get muscle_group; GROUP by muscle_group | |
| 4 | GamificationService | Per group: xp_delta = SUM(floor(sets × reps_completed × COALESCE(weight_kg,1) / 10)); volume_delta = SUM(reps_completed × COALESCE(weight_kg,0)) | XP: COALESCE(1) so bodyweight earns; Volume: COALESCE(0) so bodyweight adds nothing |
| 5 | GamificationService | UPSERT muscle_mastery_progress ON CONFLICT (user_id, muscle_group) DO UPDATE xp_points += delta, total_volume_kg += delta | Creates row on first use |
| 6 | GamificationService | Evaluate rank: check new xp_points AND total_volume_kg against XP_THRESHOLDS; assign highest tier crossed | Rank stays at adamantite after threshold — xp_points continues growing |
| 7 | GamificationService | If new_rank > current_rank: UPDATE rank=new_rank, last_ranked_at=now | |
| 8 | GamificationService | Emit RankUpEvent { userId, muscle_group, old_rank, new_rank } | |
| 9 | NotificationService | Send rank-up email per user preference | |

## Service Functions

```typescript
// GamificationService
handleWorkoutCompleted(event: WorkoutSessionCompletedEvent): Promise<void>  // @OnEvent()
computeDeltas(logs: ExerciseLog[]): Map<string, { xp: number; volume: number }>
upsertMastery(userId: string, muscleGroup: string, delta: { xp: number; volume: number }): Promise<MuscleMasteryProgress>
evaluateRank(xp: number, volume: number): MasteryRank
getMuscleMastery(userId: string, dto: MasteryFilterDTO): Promise<MuscleMasteryProgress[]>
getLeaderboard(dto: PaginationDTO): Promise<PaginatedResult<LeaderboardEntry>>
```

---