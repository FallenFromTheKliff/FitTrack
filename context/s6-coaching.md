# FitTrack — S6 — Coaching
_Always include `00-global-contracts.md` alongside this file._

---

# S6 — Coaching

## Overview
Coach discovery and appointment booking. Open to all registered users regardless of membership. 30% non-refundable down payment applies to paid sessions. Gym takes a configurable commission cut per coach. Revenue split tracked on each appointment for analytics and payout reporting.

## Prisma Schema

```prisma
model CoachProfile {
  id                       String   @id @default(uuid()) @db.Uuid
  user_id                  String   @unique @db.Uuid
  specialization           String?  @db.VarChar(255)
  bio                      String?
  certification            String?  @db.VarChar(255)
  hourly_rate              Decimal  @default(0) @db.Decimal(8,2)
  gym_commission_pct       Decimal  @default(20) @db.Decimal(5,2) // gym keeps this %
  average_rating           Decimal? @db.Decimal(3,2)
  rating_count             Int      @default(0)
  is_available_for_booking Boolean  @default(true)
  created_at               DateTime @default(now()) @db.Timestamptz(6)
  updated_at               DateTime @updatedAt @db.Timestamptz(6)

  user                     User     @relation(fields: [user_id], references: [id])
  appointments             CoachAppointment[]
  reviews                  CoachReview[]
  availability_slots       CoachAvailabilitySlot[]
  client_relationships     CoachClientRelationship[] @relation("coach_rel")
  training_plans_coached   TrainingPlan[]

  @@index([is_available_for_booking, average_rating(sort: Desc)])
  @@map("coach_profiles")
}

model CoachAppointment {
  id                  String            @id @default(uuid()) @db.Uuid
  user_id             String            @db.Uuid  // the person who booked
  coach_id            String            @db.Uuid
  status              AppointmentStatus @default(pending_coach)
  is_free_session     Boolean           @default(false)
  scheduled_at        DateTime          @db.Timestamptz(6)
  duration_minutes    Int               @default(60)
  total_amount        Decimal           @default(0) @db.Decimal(10,2)
  downpayment_amount  Decimal           @default(0) @db.Decimal(10,2)
  balance_amount      Decimal           @default(0) @db.Decimal(10,2)
  gym_revenue         Decimal           @default(0) @db.Decimal(10,2) // gym's cut
  coach_earnings      Decimal           @default(0) @db.Decimal(10,2) // coach's portion
  downpayment_paid_at DateTime?         @db.Timestamptz(6)
  balance_paid_at     DateTime?         @db.Timestamptz(6)
  session_notes       String?           // coach fills post-session
  member_notes        String?
  completed_at        DateTime?         @db.Timestamptz(6)
  no_show_at          DateTime?         @db.Timestamptz(6)
  cancellation_reason String?
  cancelled_at        DateTime?         @db.Timestamptz(6)
  created_at          DateTime          @default(now()) @db.Timestamptz(6)
  updated_at          DateTime          @updatedAt @db.Timestamptz(6)

  user                User              @relation("member", fields: [user_id], references: [id])
  coach               CoachProfile      @relation(fields: [coach_id], references: [id])
  review              CoachReview?

  @@index([user_id, status])
  @@index([coach_id, scheduled_at])
  @@index([scheduled_at, status])
  @@map("coach_appointments")
}

enum AppointmentStatus {
  pending_coach
  pending_payment
  confirmed
  cancelled
  completed
  no_show
}

model CoachReview {
  id             String           @id @default(uuid()) @db.Uuid
  coach_id       String           @db.Uuid
  reviewer_id    String           @db.Uuid
  appointment_id String           @unique @db.Uuid
  rating         Int              @db.SmallInt
  comment        String?
  created_at     DateTime         @default(now()) @db.Timestamptz(6)
  updated_at     DateTime         @updatedAt @db.Timestamptz(6)

  coach          CoachProfile     @relation(fields: [coach_id], references: [id])
  reviewer       User             @relation(fields: [reviewer_id], references: [id])
  appointment    CoachAppointment @relation(fields: [appointment_id], references: [id])

  @@index([coach_id, created_at(sort: Desc)])
  @@map("coach_reviews")
}

model CoachAvailabilitySlot {
  id          String      @id @default(uuid()) @db.Uuid
  coach_id    String      @db.Uuid
  day_of_week Int         @db.SmallInt  // 0=Sunday 6=Saturday
  start_time  DateTime    @db.Time(0)
  end_time    DateTime    @db.Time(0)
  is_active   Boolean     @default(true)
  created_at  DateTime    @default(now()) @db.Timestamptz(6)
  updated_at  DateTime    @updatedAt @db.Timestamptz(6)

  coach       CoachProfile @relation(fields: [coach_id], references: [id])

  // Partial unique via raw migration:
  // CREATE UNIQUE INDEX coach_slot_unique
  //   ON coach_availability_slots(coach_id, day_of_week, start_time)
  //   WHERE is_active = true;
  @@index([coach_id, day_of_week, is_active])
  @@map("coach_availability_slots")
}

model CoachClientRelationship {
  id         String             @id @default(uuid()) @db.Uuid
  coach_id   String             @db.Uuid
  member_id  String             @db.Uuid
  status     RelationshipStatus @default(pending)
  started_at DateTime?          @db.Timestamptz(6)
  ended_at   DateTime?          @db.Timestamptz(6)
  notes      String?
  created_at DateTime           @default(now()) @db.Timestamptz(6)
  updated_at DateTime           @updatedAt @db.Timestamptz(6)

  coach      CoachProfile @relation("coach_rel", fields: [coach_id], references: [id])
  member     User         @relation("member_rel", fields: [member_id], references: [id])

  // Partial unique via raw migration:
  // CREATE UNIQUE INDEX coach_client_active_unique
  //   ON coach_client_relationships(coach_id, member_id)
  //   WHERE status IN ('pending','active');
  @@index([coach_id, status])
  @@index([member_id, status])
  @@map("coach_client_relationships")
}

enum RelationshipStatus { pending active paused terminated }
```

