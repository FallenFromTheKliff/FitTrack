# FitTrack — S14 — Auditing
_Always include `00-global-contracts.md` alongside this file._

---

# S14 — Auditing

## Overview
Cross-cutting audit trail for all sensitive mutations across the system. Powered by NestJS EventEmitter2 — every domain emits an `AuditEvent` after any sensitive write, and a single `AuditService` handles all writes to `audit_logs`. Never blocks the main flow — audit writes are fire-and-forget via `@OnEvent()`. Admin-only read access. Audit logs are **append-only** — no updates, no deletes.

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
| GET | /v1/audit/:id | Admin | — | Single audit log entry |

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

### Flow 14A — Audit Write (Fire-and-Forget)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Any domain service | Completes a sensitive mutation | e.g. payment verified, user banned |
| 2 | Domain service | `this.eventEmitter.emit('audit.log', payload)` | Non-blocking — does not await |
| 3 | AuditService | `@OnEvent('audit.log')` handler receives payload | Runs asynchronously |
| 4 | AuditService | `INSERT audit_logs` | Append-only — no updates ever |
| 5 | AuditService | If error: log via Winston, do NOT rethrow | Audit failure never breaks main flow |

## Service Functions

```typescript
// AuditService
handleAuditEvent(event: AuditEvent): Promise<void>  // @OnEvent('audit.log')
getAuditLogs(dto: AuditFilterDTO): Promise<PaginatedResult<AuditLog>>
getAuditLogById(id: string): Promise<AuditLog>
```