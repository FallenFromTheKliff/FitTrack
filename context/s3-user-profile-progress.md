# FitTrack — S3 — User Profile & Progress
_Always include `00-global-contracts.md` alongside this file._

---

# S3 — User Profile & Progress

## Overview
Personal data, body measurements, QR attendance, and notification preferences. Progress tracking is member-only. All registered users (including walk-ins) have a profile.

## Prisma Schema

```prisma
model UserProfile {
  id             String         @id @default(uuid()) @db.Uuid
  user_id        String         @unique @db.Uuid
  first_name     String         @db.VarChar(100)
  last_name      String         @db.VarChar(100)
  phone          String?        @db.VarChar(20)
  date_of_birth  DateTime?      @db.Date
  gender         Gender?
  weight_kg      Decimal?       @db.Decimal(5,2)
  height_cm      Decimal?       @db.Decimal(5,2)
  activity_level ActivityLevel?
  fitness_goal   FitnessGoal?
  avatar_url     String?        @db.VarChar(500)
  created_at     DateTime       @default(now()) @db.Timestamptz(6)
  updated_at     DateTime       @updatedAt @db.Timestamptz(6)

  user           User           @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@map("user_profiles")
}

enum Gender        { male female other }
enum ActivityLevel { sedentary light moderate active very_active }
enum FitnessGoal   { bulking cutting maintenance sport_specific }

model ProgressMetric {
  id             String   @id @default(uuid()) @db.Uuid
  user_id        String   @db.Uuid
  weight_kg      Decimal? @db.Decimal(5,2)
  height_cm      Decimal? @db.Decimal(5,2)
  body_fat_pct   Decimal? @db.Decimal(4,2)
  muscle_mass_kg Decimal? @db.Decimal(5,2)
  waist_cm       Decimal? @db.Decimal(5,2)
  chest_cm       Decimal? @db.Decimal(5,2)
  notes          String?
  recorded_at    DateTime @db.Timestamptz(6)
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)

  user           User     @relation(fields: [user_id], references: [id])

  @@index([user_id, recorded_at(sort: Desc)])
  @@map("progress_metrics")
}

model NotificationPreference {
  id                          String   @id @default(uuid()) @db.Uuid
  user_id                     String   @unique @db.Uuid
  subscription_expiring_email Boolean  @default(true)
  subscription_expiring_sms   Boolean  @default(false)
  booking_confirmed_email     Boolean  @default(true)
  booking_confirmed_sms       Boolean  @default(false)
  appointment_confirmed_email Boolean  @default(true)
  appointment_confirmed_sms   Boolean  @default(false)
  rank_up_email               Boolean  @default(true)
  payment_confirmed_email     Boolean  @default(true)
  system_email                Boolean  @default(true)
  created_at                  DateTime @default(now()) @db.Timestamptz(6)
  updated_at                  DateTime @updatedAt @db.Timestamptz(6)

  user                        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@map("notification_preferences")
}

model AttendanceLog {
  id           String    @id @default(uuid()) @db.Uuid
  user_id      String    @db.Uuid
  scanned_by   String?   @db.Uuid
  check_in_at  DateTime  @db.Timestamptz(6)
  check_out_at DateTime? @db.Timestamptz(6)
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  updated_at   DateTime  @updatedAt @db.Timestamptz(6)

  user         User      @relation("attendee", fields: [user_id], references: [id])
  scanner      User?     @relation("scanner", fields: [scanned_by], references: [id])

  @@index([user_id, check_in_at(sort: Desc)])
  @@index([check_in_at])
  @@map("attendance_logs")
}
```

## DTOs

