# FitTrack — S11 — AI & Chatbot
_Always include `00-global-contracts.md` alongside this file._

---

# S11 — AI & Chatbot

## Overview
LLaMA-powered conversational assistant. One active session per context type per user. Sessions lazily archived after 14 days of inactivity (checked on session load, not via CRON). All AI-triggered actions pass through a validation layer before execution.

## Prisma Schema

```prisma
model AiChatSession {
  id               String      @id @default(uuid()) @db.Uuid
  user_id          String      @db.Uuid
  context_type     ChatContext
  title            String?     @db.VarChar(255)
  is_active        Boolean     @default(true)
  last_activity_at DateTime    @db.Timestamptz(6)  // updated on each message
  created_at       DateTime    @default(now()) @db.Timestamptz(6)
  updated_at       DateTime    @updatedAt @db.Timestamptz(6)

  user         User             @relation(fields: [user_id], references: [id])
  messages     AiChatMessage[]
  interactions AiInteractionLog[]

  @@unique([user_id, context_type], where: { is_active: true })  // one active per context — NOTE: Prisma does not support `where` on @@unique; enforce via raw migration:
  // CREATE UNIQUE INDEX one_active_ai_session_per_context
  //   ON ai_chat_sessions(user_id, context_type) WHERE is_active = true;
  @@index([user_id, is_active])
  @@map("ai_chat_sessions")
}

enum ChatContext { general tdee_adjustment training_plan nutrition }

model AiChatMessage {
  id               String    @id @default(uuid()) @db.Uuid
  session_id       String    @db.Uuid
  role             ChatRole
  content          String
  action_triggered String?   @db.VarChar(100)
  created_at       DateTime  @default(now()) @db.Timestamptz(6)
  updated_at       DateTime  @updatedAt @db.Timestamptz(6)

  session          AiChatSession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  @@index([session_id, created_at(sort: Desc)])
  @@map("ai_chat_messages")
}

enum ChatRole { user assistant }

model AiInteractionLog {
  id               String          @id @default(uuid()) @db.Uuid
  user_id          String          @db.Uuid
  session_id       String?         @db.Uuid
  interaction_type InteractionType
  request_payload  Json
  response_payload Json?
  action_triggered String?         @db.VarChar(100)
  action_result    Json?
  latency_ms       Int?
  model_used       String?         @db.VarChar(100)
  token_count      Int?
  error            String?
  created_at       DateTime        @default(now()) @db.Timestamptz(6)
  updated_at       DateTime        @updatedAt @db.Timestamptz(6)

  user    User           @relation(fields: [user_id], references: [id])
  session AiChatSession? @relation(fields: [session_id], references: [id])

  @@index([user_id, interaction_type])
  @@index([created_at(sort: Desc)])
  @@map("ai_interaction_logs")
}

enum InteractionType { chat plan_generation tdee_adjustment pose_analysis }
```

## DTOs

```typescript
class AIChatDTO {
  session_id?: string         // @IsOptional() @IsUUID()
  message: string             // @IsString() @IsNotEmpty() @MaxLength(2000)
  context_type?: ChatContext  // @IsOptional() — used only when creating a new session
}

// Structured params per AI action type
interface AiActionParams {
  ADJUST_TDEE: {
    activity_level?: ActivityLevel
    fitness_goal?: FitnessGoal
    weight_kg?: number
    gender?: Gender
  }
  GENERATE_PLAN: {
    duration_weeks?: number
    days_per_week?: number
    preferences?: string
  }
  LOG_NUTRITION: {
    food_item: string
    calories: number
    protein_g?: number     // defaults to 0
    carbs_g?: number       // defaults to 0
    fat_g?: number         // defaults to 0
    quantity?: number      // defaults to 1
    unit?: NutritionUnit   // defaults to serving
    meal_name?: string     // defaults to "General"
    log_date?: string      // defaults to today
  }
  NONE: null
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| POST | /v1/ai/chat | JWT | AIChatDTO | Send message; returns reply + optional action result |
| GET | /v1/ai/chat/sessions | JWT | PaginationDTO | Own chat sessions |
| GET | /v1/ai/chat/sessions/:id | JWT | — | Single session metadata |
| GET | /v1/ai/chat/sessions/:id/messages | JWT | PaginationDTO | Session message history |
| DELETE | /v1/ai/chat/sessions/:id | JWT | — | Archive session manually |
| POST | /v1/ai/generate-plan | JWT | GeneratePlanDTO | Direct plan generation |

**Rate Limiting:** `POST /v1/ai/chat` and `POST /v1/ai/generate-plan` throttled to **10 requests/min per user** via @nestjs/throttler.

## Python AI Service Contracts

```
POST /generate-plan
  Input:  { user_context, plan_input, allowed_exercises[] }
  Output: { weeks: [{ week_number, days: [{ day_of_week, exercises: [...] }] }] }

