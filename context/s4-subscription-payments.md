# FitTrack — S4 — Subscription & Payments
_Always include `00-global-contracts.md` alongside this file._

---

# S4 — Subscription & Payments

## Overview
Membership plans, subscriptions with manual renewal, and all payment processing across the system. The payment table is shared across all domains via `payable_type` + `payment_stage`. No auto-renewal — members manually renew. Warning notifications sent at 7, 3, and 1 day before expiry.

## Prisma Schema

```prisma
model MembershipPlan {
  id                String         @id @default(uuid()) @db.Uuid
  name              String         @db.VarChar(100)
  description       String?
  price             Decimal        @db.Decimal(10,2)
  currency          String         @default("PHP") @db.VarChar(3)
  duration_days     Int
  features          Json           @default("{}")
  sort_order        Int            @default(0) @db.SmallInt
  includes_coaching Boolean        @default(false)
  is_active         Boolean        @default(true)
  created_at        DateTime       @default(now()) @db.Timestamptz(6)
  updated_at        DateTime       @updatedAt @db.Timestamptz(6)

  subscriptions     Subscription[]

  @@index([is_active, sort_order])
  @@map("membership_plans")
}

model Subscription {
  id                  String             @id @default(uuid()) @db.Uuid
  user_id             String             @db.Uuid
  plan_id             String             @db.Uuid
  payment_id          String?            @db.Uuid
  status              SubscriptionStatus @default(pending_payment)
  starts_at           DateTime?          @db.Timestamptz(6)
  expires_at          DateTime?          @db.Timestamptz(6)
  warned_7d_at        DateTime?          @db.Timestamptz(6)
  warned_3d_at        DateTime?          @db.Timestamptz(6)
  warned_1d_at        DateTime?          @db.Timestamptz(6)
  cancelled_at        DateTime?          @db.Timestamptz(6)
  cancellation_reason String?
  created_at          DateTime           @default(now()) @db.Timestamptz(6)
  updated_at          DateTime           @updatedAt @db.Timestamptz(6)

  user                User               @relation(fields: [user_id], references: [id])
  plan                MembershipPlan     @relation(fields: [plan_id], references: [id])

  // Partial unique index via raw migration:
  // CREATE UNIQUE INDEX subscriptions_one_active_per_user
  //   ON subscriptions(user_id)
  //   WHERE status IN ('active','past_due','pending_payment');
  @@index([user_id])
  @@index([expires_at, status])
  @@map("subscriptions")
}

enum SubscriptionStatus { pending_payment active past_due expired cancelled suspended }

model Payment {
  id               String          @id @default(uuid()) @db.Uuid
  user_id          String          @db.Uuid
  payable_type     PayableType
  payable_id       String          @db.Uuid
  payment_stage    PaymentStage
  amount           Decimal         @db.Decimal(10,2)
  currency         String          @default("PHP") @db.VarChar(3)
  provider         PaymentProvider
  provider_ref     String?         @unique @db.VarChar(255)
  gateway_event_id String?         @unique @db.VarChar(255)
  idempotency_key  String          @unique @db.VarChar(128)
  status           PaymentStatus   @default(pending)
  gateway_metadata Json?
  screenshot_url   String?         @db.VarChar(500)
  rejection_reason String?
  verified_by      String?         @db.Uuid
  verified_at      DateTime?       @db.Timestamptz(6)
  created_at       DateTime        @default(now()) @db.Timestamptz(6)
  updated_at       DateTime        @updatedAt @db.Timestamptz(6)

  user             User            @relation(fields: [user_id], references: [id])
  verifier         User?           @relation("payment_verifier", fields: [verified_by], references: [id])

  @@index([payable_type, payable_id])
  @@index([user_id, status])
  @@index([status])
  @@map("payments")
}

enum PayableType    { subscription booking coaching product }
enum PaymentStage  { downpayment balance full }
enum PaymentProvider { paymongo cash }
enum PaymentStatus  { pending processing awaiting_verification completed failed }
```

## DTOs

