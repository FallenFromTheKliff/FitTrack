# FitTrack - S2 - Auth & Identity
_Always include `00-global-contracts.md` alongside this file._

---

# S2 - Auth & Identity

## Overview
Every person using the system must have an account - members, walk-ins, coaches, staff, and admins. Having an account does not imply an active membership. Admin creates accounts for staff, coaches, and other admins. Customers (members and walk-ins) self-register.

## Prisma Schema

```prisma
model User {
  id                String     @id @default(uuid()) @db.Uuid
  role              UserRole
  status            UserStatus @default(pending)
  email_verified_at DateTime?  @db.Timestamptz(6)
  phone_verified_at DateTime?  @db.Timestamptz(6)
  qr_code_token     String?    @unique @db.VarChar(64)
  created_at        DateTime   @default(now()) @db.Timestamptz(6)
  updated_at        DateTime   @updatedAt @db.Timestamptz(6)

  auth_identities       AuthIdentity[]
  refresh_tokens        RefreshToken[]
  otp_verifications     OtpVerification[]
  profile               UserProfile?
  notification_prefs    NotificationPreference?
  progress_metrics      ProgressMetric[]
  attendance_logs       AttendanceLog[]         @relation("attendee")
  scanned_attendance    AttendanceLog[]         @relation("scanner")
  subscriptions         Subscription[]
  payments              Payment[]
  amenity_bookings      AmenityBooking[]
  coach_profile         CoachProfile?
  member_appointments   CoachAppointment[]      @relation("member")
  coach_reviews         CoachReview[]
  client_relationships  CoachClientRelationship[] @relation("member_rel")
  training_plans        TrainingPlan[]
  workout_sessions      WorkoutSession[]
  pose_sessions         PoseSession[]
  tdee_profiles         TdeeProfile[]
  macro_targets         MacroTarget[]
  nutrition_logs        NutritionLog[]
  sale_transactions_processed SaleTransaction[] @relation("processed_by")
  equipment_writeoffs   EquipmentWriteOff[]
  ai_chat_sessions      AiChatSession[]
  ai_interaction_logs   AiInteractionLog[]
  notifications         Notification[]
  audit_logs            AuditLog[]

  @@index([status])
  @@index([role])
  @@map("users")
}

enum UserRole   { admin staff member coach }
enum UserStatus { pending active suspended banned }

model AuthIdentity {
  id               String       @id @default(uuid()) @db.Uuid
  user_id          String       @db.Uuid
  provider         AuthProvider
  identifier       String       @db.VarChar(255)
  credential_hash  String?      @db.VarChar(255)
  provider_user_id String?      @db.VarChar(255)
  is_primary       Boolean      @default(false)
  verified_at      DateTime?    @db.Timestamptz(6)
  created_at       DateTime     @default(now()) @db.Timestamptz(6)
  updated_at       DateTime     @updatedAt @db.Timestamptz(6)

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, provider, identifier])
  @@index([provider, identifier])
  @@map("auth_identities")
}

enum AuthProvider {
  email
  phone
  google
}

model RefreshToken {
  id           String        @id @default(uuid()) @db.Uuid
  user_id      String        @db.Uuid
  token_hash   String        @unique @db.VarChar(255)
  device_info  String?       @db.VarChar(255)
  ip_address   String?       @db.VarChar(45)
  expires_at   DateTime      @db.Timestamptz(6)
  revoked_at   DateTime?     @db.Timestamptz(6)
  rotated_from String?       @db.Uuid
  created_at   DateTime      @default(now()) @db.Timestamptz(6)
  updated_at   DateTime      @updatedAt @db.Timestamptz(6)

  user         User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  parent       RefreshToken? @relation("TokenRotation", fields: [rotated_from], references: [id])
  children     RefreshToken[] @relation("TokenRotation")

  @@index([user_id])
  @@index([expires_at])
  @@map("refresh_tokens")
}

model OtpVerification {
  id           String     @id @default(uuid()) @db.Uuid
  user_id      String     @db.Uuid
  channel      OtpChannel
  purpose      OtpPurpose
  code_hash    String     @db.VarChar(255)
  expires_at   DateTime   @db.Timestamptz(6)
  attempts     Int        @default(0) @db.SmallInt
  locked_until DateTime?  @db.Timestamptz(6)
  consumed_at  DateTime?  @db.Timestamptz(6)
  created_at   DateTime   @default(now()) @db.Timestamptz(6)
  updated_at   DateTime   @updatedAt @db.Timestamptz(6)

  user         User       @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, purpose])
  @@index([expires_at])
  @@map("otp_verifications")
}

enum OtpChannel { email sms }
enum OtpPurpose { registration login_2fa password_reset phone_verify }
```

