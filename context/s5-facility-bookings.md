# FitTrack — S5 — Facility Bookings
_Always include `00-global-contracts.md` alongside this file._

---

# S5 — Facility Bookings

## Overview
Members book amenities (courts, rings) with a 30% non-refundable down payment. Remaining 70% paid on arrival. Self-service booking. No refunds on cancellation.

## Prisma Schema

```prisma
model Amenity {
  id                    String         @id @default(uuid()) @db.Uuid
  name                  String         @db.VarChar(100)
  type                  AmenityType
  description           String?
  capacity              Int            @default(1)
  hourly_rate           Decimal        @default(0) @db.Decimal(8,2)
  requires_subscription Boolean        @default(false)
  is_active             Boolean        @default(true)
  created_at            DateTime       @default(now()) @db.Timestamptz(6)
  updated_at            DateTime       @updatedAt @db.Timestamptz(6)

  bookings              AmenityBooking[]

  @@index([is_active, type])
  @@map("amenities")
}

enum AmenityType { basketball_court boxing_ring other }

model AmenityBooking {
  id                  String        @id @default(uuid()) @db.Uuid
  user_id             String        @db.Uuid
  amenity_id          String        @db.Uuid
  status              BookingStatus @default(pending)
  starts_at           DateTime      @db.Timestamptz(6)
  ends_at             DateTime      @db.Timestamptz(6)
  total_amount        Decimal       @db.Decimal(10,2)
  downpayment_amount  Decimal       @db.Decimal(10,2)
  balance_amount      Decimal       @db.Decimal(10,2)
  downpayment_paid_at DateTime?     @db.Timestamptz(6)
  balance_paid_at     DateTime?     @db.Timestamptz(6)
  cancelled_at        DateTime?     @db.Timestamptz(6)
  completed_at        DateTime?     @db.Timestamptz(6)
  notes               String?
  created_at          DateTime      @default(now()) @db.Timestamptz(6)
  updated_at          DateTime      @updatedAt @db.Timestamptz(6)

  user                User          @relation(fields: [user_id], references: [id])
  amenity             Amenity       @relation(fields: [amenity_id], references: [id])

  @@index([user_id])
  @@index([amenity_id, starts_at, ends_at])
  @@index([status])
  @@map("amenity_bookings")
}

enum BookingStatus { pending confirmed balance_pending completed cancelled no_show }
// pending: downpayment not yet received
// confirmed: downpayment received; awaiting the day
// balance_pending: on arrival; balance not yet collected
// completed: balance collected
// cancelled: cancelled (downpayment forfeited — no refund)
// no_show: did not arrive; slot time passed
```

## DTOs