```typescript
class UpdateProfileDTO {
  first_name?: string      // @IsOptional() @IsString() @MaxLength(100)
  last_name?: string       // @IsOptional() @IsString() @MaxLength(100)
  date_of_birth?: string   // @IsOptional() @IsISO8601()
  gender?: Gender          // @IsOptional() @IsEnum(Gender)
  weight_kg?: number       // @IsOptional() @IsPositive() @Max(500)
  height_cm?: number       // @IsOptional() @IsPositive() @Max(300)
  activity_level?: ActivityLevel // @IsOptional() @IsEnum(ActivityLevel)
  fitness_goal?: FitnessGoal     // @IsOptional() @IsEnum(FitnessGoal)
}

class UpdatePhoneDTO {
  phone_number: string     // @IsMobilePhone("ph")
}

class LogProgressDTO {
  // At least one measurement field required (service-level check)
  weight_kg?: number       // @IsOptional() @IsPositive()
  height_cm?: number       // @IsOptional() @IsPositive()
  body_fat_pct?: number    // @IsOptional() @Min(0) @Max(60)
  muscle_mass_kg?: number  // @IsOptional() @IsPositive()
  waist_cm?: number        // @IsOptional() @IsPositive()
  chest_cm?: number        // @IsOptional() @IsPositive()
  notes?: string           // @IsOptional() @MaxLength(1000)
  recorded_at?: string     // @IsOptional() @IsISO8601()
}

class UserFilterDTO extends PaginationDTO {
  role?: UserRole          // @IsOptional() @IsEnum(UserRole)
  status?: UserStatus      // @IsOptional() @IsEnum(UserStatus)
  search?: string          // @IsOptional() — searches name + email
}

class UpdateUserStatusDTO {
  status: 'active' | 'suspended' | 'banned'  // @IsIn(["active","suspended","banned"])
  reason?: string          // @IsOptional() @MaxLength(500)
}

class ScanQrDTO {
  qr_code_token: string    // @IsString() @IsNotEmpty()
}

class UpdateNotificationPrefsDTO {
  subscription_expiring_email?: boolean
  subscription_expiring_sms?: boolean
  booking_confirmed_email?: boolean
  booking_confirmed_sms?: boolean
  appointment_confirmed_email?: boolean
  appointment_confirmed_sms?: boolean
  rank_up_email?: boolean
  payment_confirmed_email?: boolean
  system_email?: boolean
  // All @IsOptional() @IsBoolean()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/users/me | JWT | — | Own profile |
| PATCH | /v1/users/me | JWT | UpdateProfileDTO | Update own profile |
| PATCH | /v1/users/me/avatar | JWT | multipart/form-data | Upload avatar to R2 |
| PATCH | /v1/users/me/phone | JWT | UpdatePhoneDTO | Update phone → sends SMS OTP |
| POST | /v1/users/me/progress | JWT (member only) | LogProgressDTO | Append body measurement |
| GET | /v1/users/me/progress | JWT (member only) | DateRangeDTO | Own progress history |
| GET | /v1/users/me/attendance | JWT | DateRangeDTO | Own attendance history |
| POST | /v1/users/me/refresh-qr | JWT | — | Manually regenerate QR token |
| GET | /v1/users | Admin/Staff | UserFilterDTO | All users paginated |
| GET | /v1/users/:id | Admin/Staff | — | Single user full profile |
| PATCH | /v1/users/:id | Admin/Staff | UpdateProfileDTO | Edit any profile |
| PATCH | /v1/users/:id/status | Admin | UpdateUserStatusDTO | Activate/suspend/ban |
| GET | /v1/notifications/preferences | JWT | — | Own notification prefs |
| PATCH | /v1/notifications/preferences | JWT | UpdateNotificationPrefsDTO | Update prefs |
| POST | /v1/attendance/scan | Staff | ScanQrDTO | QR check-in |
| PATCH | /v1/attendance/:id/checkout | Staff | — | Set check_out_at |
| GET | /v1/attendance | Admin/Staff | AttendanceFilterDTO | All attendance logs |

## Process Flows

### Flow 3A — QR Attendance Scan

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Staff/Kiosk | POST /v1/attendance/scan { qr_code_token } | scanned_by=null if kiosk |
| 2 | AttendanceService | SELECT users WHERE qr_code_token=X AND status=active | Throw 404 if invalid or inactive |
| 3 | AttendanceService | If role=member: verify subscription WHERE status IN (active, past_due) OR (cancelled AND expires_at > now) | Throw 403 SUBSCRIPTION_REQUIRED; coaches and staff bypass |
| 4 | AttendanceService | Check no open check-in today: attendance_logs WHERE user_id=X AND check_in_at::DATE=today AND check_out_at IS NULL | Throw 409 ALREADY_CHECKED_IN |
| 5 | AttendanceService | INSERT attendance_logs { user_id, scanned_by, check_in_at=now } | |
| 6 | AttendanceService | Return 201 { attendance_id, member_name, check_in_at } | |

## Service Functions

```typescript
// UsersService
getMyProfile(userId: string): Promise<UserWithProfile>
updateMyProfile(userId: string, dto: UpdateProfileDTO): Promise<UserProfile>
uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ avatar_url: string }>
updatePhone(userId: string, dto: UpdatePhoneDTO): Promise<void>
logProgress(userId: string, dto: LogProgressDTO): Promise<ProgressMetric>
getProgressHistory(userId: string, dto: DateRangeDTO): Promise<ProgressMetric[]>
getMyAttendance(userId: string, dto: DateRangeDTO): Promise<PaginatedResult<AttendanceLog>>
refreshQrToken(userId: string): Promise<{ qr_code_token: string }>
getAllUsers(dto: UserFilterDTO): Promise<PaginatedResult<UserWithProfile>>
getUserById(id: string): Promise<UserWithProfile>
adminUpdateUser(id: string, dto: UpdateProfileDTO): Promise<UserProfile>
updateUserStatus(id: string, dto: UpdateUserStatusDTO): Promise<void>
getNotificationPrefs(userId: string): Promise<NotificationPreference>
updateNotificationPrefs(userId: string, dto: UpdateNotificationPrefsDTO): Promise<NotificationPreference>

// AttendanceService
scanQr(scannerUserId: string | null, dto: ScanQrDTO): Promise<AttendanceLog>
checkout(attendanceId: string): Promise<AttendanceLog>
getAttendanceLogs(dto: AttendanceFilterDTO): Promise<PaginatedResult<AttendanceLog>>
```

---