## DTOs

```typescript
class UpdateCoachProfileDTO {
  specialization?: string        // @IsOptional() @MaxLength(255)
  bio?: string                   // @IsOptional() @MaxLength(2000)
  certification?: string         // @IsOptional() @MaxLength(255)
  hourly_rate?: number           // @IsOptional() @Min(0)
  gym_commission_pct?: number    // @IsOptional() @Min(0) @Max(100) — admin only
  is_available_for_booking?: boolean
}

class CoachFilterDTO extends PaginationDTO {
  specialization?: string        // @IsOptional()
  min_rating?: number            // @IsOptional() @Min(0) @Max(5)
  max_rate?: number              // @IsOptional() @Min(0)
}

class SetAvailabilityDTO {
  slots: Array<{
    day_of_week: number          // @IsInt() @Min(0) @Max(6)
    start_time: string           // @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    end_time: string             // @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  }>
}

class CreateAppointmentDTO {
  coach_id: string               // @IsUUID()
  scheduled_at: string           // @IsISO8601() @FutureDate()
  duration_minutes: number       // @IsInt() @Min(30) @Max(180)
  member_notes?: string          // @IsOptional() @MaxLength(500)
}

class InitiateAppointmentPaymentDTO {
  provider: PaymentProvider      // @IsEnum(PaymentProvider)
}

class RespondAppointmentDTO {
  accepted: boolean              // @IsBoolean()
  rejection_reason?: string      // required when accepted=false
}

class CompleteAppointmentDTO {
  session_notes?: string         // @IsOptional() @MaxLength(2000)
}

class CancelAppointmentDTO {
  reason?: string                // @IsOptional() @MaxLength(500)
}

class CreateReviewDTO {
  appointment_id: string         // @IsUUID()
  rating: number                 // @IsInt() @Min(1) @Max(5)
  comment?: string               // @IsOptional() @MaxLength(1000)
}

class RequestRelationshipDTO {
  coach_id: string               // @IsUUID()
  notes?: string                 // @IsOptional() @MaxLength(500)
}

class UpdateRelationshipDTO {
  status: 'active' | 'paused' | 'terminated'  // @IsIn(["active","paused","terminated"])
  notes?: string
}

class AppointmentBalanceDTO {
  provider: PaymentProvider      // @IsEnum(PaymentProvider)
  screenshot_url?: string        // @IsOptional() @IsUrl()
  reference_no?: string          // @IsOptional()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/coaching/coaches | JWT | CoachFilterDTO | Browse coaches |
| GET | /v1/coaching/coaches/:id | JWT | — | Coach profile + availability |
| PATCH | /v1/coaching/coaches/me | Coach | UpdateCoachProfileDTO | Coach updates own profile |
| PATCH | /v1/coaching/coaches/:id | Admin | UpdateCoachProfileDTO | Admin updates coach (including commission) |
| POST | /v1/coaching/coaches/availability | Coach | SetAvailabilityDTO | Replace weekly availability |
| POST | /v1/coaching/appointments | JWT | CreateAppointmentDTO | Request appointment |
| GET | /v1/coaching/appointments/my | JWT | DateRangeDTO | Own appointments |
| PATCH | /v1/coaching/appointments/:id/respond | Coach | RespondAppointmentDTO | Accept or reject |
| POST | /v1/coaching/appointments/:id/pay | JWT | InitiateAppointmentPaymentDTO | Pay 30% downpayment |
| POST | /v1/coaching/appointments/:id/balance | Staff | AppointmentBalanceDTO | Collect 70% on arrival |
| PATCH | /v1/coaching/appointments/:id/complete | Coach | CompleteAppointmentDTO | Mark session complete |
| PATCH | /v1/coaching/appointments/:id/cancel | JWT | CancelAppointmentDTO | Cancel appointment |
| POST | /v1/coaching/coaches/:id/reviews | JWT | CreateReviewDTO | Submit review post-session |
| POST | /v1/coaching/relationships | JWT | RequestRelationshipDTO | Request formal coaching relationship |
| GET | /v1/coaching/relationships/my | JWT | — | Own relationships |
| GET | /v1/coaching/clients | Coach | PaginationDTO | Coach's client list |
| PATCH | /v1/coaching/relationships/:id | Coach | UpdateRelationshipDTO | Accept/pause/terminate |

## Process Flows

### Flow 6A — Set Coach Availability

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Coach | POST /v1/coaching/coaches/availability (SetAvailabilityDTO) | |
| 2 | CoachingService | Validate: start_time < end_time; no overlapping slots per day_of_week | Throw 422 on violation |
| 3 | CoachingService | BEGIN TRANSACTION | |
| 4 | CoachingService | UPDATE coach_availability_slots SET is_active=false WHERE coach_id=X | Soft-deactivate; do NOT delete — existing appointments reference these |
| 5 | CoachingService | INSERT new slots (is_active=true) | |
| 6 | CoachingService | COMMIT | Existing confirmed appointments on old slots are NOT cancelled |

### Flow 6B — Appointment Full Lifecycle

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | POST /v1/coaching/appointments (CreateAppointmentDTO) | Any registered user; no membership required |
| 2 | CoachingService | SELECT coach_availability_slots WHERE coach_id AND day_of_week AND slot covers [scheduled_at, +duration] | Throw 422 NO_AVAILABLE_SLOT |
| 3 | CoachingService | SELECT coach_appointments WHERE coach_id=X AND overlaps AND status IN (confirmed, pending_coach, pending_payment) FOR UPDATE | Throw 409 SCHEDULE_CONFLICT |
| 4 | CoachingService | Check if user has active subscription with plan.includes_coaching=true | is_free_session=true if yes |
| 5 | CoachingService | Compute amounts: total = hourly_rate × (duration_minutes/60); gym_revenue = total × (commission/100); coach_earnings = total - gym_revenue; downpayment = ROUND(total × 0.30, 2); balance = total - downpayment | |
| 6 | CoachingService | INSERT coach_appointments (status=pending_coach, all amounts, is_free_session) | Notify coach: email |
| 7 | Coach | PATCH .../respond { accepted: true/false } | |
| 8 | CoachingService | [Rejected] UPDATE status=cancelled; notify user | |
| 9 | CoachingService | [Accepted, free] UPDATE status=confirmed | Emit AppointmentConfirmedEvent; enqueue no-show job |
| 10 | CoachingService | [Accepted, paid] UPDATE status=pending_payment | Notify user to pay downpayment |
| 11 | User | POST .../pay { provider } + Idempotency-Key | 30% downpayment |
| 12 | PaymentsService | INSERT payments (payable_type=coaching, payment_stage=downpayment, amount=downpayment_amount) | [PAYMONGO] create link; [CASH] await verification |
| 13 | CoachingService | On PaymentCompletedEvent (downpayment): UPDATE status=confirmed, downpayment_paid_at | AppointmentConfirmedEvent; enqueue no-show job |
| 14 | BullMQ | no-show-check fires at scheduled_at+30min | If still confirmed → status=no_show |
| 15 | Staff | POST .../balance { provider } on arrival | Collect remaining 70% |
| 16 | CoachingService | INSERT payments (payment_stage=balance); process payment | On confirmation: UPDATE balance_paid_at |
| 17 | Coach | PATCH .../complete { session_notes? } | Must be status=confirmed |
| 18 | CoachingService | UPDATE status=completed, completed_at=now, session_notes | Emit AppointmentCompletedEvent; user prompted to review |
| 19 | User | POST /v1/coaching/coaches/:id/reviews | Only after status=completed |
| 20 | CoachingService | INSERT coach_reviews; recalculate average_rating + rating_count | |

### Flow 6C — Coach-Member Relationship

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | POST /v1/coaching/relationships { coach_id } | Request formal relationship |
| 2 | CoachingService | Check no existing pending/active pair | Throw 409 if exists |
| 3 | CoachingService | INSERT coach_client_relationships (status=pending) | Notify coach |
| 4 | Coach | PATCH .../relationships/:id { status: active } | Coach accepts |
| 5 | CoachingService | UPDATE status=active, started_at=now | Emit RelationshipActivatedEvent |
| 6 | Coach | PATCH .../relationships/:id { status: paused | terminated } | |
| 7 | CoachingService | UPDATE status; if terminated: ended_at=now | Emit event; user notified |

## Appointment Lifecycle

| From | Trigger | → To | Side Effects |
|------|---------|------|--------------|
| — | User books | pending_coach | Coach notified |
| pending_coach | Coach accepts (paid) | pending_payment | User must pay 30% |
| pending_coach | Coach accepts (free) | confirmed | no-show job enqueued |
| pending_coach | Coach rejects | cancelled | User notified |
| pending_payment | Downpayment confirmed | confirmed | no-show job enqueued |
| confirmed | No-show job +30min | no_show | |
| confirmed | Staff collects balance + coach completes | completed | AppointmentCompletedEvent |
| any | Cancelled | cancelled | No refund on downpayment |

## Service Functions

```typescript
// CoachingService
listCoaches(dto: CoachFilterDTO): Promise<PaginatedResult<CoachProfile>>
getCoachById(id: string): Promise<CoachProfile>
updateMyProfile(coachId: string, dto: UpdateCoachProfileDTO): Promise<CoachProfile>
adminUpdateCoach(coachId: string, dto: UpdateCoachProfileDTO): Promise<CoachProfile>
setAvailability(coachId: string, dto: SetAvailabilityDTO): Promise<void>
createAppointment(userId: string, dto: CreateAppointmentDTO): Promise<CoachAppointment>
getMyAppointments(userId: string, dto: DateRangeDTO): Promise<PaginatedResult<CoachAppointment>>
respondToAppointment(coachId: string, appointmentId: string, dto: RespondAppointmentDTO): Promise<void>
initiateDownpayment(userId: string, appointmentId: string, dto: InitiateAppointmentPaymentDTO, idempotencyKey: string): Promise<{ checkout_url?: string }>
processBalance(staffId: string, appointmentId: string, dto: AppointmentBalanceDTO): Promise<void>
completeAppointment(coachId: string, appointmentId: string, dto: CompleteAppointmentDTO): Promise<void>
cancelAppointment(requesterId: string, role: UserRole, appointmentId: string, dto: CancelAppointmentDTO): Promise<void>
submitReview(userId: string, coachId: string, dto: CreateReviewDTO): Promise<CoachReview>
requestRelationship(userId: string, dto: RequestRelationshipDTO): Promise<CoachClientRelationship>
getMyRelationships(userId: string): Promise<CoachClientRelationship[]>
getMyClients(coachId: string, dto: PaginationDTO): Promise<PaginatedResult<CoachClientRelationship>>
updateRelationship(coachId: string, relationshipId: string, dto: UpdateRelationshipDTO): Promise<CoachClientRelationship>
handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void>
runNoShowCheck(appointmentId: string): Promise<void>
recalculateRating(coachId: string): Promise<void>
```

---