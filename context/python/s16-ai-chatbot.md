# FitTrack - S16 - AI Chatbot
_Always include `../00-global-contracts.md` and `00-python-microservice-contracts.md` alongside this file._

---

# S16 - AI Chatbot

## Overview
Gym-only chatbot with grounded answers, chat history, and follow-ups. This domain is separate from legacy `S11` and handles only gym-relevant questions such as operating hours, holiday schedules, rates, membership plans, coaching, amenities, training basics, and nutrition basics.

Nest owns chat sessions, message history, FAQ and schedule data, and grounding assembly. Python receives grounded context and returns the assistant reply. Out-of-scope questions are refused explicitly. The Python chatbot uses OpenRouter as the default external model gateway through an OpenAI-compatible adapter.

## Backend Persistence Schema

```prisma
model GymChatSession {
  id               String   @id @default(uuid()) @db.Uuid
  user_id          String   @db.Uuid
  title            String?  @db.VarChar(255)
  is_active        Boolean  @default(true)
  last_activity_at DateTime @db.Timestamptz(6)
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @updatedAt @db.Timestamptz(6)

  user         User                     @relation(fields: [user_id], references: [id])
  messages     GymChatMessage[]
  interactions GymChatInteractionLog[]

  @@index([user_id, is_active])
  @@map("gym_chat_sessions")
}

model GymChatMessage {
  id               String      @id @default(uuid()) @db.Uuid
  session_id       String      @db.Uuid
  role             GymChatRole
  content          String
  grounded_sources Json?
  out_of_scope     Boolean     @default(false)
  created_at       DateTime    @default(now()) @db.Timestamptz(6)
  updated_at       DateTime    @updatedAt @db.Timestamptz(6)

  session GymChatSession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  @@index([session_id, created_at(sort: Desc)])
  @@map("gym_chat_messages")
}

enum GymChatRole {
  user
  assistant
  system
}

model GymChatInteractionLog {
  id                String    @id @default(uuid()) @db.Uuid
  user_id           String    @db.Uuid
  session_id        String?   @db.Uuid
  request_payload   Json
  grounding_payload Json?
  response_payload  Json?
  latency_ms        Int?
  model_used        String?   @db.VarChar(100)
  token_count       Int?
  out_of_scope      Boolean   @default(false)
  error             String?
  created_at        DateTime  @default(now()) @db.Timestamptz(6)
  updated_at        DateTime  @updatedAt @db.Timestamptz(6)

  user    User            @relation(fields: [user_id], references: [id])
  session GymChatSession? @relation(fields: [session_id], references: [id])

  @@index([user_id, created_at(sort: Desc)])
  @@map("gym_chat_interaction_logs")
}

model GymOperatingHour {
  id          String   @id @default(uuid()) @db.Uuid
  day_of_week Int      @db.SmallInt
  opens_at    DateTime @db.Time(0)
  closes_at   DateTime @db.Time(0)
  is_closed   Boolean  @default(false)
  label       String?  @db.VarChar(100)
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  @@unique([day_of_week])
  @@map("gym_operating_hours")
}

model GymSpecialSchedule {
  id           String    @id @default(uuid()) @db.Uuid
  starts_on    DateTime  @db.Date
  ends_on      DateTime  @db.Date
  opens_at     DateTime? @db.Time(0)
  closes_at    DateTime? @db.Time(0)
  is_closed    Boolean   @default(false)
  reason       String    @db.VarChar(255)
  pricing_note String?
  is_active    Boolean   @default(true)
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  updated_at   DateTime  @updatedAt @db.Timestamptz(6)

  @@index([starts_on, ends_on, is_active])
  @@map("gym_special_schedules")
}

model GymFaqEntry {
  id         String         @id @default(uuid()) @db.Uuid
  category   GymFaqCategory
  question   String         @db.VarChar(255)
  answer     String
  keywords   Json?
  sort_order Int            @default(0) @db.SmallInt
  is_active  Boolean        @default(true)
  created_at DateTime       @default(now()) @db.Timestamptz(6)
  updated_at DateTime       @updatedAt @db.Timestamptz(6)

  @@index([category, is_active, sort_order])
  @@map("gym_faq_entries")
}

enum GymFaqCategory {
  general
  hours
  rates
  membership
  amenities
  coaching
  training
  nutrition
  rules
}
```

## DTOs