```typescript
class CreatePlanDTO {
  name: string                   // @IsString() @IsNotEmpty() @MaxLength(100)
  description?: string           // @IsOptional()
  price: number                  // @IsPositive()
  duration_days: number          // @IsInt() @Min(1)
  features?: Record<string, any> // @IsOptional()
  sort_order?: number            // @IsOptional() @IsInt() @Min(0)
  includes_coaching?: boolean    // @IsOptional() @IsBoolean()
}

class UpdatePlanDTO {
  name?: string
  description?: string
  price?: number                 // @IsOptional() @IsPositive()
  duration_days?: number         // @IsOptional() @IsInt() @Min(1)
  features?: Record<string, any>
  sort_order?: number
  includes_coaching?: boolean
  is_active?: boolean
}

class CreateSubscriptionDTO {
  plan_id: string                // @IsUUID()
  provider: PaymentProvider      // @IsEnum(PaymentProvider)
}

class CancelSubscriptionDTO {
  reason?: string                // @IsOptional() @MaxLength(500)
}

class ManualPaymentDTO {
  payable_type: PayableType      // @IsEnum(PayableType)
  payable_id: string             // @IsUUID()
  payment_stage: PaymentStage    // @IsEnum(PaymentStage)
  amount: number                 // @IsPositive()
  screenshot_url: string         // @IsUrl() — from POST /v1/files/upload
  reference_no: string           // @IsString() @IsNotEmpty() @MaxLength(100)
}

class VerifyPaymentDTO {
  action: 'approve' | 'reject'   // @IsIn(["approve","reject"])
  rejection_reason?: string      // required when action=reject
}

class PaymentFilterDTO extends PaginationDTO {
  status?: PaymentStatus         // @IsOptional()
  payable_type?: PayableType     // @IsOptional()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/membership/plans | Public | PaginationDTO | List active plans |
| GET | /v1/membership/plans/:id | Public | — | Single plan |
| POST | /v1/membership/plans | Admin | CreatePlanDTO | Create plan |
| PATCH | /v1/membership/plans/:id | Admin | UpdatePlanDTO | Edit plan |
| POST | /v1/membership/subscribe | JWT | CreateSubscriptionDTO | Subscribe to a plan |
| GET | /v1/membership/my-subscription | JWT | — | Own current subscription |
| POST | /v1/membership/cancel | JWT | CancelSubscriptionDTO | Cancel subscription |
| GET | /v1/payments/my | JWT | DateRangeDTO | Own payment history |
| GET | /v1/payments/:id | JWT | — | Single payment |
| GET | /v1/payments | Admin/Staff | PaymentFilterDTO | All payments; admin queue |
| POST | /v1/payments/manual | JWT/Staff | ManualPaymentDTO | Submit cash/manual payment |
| PATCH | /v1/payments/:id/verify | Admin/Staff | VerifyPaymentDTO | Approve or reject |
| POST | /v1/payments/webhook | Public (HMAC) | — | PayMongo webhook |
| POST | /v1/files/upload | JWT | multipart/form-data | Upload to R2; returns { url } |

## Process Flows

### Flow 4A — Subscribe via Gateway (PayMongo)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Member | POST /v1/membership/subscribe { plan_id, provider: paymongo } + Idempotency-Key | |
| 2 | SubscriptionService | Check no active/pending_payment sub for user | Throw 409; partial unique index enforces at DB level |
| 3 | SubscriptionService | INSERT subscriptions (status=pending_payment) | |
| 4 | PaymentsService | INSERT payments (payable_type=subscription, payment_stage=full, status=pending) | |
| 5 | PaymentsService | POST PayMongo create payment link; store provider_ref; UPDATE payments.status=processing | |
| 6 | PaymentsService | Return { checkout_url } | Member scans QR or visits URL |
| 7 | Gateway | POST /v1/payments/webhook (HMAC signed) | payment.paid event |
| 8 | WebhookHandler | Verify HMAC; check gateway_event_id deduplicated | Return 200 immediately if already processed |
| 9 | WebhookHandler | UPDATE payment.status=completed; store gateway_metadata | Emit PaymentCompletedEvent |
| 10 | SubscriptionService | PaymentCompletedEvent handler: UPDATE subscription status=active, starts_at=now, expires_at=+duration_days, payment_id | Emit SubscriptionActivatedEvent |
| 11 | BullMQ | Enqueue receipt email | |

### Flow 4B — Subscribe via Cash (Manual)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Staff | POST /v1/files/upload (screenshot of cash receipt) | Returns { url } |
| 2 | Staff | POST /v1/payments/manual { payable_type: subscription, payable_id, payment_stage: full, amount, screenshot_url, reference_no } | |
| 3 | PaymentsService | UPDATE payment status=awaiting_verification | Pending admin/staff review |
| 4 | Admin/Staff | PATCH /v1/payments/:id/verify { action: approve } | |
| 5 | PaymentsService | UPDATE payment status=completed; emit PaymentCompletedEvent | Same handler as gateway — activates subscription |
| 6 | Admin/Staff | PATCH /v1/payments/:id/verify { action: reject, rejection_reason } | |
| 7 | PaymentsService | UPDATE payment status=failed | Member notified; must re-initiate |

### Flow 4C — Subscription Expiry Warning CRON

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | BullMQ CRON | subscription-warning: daily 08:00 UTC+8 | |
| 2 | SubscriptionService | SELECT WHERE expires_at BETWEEN now AND now+7d AND status=active AND warned_7d_at IS NULL | UPDATE warned_7d_at=now; UPDATE status=past_due; enqueue 7-day warning email |
| 3 | SubscriptionService | SELECT WHERE expires_at BETWEEN now AND now+3d AND warned_3d_at IS NULL | UPDATE warned_3d_at=now; enqueue 3-day warning email |
| 4 | SubscriptionService | SELECT WHERE expires_at BETWEEN now AND now+1d AND warned_1d_at IS NULL | UPDATE warned_1d_at=now; enqueue 1-day warning email |
| 5 | BullMQ CRON | subscription-expiry: daily 00:00 UTC+8 | |
| 6 | SubscriptionService | SELECT WHERE expires_at < now AND status IN (active, past_due, cancelled) | UPDATE status=expired; emit SubscriptionExpiredEvent |

### Flow 4D — Cancellation

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Member | POST /v1/membership/cancel { reason? } | |
| 2 | SubscriptionService | SELECT WHERE user_id=X AND status IN (active, past_due) | Throw 404 if none |
| 3 | SubscriptionService | UPDATE status=cancelled, cancelled_at=now, cancellation_reason | Guard still allows access until expires_at |
| 4 | SubscriptionService | Emit SubscriptionCancelledEvent | In-app + email; expiry date communicated |

## Subscription Lifecycle

| From | Trigger | → To | Side Effects |
|------|---------|------|--------------|
| — | Subscribe | pending_payment | Payment record created |
| pending_payment | Payment confirmed | active | starts_at + expires_at set; SubscriptionActivatedEvent |
| active | 7d warning CRON | past_due | warned_7d_at; email; access still allowed |
| active/past_due | Expiry CRON | expired | SubscriptionExpiredEvent |
| active/past_due | Member cancels | cancelled | Access until expires_at; SubscriptionCancelledEvent |
| active | Admin suspends | suspended | Immediate revoke |

## Service Functions

```typescript
// SubscriptionService
listPlans(dto: PaginationDTO): Promise<PaginatedResult<MembershipPlan>>
getPlanById(id: string): Promise<MembershipPlan>
createPlan(dto: CreatePlanDTO): Promise<MembershipPlan>
updatePlan(id: string, dto: UpdatePlanDTO): Promise<MembershipPlan>
subscribe(userId: string, dto: CreateSubscriptionDTO, idempotencyKey: string): Promise<{ checkout_url?: string }>
getMySubscription(userId: string): Promise<Subscription>
cancelSubscription(userId: string, dto: CancelSubscriptionDTO): Promise<void>
handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void>
runWarningCron(): Promise<void>
runExpiryCron(): Promise<void>

// PaymentsService
getMyPayments(userId: string, dto: DateRangeDTO): Promise<PaginatedResult<Payment>>
getPaymentById(paymentId: string, requesterId: string, role: UserRole): Promise<Payment>
getAllPayments(dto: PaymentFilterDTO): Promise<PaginatedResult<Payment>>
submitManualPayment(userId: string, dto: ManualPaymentDTO): Promise<Payment>
verifyPayment(paymentId: string, dto: VerifyPaymentDTO, adminId: string): Promise<void>
handleWebhook(rawBody: Buffer, signature: string): Promise<void>
createPaymongoLink(amount: number, description: string): Promise<{ checkout_url: string; provider_ref: string }>
uploadFile(file: Express.Multer.File): Promise<{ url: string }>
```

---