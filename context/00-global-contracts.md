# FitTrack - Global Contracts & Tech Stack
_Include this file in EVERY Codex session alongside the domain file._

---

# Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| **REST API Framework** | NestJS |
| **Database** | PostgreSQL |
| **ORM** | Prisma ORM |
| **Auth** | JWT (HS256) + Passport JWT + NestJS Guards/Decorators (RBAC) |
| **Encryption** | Bcrypt (rounds=12) |
| **Email** | NodeMailer via BullMQ email queue |
| **SMS** | Twilio via BullMQ sms queue |
| **Payment Gateway** | PayMongo |
| **File Storage** | Cloudflare R2 |
| **Caching / Locks** | Redis (token blacklist, rate limit, booking locks, gym-layout status cache/pub-sub) |
| **Job Queues** | BullMQ |
| **Real-Time** | WebSocket (NestJS Gateway) - AI pose detection and gym-layout live equipment updates |
| **Data Validation** | class-validator + class-transformer |
| **Rate Limiting** | @nestjs/throttler |
| **HTTP Security** | Helmet |
| **Event Bus** | NestJS EventEmitter2 (domain events) |
| **API Documentation** | Swagger (OpenAPI) |
| **Logging** | Winston |
| **Monitoring** | Grafana |
| **Deployment** | Docker + Railway |
| **AI Microservice** | Python - FastAPI - LLaMA - MediaPipe - TensorFlow |

Note: FitTrack now standardizes on HS256 with `JWT_SECRET`. Older RS256 references should be treated as outdated.

---

## Global Contracts

### Response Envelope
```typescript
interface ApiResponse<T> {
  data: T
  meta?: { page: number; limit: number; total: number; total_pages: number }
}
```

### Error Format (RFC 7807)
```typescript
interface ApiError {
  type: string    // CONFLICT | NOT_FOUND | BUSINESS_RULE_VIOLATION | FORBIDDEN | etc.
  title: string
  status: number
  detail: string
}
```

### JWT Payload
```typescript
// Guards read role and status directly from JWT - no Redis lookup needed
interface JwtPayload {
  sub: string       // userId
  role: UserRole    // admin | staff | member | coach
  status: UserStatus // active | suspended | banned
  jti: string       // unique token ID for blacklisting on logout
  iat: number
  exp: number
}
```

### Redis Usage (Strict - Only These Shared Cases)
| Key | TTL | Purpose |
|-----|-----|---------|
| token_blacklist:{jti} | 900s | Revoked JWT JTI on logout |
| rate_limit:ip:{ip} | 60s | 100 req/min per IP (ZSet) |
| rate_limit:user:{userId} | 60s | 20 write req/min per user (ZSet) |
| booking_lock:{amenityId}:{YYYYMMDD-HHMM} | 10s | Slot lock NX EX |
| equipment_status | — | Hash; field=equipmentId; value=current equipment status for `/gym-layout` snapshot hydration |

### Redis Pub/Sub Channels
| Channel | Purpose |
|---------|---------|
| equipment:status | Fanout of gym-layout equipment delta updates to the `/gym-layout` gateway |

### WebSocket Namespaces
| Namespace | Purpose | Auth Pattern |
|-----------|---------|--------------|
| /pose | AI pose detection live session events | JWT socket auth mirroring HTTP blacklist/status checks |
| /gym-layout | Live equipment snapshot and delta updates | JWT socket auth mirroring HTTP blacklist/status checks |

### Idempotency-Key Header
Required on all payment-initiating endpoints. Client generates UUID per attempt, reuses on retry.

| Endpoint | Required |
|----------|----------|
| POST /v1/membership/subscribe | ✓ |
| POST /v1/bookings/amenity | ✓ |
| POST /v1/coaching/appointments/:id/pay | ✓ |
| POST /v1/inventory/sales | ✓ |

### File Upload
All file uploads (screenshots, avatars) go through `POST /v1/files/upload`.
- Backed by Cloudflare R2
- Returns `{ url: string }` - URL then passed into the relevant DTO
- Accepts: image/jpeg, image/png, max 5MB

### Payment Model
```typescript
enum PayableType  { subscription booking coaching product }
enum PaymentStage { downpayment balance full }
enum PaymentProvider { paymongo cash }
enum PaymentStatus { pending processing awaiting_verification completed failed }
```

---

## Partial Unique Indexes (Raw SQL Migrations)

These cannot be expressed in Prisma schema syntax. Add them in a separate migration after the initial `prisma migrate dev`:

```sql
-- One active subscription per user
CREATE UNIQUE INDEX subscriptions_one_active_per_user
  ON subscriptions(user_id)
  WHERE status IN ('active','past_due','pending_payment');

-- One active training plan per user (non-template)
CREATE UNIQUE INDEX one_active_plan_per_user
  ON training_plans(user_id)
  WHERE is_active = true AND is_template = false;

-- One active TDEE snapshot per user
CREATE UNIQUE INDEX one_active_tdee
  ON tdee_profiles(user_id) WHERE is_active = true;

-- One active macro target per user
CREATE UNIQUE INDEX one_active_macro
  ON macro_targets(user_id) WHERE is_active = true;

-- One active coaching session per context type per user
CREATE UNIQUE INDEX one_active_ai_session_per_context
  ON ai_chat_sessions(user_id, context_type) WHERE is_active = true;

-- No duplicate availability slots for a coach
CREATE UNIQUE INDEX coach_slot_unique
  ON coach_availability_slots(coach_id, day_of_week, start_time)
  WHERE is_active = true;

-- One active coach-client relationship per pair
CREATE UNIQUE INDEX coach_client_active_unique
  ON coach_client_relationships(coach_id, member_id)
  WHERE status IN ('pending','active');

-- No duplicate sets per exercise per session
CREATE UNIQUE INDEX exercise_log_set_unique
  ON exercise_logs(session_id, exercise_id, set_number);
```

