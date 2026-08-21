# FitTrack — S13 — Gym Layout & Analytics
_Always include `00-global-contracts.md` alongside this file._

---

# S13 — Gym Layout & Analytics

## Overview
2D equipment map with live status via WebSocket. Aggregated revenue and attendance analytics by daily, weekly, monthly, and yearly windows across all income sources.

## Prisma Schema

```prisma
// S13 uses GymEquipment for the 2D canvas (machines with positions)
// This is SEPARATE from GymEquipmentItem in S10 (count-only equipment like dumbbells)

model GymEquipment {
  id         String          @id @default(uuid()) @db.Uuid
  name       String          @db.VarChar(255)
  type       String          @db.VarChar(100)
  position_x Decimal         @db.Decimal(8,2)
  position_y Decimal         @db.Decimal(8,2)
  status     EquipmentStatus @default(available)
  icon_key   String?         @db.VarChar(100)
  is_active  Boolean         @default(true)
  created_at DateTime        @default(now()) @db.Timestamptz(6)
  updated_at DateTime        @updatedAt @db.Timestamptz(6)

  @@index([status])
  @@index([is_active])
  @@map("gym_equipment")
}

enum EquipmentStatus { available occupied maintenance }
```

## DTOs

```typescript
class CreateEquipmentDTO {
  name: string                   // @IsString() @IsNotEmpty() @MaxLength(255)
  type: string                   // @IsString() @IsNotEmpty() @MaxLength(100)
  position_x: number             // @IsNumber()
  position_y: number             // @IsNumber()
  icon_key?: string              // @IsOptional() @MaxLength(100)
}

class UpdateEquipmentDTO {
  name?: string
  type?: string
  position_x?: number
  position_y?: number
  status?: EquipmentStatus       // @IsOptional() @IsEnum(EquipmentStatus)
  icon_key?: string
  is_active?: boolean
}

class AnalyticsQueryDTO {
  // All optional — defaults to current month if omitted
  start_date?: string            // @IsOptional() @IsISO8601()
  end_date?: string              // @IsOptional() @IsISO8601()
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly'  // @IsOptional()
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| GET | /v1/gym-layout/equipment | JWT | — | All active equipment with positions |
| POST | /v1/gym-layout/equipment | Admin | CreateEquipmentDTO | Add equipment to map |
| PATCH | /v1/gym-layout/equipment/:id | Admin | UpdateEquipmentDTO | Update; triggers WS broadcast |
| DELETE | /v1/gym-layout/equipment/:id | Admin | — | Soft-delete |
| GET | /v1/analytics/overview | Admin | AnalyticsQueryDTO | Revenue + attendance KPI summary |
| GET | /v1/analytics/revenue | Admin | AnalyticsQueryDTO | Revenue breakdown by source + period |
| GET | /v1/analytics/attendance | Admin | AnalyticsQueryDTO | Check-in trends by period |
| GET | /v1/analytics/members | Admin | AnalyticsQueryDTO | New/active member counts |
| GET | /v1/analytics/coaches | Admin | AnalyticsQueryDTO | Per-coach revenue and earnings breakdown |

## Process Flows

### Flow 13A — Real-Time Equipment Status Update

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin | PATCH /v1/gym-layout/equipment/:id (UpdateEquipmentDTO) | |
| 2 | GymLayoutService | UPDATE gym_equipment SET fields, updated_at=now | |
| 3 | GymLayoutService | HSET Redis equipment_status equipmentId=status | |
| 4 | GymLayoutService | PUBLISH equipment:status { equipmentId, status, updatedAt } | |
| 5 | GymLayoutGateway | Redis subscriber receives PUBLISH | Broadcasts to all /gym-layout WS clients |
| 6 | Clients | Receive delta update | Canvas re-renders equipment icon/color |

### Flow 13B — WS Client Connect (Initial Snapshot)

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Client | Connect WS /gym-layout (JWT validated) | |
| 2 | GymLayoutGateway | HGETALL Redis equipment_status | Full current state |
| 3 | GymLayoutGateway | Emit full snapshot to connecting client | Client renders initial map |
| 4 | Ongoing | Any PATCH → PUBLISH → broadcast delta | No polling needed |

### Analytics Queries

```sql
-- Revenue by source for a period
SELECT
  SUM(CASE WHEN payable_type='subscription' THEN amount ELSE 0 END) as membership_revenue,
  SUM(CASE WHEN payable_type='booking' THEN amount ELSE 0 END)      as booking_revenue,
  SUM(CASE WHEN payable_type='product' THEN amount ELSE 0 END)      as product_revenue,
  SUM(CASE WHEN payable_type='coaching' THEN amount ELSE 0 END)     as coaching_total
FROM payments
WHERE status='completed' AND created_at BETWEEN :start AND :end;

-- Gym coaching cut (actual gym revenue from coaching)
SELECT SUM(gym_revenue) as coaching_gym_revenue FROM coach_appointments
WHERE status='completed' AND completed_at BETWEEN :start AND :end;

-- Coach earnings breakdown
SELECT
  cp.id, up.first_name, up.last_name,
  SUM(ca.total_amount)    as total_billed,
  SUM(ca.gym_revenue)     as gym_cut,
  SUM(ca.coach_earnings)  as coach_payout
FROM coach_appointments ca
JOIN coach_profiles cp ON ca.coach_id=cp.id
JOIN user_profiles up ON cp.user_id=up.user_id
WHERE ca.status='completed' AND ca.completed_at BETWEEN :start AND :end
GROUP BY cp.id, up.first_name, up.last_name;

-- Daily attendance
SELECT DATE(check_in_at) as date, COUNT(*) as check_ins
FROM attendance_logs
WHERE check_in_at BETWEEN :start AND :end
GROUP BY DATE(check_in_at) ORDER BY date;

-- New members
SELECT COUNT(*) FROM users
WHERE role='member' AND created_at BETWEEN :start AND :end;
```

## Redis Keys (S13)

| Key | TTL | Purpose |
|-----|-----|---------|
| equipment_status | — | Hash; field=equipmentId; value=status; snapshot for WS connect |

## Service Functions

```typescript
// GymLayoutService
getAllEquipment(): Promise<GymEquipment[]>
createEquipment(dto: CreateEquipmentDTO): Promise<GymEquipment>
updateEquipment(id: string, dto: UpdateEquipmentDTO): Promise<GymEquipment>
deleteEquipment(id: string): Promise<void>
broadcastStatusUpdate(equipmentId: string, status: EquipmentStatus): Promise<void>

// AnalyticsService
getOverview(dto: AnalyticsQueryDTO): Promise<AnalyticsOverview>
getRevenue(dto: AnalyticsQueryDTO): Promise<RevenueBreakdown>
getAttendanceTrends(dto: AnalyticsQueryDTO): Promise<AttendanceTrend[]>
getMemberStats(dto: AnalyticsQueryDTO): Promise<MemberStats>
getCoachEarnings(dto: AnalyticsQueryDTO): Promise<CoachEarningsSummary[]>

// GymLayoutGateway (WebSocket)
handleConnection(client: Socket): Promise<void>
handleDisconnect(client: Socket): void
```

---