## DTOs

```typescript
class RegisterDTO {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
}

class VerifyEmailDTO {
  user_id: string
  code: string
}

class LoginDTO {
  email: string
  password: string
}

class VerifyPhoneDTO {
  code: string
}

class ForgotPasswordDTO {
  email: string
}

class ResetPasswordDTO {
  email: string
  code: string
  new_password: string
}

class AdminCreateUserDTO {
  email: string
  password: string
  first_name: string
  last_name: string
  role: 'admin' | 'staff' | 'coach'
  phone?: string
}

interface TokenPairResponse {
  access_token: string
  user: {
    id: string
    role: UserRole
    status: UserStatus
    email_verified_at: string | null
    profile: { first_name: string; last_name: string; avatar_url: string | null }
  }
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| POST | /v1/auth/register | Public | RegisterDTO | Self-register; sends email OTP |
| POST | /v1/auth/verify-email | Public | VerifyEmailDTO | Verify OTP; activates account |
| POST | /v1/auth/login | Public | LoginDTO | Credentials -> token pair |
| POST | /v1/auth/refresh | Cookie | - | Rotate refresh token |
| POST | /v1/auth/logout | JWT | - | Revoke tokens; clear cookie |
| POST | /v1/auth/forgot-password | Public | ForgotPasswordDTO | Send reset OTP |
| POST | /v1/auth/reset-password | Public | ResetPasswordDTO | Verify OTP; update password |
| POST | /v1/auth/send-phone-otp | JWT | - | Send SMS OTP for phone verify |
| POST | /v1/auth/verify-phone | JWT | VerifyPhoneDTO | Confirm phone ownership |
| POST | /v1/admin/users | Admin | AdminCreateUserDTO | Create staff/coach/admin account |

## Process Flows

### Flow 2A - Customer Self-Registration

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | POST /v1/auth/register | email, password, first_name, last_name, optional phone |
| 2 | AuthService | Check UNIQUE auth_identities WHERE provider=email AND identifier=email | Throw 409 CONFLICT if taken |
| 3 | AuthService | INSERT users (status=pending); INSERT user_profiles (first_name, last_name, phone); INSERT notification_preferences (all defaults) | Transactional - all three or none |
| 4 | AuthService | INSERT auth_identities (provider=email, credential_hash=bcrypt(password,12)) | |
| 5 | AuthService | Generate 6-digit OTP; INSERT otp_verifications (purpose=registration, expires_at=+5min) | Check locked_until before generating |
| 6 | BullMQ | Enqueue send-email job with OTP | |
| 7 | AuthService | Return 201 { user_id } | No token yet |
| 8 | Client | POST /v1/auth/verify-email { user_id, code } | |
| 9 | AuthService | Check locked_until on otp_verifications | Throw 423 OTP_LOCKED if locked |
| 10 | AuthService | bcrypt.compare(code, code_hash); check expires_at; increment attempts | If attempts >= 3: SET locked_until=+15min; throw 423 |
| 11 | AuthService | Mark consumed_at=now | Single-use |
| 12 | AuthService | UPDATE users SET status=active, email_verified_at=now; generate qr_code_token | |
| 13 | AuthService | Issue token pair (JWT + HttpOnly refresh cookie); return TokenPairResponse | Account active; user logged in |

### Flow 2B - Admin Creates Staff / Coach / Admin Account

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin | POST /v1/admin/users (AdminCreateUserDTO) | |
| 2 | AuthService | Check email unique in auth_identities | Throw 409 if taken |
| 3 | AuthService | INSERT users (status=active, role from DTO); INSERT user_profiles; INSERT notification_preferences | No OTP - admin-created accounts are immediately active |
| 4 | AuthService | INSERT auth_identities (provider=email, credential_hash=bcrypt(password,12)) | |
| 5 | AuthService | If role=coach: INSERT coach_profile (empty - coach fills it after first login) | |
| 6 | AuthService | Return 201 { user_id, email, role } | Admin shares credentials with the new user |

### Flow 2C - Login

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | POST /v1/auth/login { email, password } | |
| 2 | AuthService | SELECT auth_identities WHERE provider=email AND identifier=email | Throw 401 INVALID_CREDENTIALS if not found |
| 3 | AuthService | SELECT users WHERE id=auth_identity.user_id | |
| 4 | AuthService | Check status=active | Throw 403 ACCOUNT_SUSPENDED if suspended or banned |
| 5 | AuthService | bcrypt.compare(password, credential_hash) | Throw 401 INVALID_CREDENTIALS if mismatch |
| 6 | AuthService | Sign JWT { sub, role, status, jti } HS256 TTL=15min | Project decision: HS256 with JWT_SECRET |
| 7 | AuthService | Generate UUID refresh token; SHA-256 hash; INSERT refresh_tokens (expires_at=+7d) | |
| 8 | AuthService | Return TokenPairResponse; set refresh token in HttpOnly Secure SameSite=Strict cookie | |

### Flow 2D - Logout

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | POST /v1/auth/logout | JWT in header; refresh cookie auto-sent |
| 2 | AuthService | SET Redis token_blacklist:{jti}=1 TTL=900s | All subsequent requests with this JTI rejected by middleware |
| 3 | AuthService | SHA-256 hash cookie; SELECT refresh_tokens; UPDATE revoked_at=now | Silent success if token already revoked |
| 4 | AuthService | Return 200; set Set-Cookie Max-Age=0 | Cookie cleared client-side |

### Flow 2E - Refresh Token

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | POST /v1/auth/refresh | Cookie auto-sent |
| 2 | AuthService | SHA-256 hash cookie; SELECT refresh_tokens WHERE token_hash=X | Throw 401 if not found |
| 3 | AuthService | Check revoked_at IS NULL AND expires_at > now | Throw 401 on failure |
| 4 | AuthService | UPDATE old token revoked_at=now; INSERT new refresh_tokens (rotated_from=old.id) | Rotation - reuse of revoked token throws 401 |
| 5 | AuthService | Re-issue JWT with fresh status from DB; return TokenPairResponse | Status re-read from DB on each refresh to catch suspension |

### Flow 2F - Password Reset

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | POST /v1/auth/forgot-password { email } | |
| 2 | AuthService | Lookup user via email | Return 200 always - enumeration-safe |
| 3 | AuthService | Generate OTP; INSERT otp_verifications (purpose=password_reset); enqueue email | |
| 4 | Client | POST /v1/auth/reset-password { email, code, new_password } | |
| 5 | AuthService | Validate OTP (same attempt/lock logic) | |
| 6 | AuthService | UPDATE credential_hash=bcrypt(new_password,12) | |
| 7 | AuthService | Revoke ALL refresh_tokens for user | Force re-login on all devices |
| 8 | AuthService | Return 200 | |

## Service Functions

```typescript
register(dto: RegisterDTO): Promise<{ user_id: string }>
verifyEmail(dto: VerifyEmailDTO): Promise<TokenPairResponse>
login(dto: LoginDTO, deviceInfo: string, ip: string): Promise<TokenPairResponse>
refresh(rawCookieToken: string): Promise<TokenPairResponse>
logout(jti: string, rawCookieToken: string): Promise<void>
forgotPassword(dto: ForgotPasswordDTO): Promise<void>
resetPassword(dto: ResetPasswordDTO): Promise<void>
sendPhoneOtp(userId: string): Promise<void>
verifyPhone(userId: string, dto: VerifyPhoneDTO): Promise<void>
adminCreateUser(dto: AdminCreateUserDTO): Promise<{ user_id: string }>
issueTokenPair(user: User): Promise<TokenPairResponse>
```

Note: The original RS256 wording in earlier drafts has been superseded by the project choice to use HS256.