```

---

# S14 - Auditing

## Overview
Cross-cutting audit trail for all sensitive mutations across the system. Powered by NestJS EventEmitter2 - every domain emits an `AuditEvent` after any sensitive write, and a single `AuditService` handles all writes to `audit_logs`. Never blocks the main flow - audit writes are fire-and-forget via `@OnEvent()`. Admin-only read access. Audit logs are **append-only** - no updates, no deletes.

## Prisma Schema

```prisma
model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String?  @db.Uuid         // who performed the action (null = system/cron)
  action     String   @db.VarChar(100) // e.g. USER_BANNED, PAYMENT_VERIFIED
  entity     String   @db.VarChar(100) // e.g. User, Payment, Subscription
  entity_id  String   @db.VarChar(100) // UUID of the affected record
  before     Json?                     // state snapshot before change
  after      Json?                     // state snapshot after change
  ip_address String?  @db.VarChar(45)
  created_at DateTime @default(now()) @db.Timestamptz(6)

  user User? @relation(fields: [user_id], references: [id], onDelete: SetNull)

  @@index([entity, entity_id])
  @@index([user_id, created_at(sort: Desc)])
  @@index([created_at(sort: Desc)])
  @@map("audit_logs")
}
```

## Audited Actions

| Action Constant | Entity | Trigger |
|---|---|---|
| `USER_CREATED` | User | Admin creates staff/coach/admin account |
| `USER_STATUS_CHANGED` | User | Admin suspends, bans, or reactivates account |
| `PASSWORD_RESET` | User | User successfully resets password |
| `PHONE_VERIFIED` | User | User verifies phone number |
| `PAYMENT_VERIFIED` | Payment | Admin/Staff approves or rejects a manual payment |
| `PAYMENT_REFUNDED` | Payment | Payment marked as refunded |
| `SUBSCRIPTION_CANCELLED` | Subscription | Member or admin cancels subscription |
| `SUBSCRIPTION_SUSPENDED` | Subscription | Admin suspends subscription |
| `BOOKING_CANCELLED` | AmenityBooking | User or staff cancels a booking |
| `APPOINTMENT_CANCELLED` | CoachAppointment | Any party cancels an appointment |
| `COACH_COMMISSION_CHANGED` | CoachProfile | Admin changes gym commission % |
| `EQUIPMENT_WRITEOFF` | GymEquipmentItem | Staff logs a quantity write-off |
| `PRODUCT_RESTOCKED` | RetailProduct | Admin/Staff restocks a retail product |

## DTOs

```typescript
class AuditFilterDTO extends PaginationDTO {
  entity?: string      // @IsOptional() @IsString()
  entity_id?: string   // @IsOptional() @IsUUID()
  user_id?: string     // @IsOptional() @IsUUID()
  action?: string      // @IsOptional() @IsString()
  start_date?: string  // @IsOptional() @IsISO8601()
  end_date?: string    // @IsOptional() @IsISO8601()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/audit | Admin | AuditFilterDTO | Query audit logs with filters |
| GET | /v1/audit/:id | Admin | - | Single audit log entry |

## AuditEvent Payload

```typescript
// Emitted by any domain service after a sensitive mutation
// Event name: 'audit.log'
interface AuditEvent {
  userId:    string | null  // actor (null if system/cron)
  action:    string         // one of the action constants above
  entity:    string         // model name
  entityId:  string         // affected record UUID
  before?:   Record<string, any>  // snapshot before (omit for create events)
  after?:    Record<string, any>  // snapshot after (omit for delete events)
  ipAddress?: string
}
```

## How to Emit from Any Domain Service

```typescript
// Inject EventEmitter2 in any domain service
import { EventEmitter2 } from '@nestjs/event-emitter';

// Example: AdminService suspending a user
async updateUserStatus(id: string, dto: UpdateUserStatusDTO, actorId: string, ip: string) {
  const before = await this.repo.findUserById(id);
  const after  = await this.repo.updateUser(id, { status: dto.status });

  this.eventEmitter.emit('audit.log', {
    userId:   actorId,
    action:   `USER_STATUS_CHANGED`,
    entity:   'User',
    entityId: id,
    before:   { status: before.status },
    after:    { status: after.status },
    ipAddress: ip,
  } satisfies AuditEvent);
}
```

## Process Flow

### Flow 14A - Audit Write (Fire-and-Forget)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Any domain service | Completes a sensitive mutation | e.g. payment verified, user banned |
| 2 | Domain service | `this.eventEmitter.emit('audit.log', payload)` | Non-blocking - does not await |
| 3 | AuditService | `@OnEvent('audit.log')` handler receives payload | Runs asynchronously |
| 4 | AuditService | `INSERT audit_logs` | Append-only - no updates ever |
| 5 | AuditService | If error: log via Winston, do NOT rethrow | Audit failure never breaks main flow |

## Service Functions

```typescript
// AuditService
handleAuditEvent(event: AuditEvent): Promise<void>  // @OnEvent('audit.log')
getAuditLogs(dto: AuditFilterDTO): Promise<PaginatedResult<AuditLog>>
getAuditLogById(id: string): Promise<AuditLog>
```