```typescript
class CreateAmenityDTO {
  name: string                  // @IsString() @IsNotEmpty() @MaxLength(100)
  type: AmenityType             // @IsEnum(AmenityType)
  description?: string
  capacity?: number             // @IsOptional() @IsInt() @Min(1)
  hourly_rate?: number          // @IsOptional() @Min(0)
  requires_subscription?: boolean
}

class UpdateAmenityDTO {
  name?: string
  type?: AmenityType
  description?: string
  capacity?: number
  hourly_rate?: number
  requires_subscription?: boolean
  is_active?: boolean
}

class AvailabilityQueryDTO {
  amenity_id: string            // @IsUUID()
  date: string                  // @IsISO8601() YYYY-MM-DD
}

class CreateBookingDTO {
  amenity_id: string            // @IsUUID()
  starts_at: string             // @IsISO8601() @FutureDate()
  ends_at: string               // @IsISO8601() must be after starts_at
  provider: PaymentProvider     // @IsEnum(PaymentProvider) — for downpayment
  notes?: string                // @IsOptional() @MaxLength(500)
}

class ProcessBalanceDTO {
  provider: PaymentProvider     // @IsEnum(PaymentProvider)
  screenshot_url?: string       // @IsOptional() @IsUrl() — if cash
  reference_no?: string         // @IsOptional()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/bookings/amenities | Public | — | List active amenities |
| GET | /v1/bookings/amenities/:id | JWT | — | Single amenity |
| POST | /v1/bookings/amenities | Admin | CreateAmenityDTO | Create amenity |
| PATCH | /v1/bookings/amenities/:id | Admin | UpdateAmenityDTO | Update amenity |
| DELETE | /v1/bookings/amenities/:id | Admin | — | Soft-delete (is_active=false) |
| GET | /v1/bookings/amenities/availability | JWT | AvailabilityQueryDTO | 30-min slots availability |
| POST | /v1/bookings/amenity | JWT | CreateBookingDTO | Create booking + initiate downpayment |
| GET | /v1/bookings/amenity/my | JWT | DateRangeDTO | Own booking history |
| PATCH | /v1/bookings/amenity/:id/cancel | JWT | — | Cancel booking (no refund) |
| POST | /v1/bookings/amenity/:id/balance | Staff | ProcessBalanceDTO | Collect remaining 70% on arrival |
| GET | /v1/bookings/amenity | Admin/Staff | DateRangeDTO | All bookings admin view |

## Process Flows

### Flow 5A — Amenity Booking

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | GET /v1/bookings/amenities/availability?amenity_id&date | Returns 30-min slots with available=true/false |
| 2 | User | POST /v1/bookings/amenity + Idempotency-Key | |
| 3 | BookingService | If requires_subscription: verify active subscription | Throw 403 SUBSCRIPTION_REQUIRED |
| 4 | BookingService | Compute 30-min slot keys; SET NX EX 10 per slot | If ANY fails: release all + throw 409 DOUBLE_BOOKING |
| 5 | BookingService | SELECT amenity_bookings WHERE overlap AND status IN (confirmed, pending, balance_pending) FOR UPDATE; COUNT < capacity | Throw 409 if at capacity; release Redis locks |
| 6 | BookingService | total_amount = hours × hourly_rate; downpayment = ROUND(total × 0.30, 2); balance = total - downpayment | |
| 7 | BookingService | INSERT amenity_bookings (status=pending, total_amount, downpayment_amount, balance_amount) | |
| 8 | BookingService | [FREE: hourly_rate=0] INSERT booking (status=confirmed, downpayment_amount=0, balance_amount=0) → skip to step 12 | |
| 9 | BookingService | [PAYMONGO] INSERT payments (payable_type=booking, payment_stage=downpayment, amount=downpayment_amount); create PayMongo link | Return checkout_url |
| 10 | BookingService | [CASH] INSERT payments (payable_type=booking, payment_stage=downpayment, status=awaiting_verification); staff submits screenshot | Admin/staff verifies → same confirm step |
| 11 | BookingService | On PaymentCompletedEvent: UPDATE booking status=confirmed, downpayment_paid_at=now | Emit BookingConfirmedEvent |
| 12 | BullMQ | Enqueue no-show-check delayed job at starts_at+30min | |
| 13 | NotificationService | BookingConfirmedEvent: email to user | |

### Flow 5B — Balance Collection on Arrival

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Staff | POST /v1/bookings/amenity/:id/balance { provider, screenshot_url?, reference_no? } | Customer arrives |
| 2 | BookingService | Verify booking status=confirmed AND starts_at <= now | Throw 422 if not time yet or wrong status |
| 3 | BookingService | UPDATE booking status=balance_pending | |
| 4 | BookingService | INSERT payments (payable_type=booking, payment_stage=balance, amount=balance_amount) | |
| 5 | BookingService | [PAYMONGO] Generate new PayMongo link for balance; customer scans → webhook confirms | |
| 6 | BookingService | [CASH] Staff marks paid via manual payment endpoint → admin/staff verifies | |
| 7 | BookingService | On PaymentCompletedEvent (balance): UPDATE booking status=completed, balance_paid_at=now | |

### Flow 5C — Cancellation (No Refund)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | User | PATCH /v1/bookings/amenity/:id/cancel | |
| 2 | BookingService | Verify booking belongs to user AND status IN (pending, confirmed) | Throw 403 or 422 |
| 3 | BookingService | UPDATE status=cancelled, cancelled_at=now | Downpayment forfeited — no refund processed |
| 4 | BookingService | Emit BookingCancelledEvent | In-app + email notification |

## BullMQ Queues

| Queue | Job | Trigger | Schedule |
|-------|-----|---------|----------|
| no-show-booking | check-no-show | BookingConfirmedEvent (delayed) | starts_at + 30min |
| booking-completion | complete-past-bookings | CRON | Hourly :00 |
| pending-booking-cleanup | cancel-stale | CRON | Every 15min |

**Pending cleanup SQL:**
```sql
UPDATE amenity_bookings SET status='cancelled', cancelled_at=now()
WHERE status='pending' AND created_at < now() - interval '15 minutes';
```

## Service Functions

```typescript
// BookingService
listAmenities(): Promise<Amenity[]>
getAmenityById(id: string): Promise<Amenity>
createAmenity(dto: CreateAmenityDTO): Promise<Amenity>
updateAmenity(id: string, dto: UpdateAmenityDTO): Promise<Amenity>
deleteAmenity(id: string): Promise<void>
getAvailability(dto: AvailabilityQueryDTO): Promise<SlotAvailability[]>
createBooking(userId: string, dto: CreateBookingDTO, idempotencyKey: string): Promise<AmenityBooking>
getMyBookings(userId: string, dto: DateRangeDTO): Promise<PaginatedResult<AmenityBooking>>
cancelBooking(bookingId: string, userId: string): Promise<void>
processBalance(bookingId: string, staffId: string, dto: ProcessBalanceDTO): Promise<void>
getAllBookings(dto: DateRangeDTO): Promise<PaginatedResult<AmenityBooking>>
handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void>
runNoShowCheck(bookingId: string): Promise<void>
runCompletionCron(): Promise<void>
runPendingCleanupCron(): Promise<void>
```

---