POST /calculate-tdee
  Input:  { weight_kg, height_cm, age, gender (required), activity_level, fitness_goal }
  Output: { bmr, tdee, target_calories, protein_g, carbs_g, fat_g }

POST /chat
  Input:  { messages: [{ role, content }], user_context, session_context }
  Output: { content: string, action: "ADJUST_TDEE|GENERATE_PLAN|LOG_NUTRITION|NONE", params: {} }

POST /pose/analyze
  Input:  { frame_b64: string, exercise_hint: string }
  Output: { rep_event: boolean, confidence: number, exercise_class: string }

GET /health
  Output: 200 { status: "ok" }
```

## Process Flows

### Flow 11A — AI Chat

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | POST /v1/ai/chat { session_id?, message, context_type? } | |
| 2 | AiService | If session_id provided: SELECT ai_chat_sessions WHERE id=X AND user_id=X | Throw 404 if not found |
| 3 | AiService | Check last_activity_at; if > 14 days: UPDATE is_active=false; emit AiSessionArchivedEvent; throw 410 SESSION_ARCHIVED | Lazy archiving — no CRON needed |
| 4 | AiService | If no session_id: check for existing active session WHERE user_id AND context_type | If exists: use it. If not: INSERT new session |
| 5 | AiService | SELECT last 20 ai_chat_messages WHERE session_id ORDER BY created_at DESC | Load directly from DB — no Redis cache |
| 6 | AiService | Build prompt: system persona + user profile snapshot + last 20 messages + new message | |
| 7 | AiService | POST /chat to Python AI | |
| 8 | Python AI | LLaMA returns { content, action, params } | |
| 9 | AiService | [Action Validation Layer] Verify action is valid enum; verify params schema matches action type; verify user has permission to trigger that action | If invalid: ignore action, return content only |
| 10 | AiService | INSERT ai_chat_messages: role=user + role=assistant (batch) | |
| 11 | AiService | INSERT ai_interaction_logs (latency_ms, token_count, model_used, payloads) | |
| 12 | AiService | UPDATE ai_chat_sessions.last_activity_at=now | |
| 13 | AiService | If no title yet: title = message[:80]; UPDATE session.title | |
| 14 | AiService | If action=ADJUST_TDEE (validated): NutritionService.recalculateTdee(userId, params) | action_result = new TDEE |
| 15 | AiService | If action=GENERATE_PLAN (validated): FitnessService.generateAiPlan(userId, params) | action_result = plan summary |
| 16 | AiService | If action=LOG_NUTRITION (validated): NutritionService.logNutrition(userId, merged params with defaults) | action_result = log entry |
| 17 | AiService | Return { reply, action_triggered, action_result? } | |

## Service Functions

```typescript
// AiService
chat(userId: string, dto: AIChatDTO): Promise<ChatResponse>
getMyChatSessions(userId: string, dto: PaginationDTO): Promise<PaginatedResult<AiChatSession>>
getChatSessionById(userId: string, sessionId: string): Promise<AiChatSession>
getChatMessages(userId: string, sessionId: string, dto: PaginationDTO): Promise<PaginatedResult<AiChatMessage>>
archiveSession(userId: string, sessionId: string): Promise<void>
buildMessageHistory(sessionId: string): Promise<AiChatMessage[]>
validateAndExecuteAction(userId: string, action: string, params: unknown): Promise<unknown>
logInteraction(data: Partial<AiInteractionLog>): Promise<void>
```

---