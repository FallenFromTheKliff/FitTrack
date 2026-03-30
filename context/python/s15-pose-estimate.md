# FitTrack - S15 - Pose Estimate
_Always include `../00-global-contracts.md` and `00-python-microservice-contracts.md` alongside this file._

---

# S15 - Pose Estimate

## Overview
Python-backed pose estimation and exercise intelligence for gym workout tracking. Flow is: client camera -> Nest WebSocket `/pose` -> Python microservice -> YOLO subject lock -> MediaPipe landmarks and joint angles -> profile and template match -> session finalization -> Nest persists learned profile metadata in PostgreSQL via Prisma.

This domain extends workout tracking from `S7` without modifying legacy `S11` or `S13`. Nest owns session creation, authentication, WebSocket lifecycle, and persistence. Python owns inference only. OpenRouter is not part of real-time pose inference and may only be used as a finalize-time fallback for unknown exercise classification.

### Starter Exercise Catalog

| Canonical Exercise | Notes |
|--------------------|-------|
| `push_up` | Horizontal press pattern |
| `squat` | Knee and hip flexion pattern |
| `bicep_curl` | Elbow flexion pattern |
| `shoulder_press` | Vertical press pattern |
| `plank` | Static hold posture |

## Backend Persistence Schema

```prisma
model PoseExerciseProfile {
  id                   String          @id @default(uuid()) @db.Uuid
  exercise_id          String?         @db.Uuid
  canonical_name       String          @db.VarChar(100)
  profile_kind         PoseProfileKind @default(seed)
  landmark_signature   Json
  angle_signature      Json
  rep_rules            Json?
  sample_count         Int             @default(1)
  confidence_threshold Decimal?        @db.Decimal(4, 3)
  is_active            Boolean         @default(true)
  created_at           DateTime        @default(now()) @db.Timestamptz(6)
  updated_at           DateTime        @updatedAt @db.Timestamptz(6)

  exercise ExerciseCatalog? @relation(fields: [exercise_id], references: [id])
  sessions PoseSession[]

  @@index([canonical_name, is_active])
  @@index([exercise_id, is_active])
  @@map("pose_exercise_profiles")
}

enum PoseProfileKind {
  seed
  learned
}

model PoseSession {
  // Existing S7 fields remain unchanged.
  detected_exercise_name    String?  @db.VarChar(100)
  detected_profile_id       String?  @db.Uuid
  classification_confidence Decimal? @db.Decimal(4, 3)
  subject_lock_confidence   Decimal? @db.Decimal(4, 3)
  analysis_summary          Json?

  pose_profile PoseExerciseProfile? @relation(fields: [detected_profile_id], references: [id])

  @@index([detected_exercise_name])
  @@index([detected_profile_id])
}
```

## DTOs

```typescript
class StartPoseSessionDTO {
  exercise_hint?: string   // @IsOptional() @IsString() @MaxLength(100)
}

class PoseFrameDTO {
  frame_b64: string        // @IsString() @IsNotEmpty()
}

class FinalizePoseSessionDTO {
  ended_reason?: 'client_disconnect' | 'manual_stop' | 'session_completed'
}

class PoseProfileFilterDTO extends PaginationDTO {
  canonical_name?: string  // @IsOptional() @IsString()
  profile_kind?: PoseProfileKind // @IsOptional() @IsEnum(PoseProfileKind)
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| WS | /pose | JWT | StartPoseSessionDTO + PoseFrameDTO events | Live pose session |
| POST | /v1/pose/sessions/:id/finalize | JWT | FinalizePoseSessionDTO | Manual finalize fallback |
| GET | /v1/pose/sessions/:id | JWT | - | Pose session summary |
| GET | /v1/pose/profiles | Admin | PoseProfileFilterDTO | Seed and learned exercise profiles |

## WS Event Payloads

```typescript
// Server -> Client
interface PoseSessionStartedEvent {
  pose_session_id: string
  accepted_fps: number
}

interface PoseRepCountEvent {
  pose_session_id: string
  rep_count_ai: number
  confidence: number
  exercise_class: string
  phase?: string
}

interface PoseFeedbackEvent {
  pose_session_id: string
  subject_locked: boolean
  form_feedback: string[]
}

interface PoseSessionFinalizedEvent {
  pose_session_id: string
  detected_exercise_name: string | null
  classification_confidence: number | null
  summary: Record<string, unknown>
}

interface PoseErrorEvent {
  detail: string
}

// Client -> Server
interface PoseFrameEvent {
  frame_b64: string
}

interface PoseStopEvent {
  ended_reason?: 'manual_stop' | 'session_completed'
}
```

## Python Service Contracts

```text
GET /health
  Output: 200 { status: "ok" }