```typescript
class SendGymChatMessageDTO {
  session_id?: string        // @IsOptional() @IsUUID()
  message: string            // @IsString() @IsNotEmpty() @MaxLength(2000)
}

class GymChatSessionFilterDTO extends PaginationDTO {
  is_active?: boolean        // @IsOptional() @IsBoolean()
}

class UpsertGymOperatingHoursDTO {
  day_of_week: number        // @IsInt() @Min(0) @Max(6)
  opens_at: string           // @IsMilitaryTime()
  closes_at: string          // @IsMilitaryTime()
  is_closed?: boolean        // @IsOptional() @IsBoolean()
  label?: string             // @IsOptional() @IsString()
}

class CreateGymSpecialScheduleDTO {
  starts_on: string          // @IsISO8601()
  ends_on: string            // @IsISO8601()
  opens_at?: string          // @IsOptional() @IsMilitaryTime()
  closes_at?: string         // @IsOptional() @IsMilitaryTime()
  is_closed?: boolean        // @IsOptional() @IsBoolean()
  reason: string             // @IsString() @IsNotEmpty()
  pricing_note?: string      // @IsOptional() @IsString()
}

class CreateGymFaqEntryDTO {
  category: GymFaqCategory   // @IsEnum(GymFaqCategory)
  question: string           // @IsString() @IsNotEmpty()
  answer: string             // @IsString() @IsNotEmpty()
  keywords?: string[]        // @IsOptional() @IsArray()
  sort_order?: number        // @IsOptional() @IsInt()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| POST | /v1/gym-chat/messages | JWT | SendGymChatMessageDTO | Send message and receive grounded reply |
| GET | /v1/gym-chat/sessions | JWT | GymChatSessionFilterDTO | Own chat sessions |
| GET | /v1/gym-chat/sessions/:id/messages | JWT | PaginationDTO | Session message history |
| DELETE | /v1/gym-chat/sessions/:id | JWT | - | Archive chat session |
| GET | /v1/gym-chat/knowledge/hours | Admin | - | Gym operating hours |
| PUT | /v1/gym-chat/knowledge/hours | Admin | UpsertGymOperatingHoursDTO[] | Replace weekly operating hours |
| GET | /v1/gym-chat/knowledge/special-schedules | Admin | PaginationDTO | Holiday and special schedules |
| POST | /v1/gym-chat/knowledge/special-schedules | Admin | CreateGymSpecialScheduleDTO | Add special schedule |
| GET | /v1/gym-chat/knowledge/faqs | Admin | PaginationDTO | FAQ list |
| POST | /v1/gym-chat/knowledge/faqs | Admin | CreateGymFaqEntryDTO | Add FAQ entry |

## Grounding Input Payload

```typescript
interface GymChatGroundingPayload {
  operating_hours: Array<{
    day_of_week: number
    opens_at: string
    closes_at: string
    is_closed: boolean
    label?: string
  }>
  special_schedules: Array<{
    starts_on: string
    ends_on: string
    opens_at?: string
    closes_at?: string
    is_closed: boolean
    reason: string
    pricing_note?: string
  }>
  faqs: Array<{
    category: string
    question: string
    answer: string
    keywords?: string[]
  }>
  membership_plans: Array<{
    name: string
    price: string
    duration_days: number
    description?: string
  }>
  session_history: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  user_context?: {
    first_name?: string
    role: string
    active_membership?: boolean
  }
}
```

## Python Service Contracts

```text
GET /health
  Output: 200 { status: "ok" }

POST /chat/gym
  Input:  {
            session_id: string,
            message: string,
            grounding: GymChatGroundingPayload,
            policy: {
              gym_only: true,
              refuse_out_of_scope: true
            }
          }
  Output: {
            reply: string,
            out_of_scope: boolean,
            sources: string[],
            follow_up_suggestions: string[],
            model_used: string | null,
            token_count: number | null
          }
```

### OpenRouter Usage

- Default provider is OpenRouter.ai.
- Use cheaper and faster instruct-capable models for grounded gym support answers.
- Request strict structured JSON output for every `/chat/gym` response.
- Keep provider routing optimized for latency, with fallbacks enabled by default.

## Process Flow

### Flow 16A - Grounded Gym Chat

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | POST `/v1/gym-chat/messages` | Send message with optional session ID |
| 2 | GymChatService | Resolve or create `gym_chat_sessions` | Load recent chat history |
| 3 | GymChatService | Load grounding data | Hours, schedules, FAQs, and membership plans |
| 4 | GymChatService | POST `/chat/gym` | Send message, history, and grounding payload to Python |
| 5 | Python | If prompt is not gym-related: refuse | Returns `out_of_scope=true` with brief refusal |
| 6 | Python | If prompt is gym-related: answer from grounded payload | Use OpenRouter to phrase and connect facts from grounding |
| 7 | GymChatService | INSERT `gym_chat_messages` and `gym_chat_interaction_logs` | Save both request and reply metadata |
| 8 | GymChatService | Return reply, sources, and follow-ups | Public response wrapped by Nest |

### Flow 16B - Admin Knowledge Update

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin | Create or update hours, schedules, or FAQs | Via knowledge endpoints |
| 2 | GymKnowledgeService | Validate payload | Ensure date and time ranges are valid |
| 3 | GymKnowledgeService | INSERT or UPDATE backend tables | Python is not called here |
| 4 | Future chats | Consume latest grounded data | No redeploy required |

## Service Functions

```typescript
// Nest GymChatService
sendMessage(userId: string, dto: SendGymChatMessageDTO): Promise<GymChatReply>
getMySessions(userId: string, dto: GymChatSessionFilterDTO): Promise<PaginatedResult<GymChatSession>>
getSessionMessages(userId: string, sessionId: string, dto: PaginationDTO): Promise<PaginatedResult<GymChatMessage>>
archiveSession(userId: string, sessionId: string): Promise<void>
buildGroundingPayload(userId: string, sessionId: string): Promise<GymChatGroundingPayload>

// Nest GymKnowledgeService
replaceOperatingHours(dto: UpsertGymOperatingHoursDTO[]): Promise<GymOperatingHour[]>
createSpecialSchedule(dto: CreateGymSpecialScheduleDTO): Promise<GymSpecialSchedule>
createFaqEntry(dto: CreateGymFaqEntryDTO): Promise<GymFaqEntry>

// Python GymChatService
generate_gym_reply(input: GymChatRequest) -> GymChatResponse
is_out_of_scope(message: string) -> bool
build_openrouter_chat_request(input: GymChatRequest) -> dict
```
