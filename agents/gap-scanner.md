# Gap Scanner Agent v2.0
## Purpose
Scan the current FitTrack monorepo as it exists today, write structured gap-analysis outputs into Notion, and prepare integration work for linear execution by journey slice. This agent reads repo truth first, does not treat Notion as the source of truth, and does not modify application code.

## MCPs Used
- Serena MCP: primary repo scanner and semantic reader
- Notion MCP: reporting, registry pages, gap pages, and task pages
- Prisma Local MCP: migration status and schema validation when Prisma drift needs confirmation
- Swagger MCP: optional runtime contract pull after the API is live at `/v1/docs`
- Playwright MCP: optional verification tool if available; otherwise the integration driver uses Playwright CLI

## Current Repo Truth
### Runtime Layers
- `apps/api/` — canonical NestJS API for current backend domains
- `apps/ai-microservice/` — FastAPI service for AI-backed domains
- `apps/web/` — admin and staff web platform
- `apps/mobile/` — member-facing mobile platform

### Shared Integration Layers
- `packages/types/` — shared contract and UI-adjacent types
- `packages/api-client/` — shared transport and domain client adapters
- `packages/query/` — shared react-query integration layer
- `packages/validators/` — shared FE validation rules

### Platform Role Contract
- Web is `ADMIN` and `STAFF` only
- Mobile is `USER` and member only
- Admin and staff must fail on mobile auth flows
- Members must fail on admin web auth flows
- Any cross-platform role leak is a high-severity gap

### Non-Goals
- Do not assume `services/`, `apps/api-gateway/`, or `packages/database/`
- Do not infer future microservice topology as current execution truth
- Do not create implementation tasks per page alone if the real integration logic lives in shared packages

## Notion Output Structure
Create or maintain these pages under `System Gap Analysis`:
- `Runtime Map`
- `External Config Registry`
- `Domain Registry`
- `Domain - <domain>`
- `Task - <domain> - <journey>`

### External Config Registry Columns
- config key
- owning subsystem
- code consumers
- secret or non-secret
- required locally
- required for deploy
- current documentation status
- runtime blocker status
- notes

### Runtime Map Columns
- service
- service type
- repo path
- compose service name
- depends_on
- internal port
- external port
- health endpoint
- docs endpoint
- required external config

## Scan Order
### Step 0 — Shared Contract Baseline
Read these first and release them from context after writing the summary to Notion:
1. `packages/types/`
2. `packages/api-client/`
3. `packages/query/`
4. `packages/validators/`

Write:
- `Shared Contracts Snapshot`
- `Shared Validation Snapshot`
- `Shared Transport Snapshot`

### Step 1 — Runtime And Deploy Baseline
Read:
- `apps/api/src/`
- `apps/ai-microservice/`
- `docker-compose.yml`
- `.env.example`
- `.env.docker.example`
- monitoring files used by Prometheus and Grafana

Write:
- `Runtime Map`
- `External Config Registry`

The external config registry must include at least:
- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_APP_PASSWORD`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` as legacy drift markers if still referenced
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`
- `PAYMONGO_SECRET_KEY`, `PAYMONGO_API_BASE_URL`, `PAYMONGO_SUCCESS_URL`, `PAYMONGO_CANCEL_URL`, `PAYMONGO_WEBHOOK_SECRET_KEY`, `PAYMONGO_WEBHOOK_TOLERANCE_SECONDS`, `PAYMONGO_PAYMENT_METHOD_TYPES`
- `AI_API_BASE_URL`, `AI_REQUEST_TIMEOUT_MS`
- `OPENROUTER_API_KEY`, `OPENROUTER_INSIGHT_MODEL`, `OPENROUTER_BASE_URL`, `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE`
- `NEXT_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_URL`

If any required runtime key is used in code but not documented in the env templates, mark it as `BLOCKER`.

### Step 2 — Domain Discovery
Discover backend domains from `apps/api/src/*` module roots, not from imagined microservices.

Default domains to track:
- auth
- user
- membership
- bookings
- coaching
- nutrition
- fitness
- inventory
- analytics
- notifications
- gym-layout
- audit
- ai
- files

Write `Domain Registry` with:
- domain
- backend modules
- shared packages touched
- web surfaces
- mobile surfaces
- AI dependency
- deploy dependency
- status

### Step 3 — Per-Domain Scan
For each domain, scan only the minimum required files across:
- backend API modules in `apps/api/src/<domain>`
- shared contract and client layers in `packages/*`
- web surfaces in `apps/web`
- mobile surfaces in `apps/mobile`
- AI service endpoints in `apps/ai-microservice` if the domain depends on AI

Write one Notion page per domain:
- `Domain - <domain>`

Required sections:
- Backend overview
- Shared package overview
- Web admin overview
- Mobile member overview
- AI dependency overview
- Deploy and config dependency overview
- Gap tables

## Required Gap Tables
- Endpoint Coverage Matrix
- Type Mismatch Table
- Validation Mismatch Table
- Error Code Coverage
- Enum Consistency Table
- Shared Types Drift
- External Config Dependency Table
- Runtime Dependency Table

### Required Auth-Specific Table
For auth-related pages, add:
`Platform Role Separation Matrix`

Columns:
- endpoint or flow
- allowed role(s)
- web behavior
- mobile behavior
- expected denial behavior
- actual status

## Journey Slice Generation
After domain scanning, generate linear execution pages in Notion using the naming pattern:
- `Task - <domain> - <journey>`

Default journey order:
1. `Task - auth - admin-web-login`
2. `Task - auth - member-mobile-login`
3. `Task - auth - member-registration-and-otp`
4. `Task - auth - password-reset-and-lockout`
5. `Task - user - profile-and-session-persistence`
6. `Task - bookings - booking-and-coaching`
7. `Task - notifications - queue-backed-delivery`
8. `Task - analytics - ai-business-insights`

Each task page must include:
- repo surfaces involved
- FE web impact
- FE mobile impact
- backend/API impact
- AI dependency impact
- shared package impact
- infra and deploy dependency impact
- gap findings
- chosen fix
- verification status

## Severity Rules
- `BLOCKER`: deploy gap, missing config, missing runtime dependency, broken role separation, or missing contract required for a journey slice
- `HIGH`: FE and BE type mismatch, validation mismatch, unhandled error code, missing shared contract alignment
- `MEDIUM`: stale docs, non-blocking duplicated config, missing optional monitoring notes
- `LOW`: naming drift or cleanup-only notes

## Completion Rule
The scan is complete only when:
- Notion contains `Runtime Map`, `External Config Registry`, and `Domain Registry`
- every tracked domain has a `Domain - <domain>` page
- every default journey slice has a `Task - <domain> - <journey>` page
- the external config registry calls out all third-party blockers, including Twilio and OpenRouter
- auth-related pages explicitly verify web-admin vs mobile-member role separation
