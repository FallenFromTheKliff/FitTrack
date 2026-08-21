# FitTrack - S17 - Business Analytics
_Always include `../00-global-contracts.md` and `00-python-microservice-contracts.md` alongside this file._

---

# S17 - Business Analytics

## Overview
AI-assisted business analytics insight generation for operators and admins. This domain is separate from `S13` and does not own raw KPI computation, SQL aggregation, or dashboard data retrieval. Nest continues to compute analytics from PostgreSQL. Python receives the already-assembled analytics payload and returns narrative summaries, anomaly hints, risks, opportunities, and recommended actions. The Python insight layer uses OpenRouter as the default external model gateway.

This domain is intentionally insight-oriented, not BI-platform sized.

## Backend Persistence Schema

```prisma
model BusinessInsightRun {
  id               String        @id @default(uuid()) @db.Uuid
  requested_by     String?       @db.Uuid
  focus            InsightFocus
  period           InsightPeriod
  start_date       DateTime      @db.Date
  end_date         DateTime      @db.Date
  request_payload  Json
  insight_payload  Json
  model_used       String?       @db.VarChar(100)
  token_count      Int?
  latency_ms       Int?
  created_at       DateTime      @default(now()) @db.Timestamptz(6)
  updated_at       DateTime      @updatedAt @db.Timestamptz(6)

  requester User? @relation(fields: [requested_by], references: [id], onDelete: SetNull)

  @@index([created_at(sort: Desc)])
  @@index([requested_by, created_at(sort: Desc)])
  @@map("business_insight_runs")
}

enum InsightFocus {
  overview
  revenue
  attendance
  membership
  coaching
  inventory
}

enum InsightPeriod {
  daily
  weekly
  monthly
  yearly
  custom
}
```

## DTOs

```typescript
class GenerateBusinessInsightDTO {
  start_date?: string          // @IsOptional() @IsISO8601()
  end_date?: string            // @IsOptional() @IsISO8601()
  period?: InsightPeriod       // @IsOptional() @IsEnum(InsightPeriod)
  focus?: InsightFocus         // @IsOptional() @IsEnum(InsightFocus)
}

class BusinessInsightFilterDTO extends PaginationDTO {
  focus?: InsightFocus         // @IsOptional() @IsEnum(InsightFocus)
  period?: InsightPeriod       // @IsOptional() @IsEnum(InsightPeriod)
}
```

## API Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| POST | /v1/business-analytics/insights | Admin | GenerateBusinessInsightDTO | Generate AI business insight from backend KPI payloads |
| GET | /v1/business-analytics/insights | Admin | BusinessInsightFilterDTO | Insight run history |
| GET | /v1/business-analytics/insights/:id | Admin | - | Single insight run |

## Grounding Input Payload

```typescript
interface BusinessAnalyticsGroundingPayload {
  window: {
    start_date: string
    end_date: string
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
    focus: 'overview' | 'revenue' | 'attendance' | 'membership' | 'coaching' | 'inventory'
  }
  overview: {
    total_revenue: string
    total_check_ins: number
    new_members: number
    completed_coaching_sessions: number
  }
  revenue: {
    totals: Record<string, string>
    series: Array<Record<string, string | number>>
  }
  attendance: {
    series: Array<{ bucket_start: string; check_ins: number }>
    peak_hours: Array<{ hour_label: string; check_ins: number }>
  }
  membership: {
    new_members: number
    active_members: number
    top_plans: Array<{ name: string; subscriber_count: number; revenue: string }>
  }
  coaching: {
    coaches: Array<{
      coach_id: string
      first_name?: string | null
      last_name?: string | null
      total_billed: string
      gym_cut: string
      coach_payout: string
      completed_sessions: number
    }>
  }
  inventory?: {
    top_products: Array<{ name: string; quantity_sold: number; revenue: string }>
  }
}
```

## Python Service Contracts

```text
GET /health
  Output: 200 { status: "ok" }

POST /analytics/insights
  Input:  {
            grounding: BusinessAnalyticsGroundingPayload
          }
  Output: {
            summary: string,
            highlights: string[],
            risks: string[],
            opportunities: string[],
            anomaly_flags: string[],
            recommended_actions: string[],
            model_used: string | null,
            token_count: number | null
          }
```

### OpenRouter Usage

- Default provider is OpenRouter.ai.
- Prefer models with strong structured-output reliability over the fastest possible latency.
- Request strict JSON schema output for all insight responses.
- Keep direct-provider adapters possible later without changing the route contract.

## Process Flow

### Flow 17A - Generate Business Insight

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin | POST `/v1/business-analytics/insights` | Select date window and optional focus |
| 2 | BusinessAnalyticsInsightService | Query existing Nest analytics services and repositories | Build KPI payload without changing `S13` behavior |
| 3 | BusinessAnalyticsInsightService | POST `/analytics/insights` | Send grounded analytics payload to Python |
| 4 | Python | Generate narrative insight via OpenRouter | Summaries, risks, opportunities, anomalies, and actions |
| 5 | BusinessAnalyticsInsightService | INSERT `business_insight_runs` | Persist request, response, model info, and latency |
| 6 | BusinessAnalyticsInsightService | Return insight response | Public response wrapped by Nest |

### Flow 17B - Retrieve Insight History

| # | Actor | Action | Detail |
|---|-------|--------|--------|
| 1 | Admin | GET `/v1/business-analytics/insights` | Filter historical runs |
| 2 | BusinessAnalyticsInsightService | SELECT `business_insight_runs` | Paginated history |
| 3 | Admin | GET `/v1/business-analytics/insights/:id` | Fetch one prior run |
| 4 | BusinessAnalyticsInsightService | Return stored insight payload | No Python call required |

## Service Functions

```typescript
// Nest BusinessAnalyticsInsightService
generateInsight(actorId: string, dto: GenerateBusinessInsightDTO): Promise<BusinessInsightResponse>
getInsightHistory(dto: BusinessInsightFilterDTO): Promise<PaginatedResult<BusinessInsightRun>>
getInsightById(id: string): Promise<BusinessInsightRun>
buildGroundingPayload(dto: GenerateBusinessInsightDTO): Promise<BusinessAnalyticsGroundingPayload>

// Python BusinessInsightService
generate_insight(input: BusinessAnalyticsInsightRequest) -> BusinessAnalyticsInsightResponse
detect_anomalies(grounding: BusinessAnalyticsGroundingPayload) -> string[]
build_openrouter_insight_request(input: BusinessAnalyticsInsightRequest) -> dict
```