POST /pose/session/bootstrap
  Input:  {
            pose_session_id: string,
            exercise_hint: string | null,
            starter_catalog: string[],
            candidate_profiles: Array<{
              id: string,
              canonical_name: string,
              profile_kind: "seed" | "learned",
              landmark_signature: Record<string, unknown>,
              angle_signature: Record<string, unknown>,
              rep_rules?: Record<string, unknown>
            }>
          }
  Output: {
            status: "ready",
            accepted_fps: number,
            subject_lock_mode: "single_subject"
          }

POST /pose/analyze
  Input:  {
            pose_session_id: string,
            frame_b64: string
          }
  Output: {
            rep_event: boolean,
            rep_count_delta: number,
            confidence: number,
            exercise_class: string,
            matched_profile_id: string | null,
            subject_locked: boolean,
            subject_lock_confidence: number,
            phase?: string,
            form_feedback: string[]
          }

POST /pose/session/finalize
  Input:  {
            pose_session_id: string
          }
  Output: {
            detected_exercise_name: string | null,
            matched_profile_id: string | null,
            classification_confidence: number | null,
            subject_lock_confidence: number | null,
            analysis_summary: {
              reps_detected: number,
              form_feedback: string[],
              average_confidence: number | null,
              dominant_joint_angles: Record<string, number>
            },
            learned_profile?: {
              canonical_name: string,
              landmark_signature: Record<string, unknown>,
              angle_signature: Record<string, unknown>,
              rep_rules?: Record<string, unknown>
            }
          }
```

## Process Flow

### Flow 15A - Session Bootstrap

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | Connect WS `/pose?exercise_hint=X` | JWT socket auth handled by Nest |
| 2 | PoseService | INSERT `pose_sessions` | Creates backend-owned pose session |
| 3 | PoseService | SELECT candidate `pose_exercise_profiles` | Load seed and learned profiles relevant to the hint |
| 4 | PoseService | POST `/pose/session/bootstrap` | Sends session ID, hint, starter catalog, and profile candidates |
| 5 | Python | Initializes in-memory session state | Returns accepted FPS and lock mode |
| 6 | PoseGateway | Emit `pose.session.started` | Client begins streaming frames |

### Flow 15B - Frame Analysis

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | Emit `frame` with `frame_b64` | Camera frame sampled by client |
| 2 | PoseGateway | Accept latest frame only | No queue buildup; stale frames dropped |
| 3 | Python | YOLO locks a single subject | Highest-confidence valid subject only |
| 4 | Python | MediaPipe extracts landmarks | Compute normalized joint angles |
| 5 | Python | Match starter templates and learned profiles | Infer class, rep transition, and form notes |
| 6 | PoseGateway | Emit `pose.rep-count` and `pose.feedback` | Real-time feedback to client |
| 7 | Python | Never call OpenRouter in this loop | Real-time pose path stays vision-only |

### Flow 15C - Finalize And Learn

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | Disconnect or emit `stop` | Ends pose session |
| 2 | PoseService | POST `/pose/session/finalize` | Python returns final classification and summary |
| 3 | PoseService | UPDATE `pose_sessions` | Save detected exercise and summary fields |
| 4 | Python | If still unknown: optional OpenRouter reasoning fallback | Finalize-time only; strict JSON output |
| 5 | PoseService | If `learned_profile` present: INSERT `pose_exercise_profiles` | Only after Nest validation |
| 6 | PoseService | Emit `pose.session.finalized` | Final summary returned to client or caller |

## Service Functions

```typescript
// Nest PoseService
startPoseSession(userId: string, exerciseHint: string | null): Promise<PoseSession>
bootstrapPoseSession(sessionId: string): Promise<{ accepted_fps: number }>
analyzeFrame(sessionId: string, frameB64: string): Promise<PoseFrameProcessingResult>
finalizePoseSession(sessionId: string, endedReason?: string): Promise<PoseSession>
getPoseSessionById(userId: string, sessionId: string): Promise<PoseSession>
listPoseProfiles(dto: PoseProfileFilterDTO): Promise<PaginatedResult<PoseExerciseProfile>>

// Python PoseSessionService
bootstrap_session(input: BootstrapPoseSessionInput) -> BootstrapPoseSessionOutput
analyze_frame(input: AnalyzePoseFrameInput) -> AnalyzePoseFrameOutput
finalize_session(input: FinalizePoseSessionInput) -> FinalizePoseSessionOutput
classify_unknown_exercise(input: FinalizePoseSessionInput) -> UnknownExerciseClassificationOutput
```
