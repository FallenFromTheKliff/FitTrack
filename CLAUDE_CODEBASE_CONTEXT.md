# FitTrack Codebase Context for Claude

Generated: 2026-05-11  
Workspace: `C:\FitTrack`  
Current branch when generated: `origin/temporary-master-branch`  
Last observed commit: `e9d046d Merge branch 'origin/temporary-master-branch' of https://github.com/FallenFromTheKliff/FitTrack into origin/temporary-master-branch`

This file is a practical handoff for working inside the FitTrack repo. It is intentionally written as a map, not a full code dump. Before editing, inspect the current files because this repo moves quickly and the working tree may already contain user changes.

## Product Summary

FitTrack is a gym management system for SertFit Gym. It has:

- a member-facing mobile app built with Expo and Expo Router
- an admin/staff/coach web portal built with Next.js App Router
- a NestJS REST API backed by PostgreSQL, Prisma, Redis, queues, events, Swagger, and WebSockets
- a Python FastAPI AI microservice for chat, pose, nutrition, equipment detection, exercise draft proposals, and business insights
- shared TypeScript packages for API clients, TanStack Query options, types, validators, UI tokens, hooks, utilities, and cross-surface controllers

The monorepo is Turborepo plus pnpm workspaces:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Top-Level Layout

Important paths:

- `apps/api` - NestJS API, Prisma schema, migrations, seeds, Swagger contract, queues, auth, domain services.
- `apps/web` - Next.js 16 web portal on port `8080`.
- `apps/mobile` - Expo 55 mobile app, Expo Router, native/web capable.
- `apps/ai-microservice` - Python FastAPI service on port `8000` locally when included.
- `packages/api-client` - domain API wrappers around Axios transport.
- `packages/query` - TanStack Query options, cache invalidation helpers, query keys.
- `packages/app-core` - shared controllers/transforms for auth, members, schedule, theme, bookings.
- `packages/types` - shared DTO-facing and UI/domain types.
- `packages/validators` - shared zod validators.
- `packages/ui` - shared tokens, themes, style constants.
- `packages/hooks`, `packages/utils`, `packages/app-config` - shared hooks, helpers, config.
- `context` - older but useful domain contract docs.
- `tasks/backend-builder` - domain implementation task history and decisions.
- `tasks/integration-builder` - stack supervisor and integration workflow docs.
- `.codex/skills` - repo-specific engineering playbooks. Useful for conventions.
- `.ai-frontend` - frontend goal mode and guardrails. It currently has local modifications.

Do not treat starter READMEs as authoritative when they conflict with source. Some `README.md` files are still template text.

## Current Working Tree Notes

At generation time, `git status --short` showed:

```text
 M .ai-frontend/agent.md
 M .ai-frontend/config.json
 M .ai-frontend/goals-mode.md
 M .vscode/mcp.json
 M apps/api/prisma/migrations/migration_lock.toml
?? .codex/skills/goals/
?? apps/api/prisma/migrations/20260511135613_sync_branch_schema/
```

The new migration was created during a schema sync after a branch pull:

- `apps/api/prisma/migrations/20260511135613_sync_branch_schema/migration.sql`

It changes:

- `coach_profiles.user_id` foreign key to `ON DELETE SET NULL`
- drops defaults from `muscle_definitions.id` and `muscle_definitions.updated_at`
- drops defaults from `recurring_coaching_billing_cycles.id` and `recurring_coaching_billing_cycles.updated_at`
- renames the recurring coaching billing cycle unique index

`migration_lock.toml` showed modified with no content diff, likely line-ending metadata from Prisma on Windows.

## Runtime And Commands

Run commands from repo root unless noted.

Common commands:

```bash
pnpm dev
pnpm dev:web
pnpm dev:mobile
pnpm dev:api
pnpm dev:stack
pnpm dev:stack:ai
pnpm dev:stack:web
pnpm dev:stack:web:ai
pnpm dev:stack:status
pnpm dev:stack:stop
pnpm build
pnpm lint
pnpm typecheck
```

Database commands:

```bash
pnpm infra:up
pnpm infra:down
pnpm db:ensure-local
pnpm db:generate
pnpm db:migrate
pnpm db:bootstrap
pnpm db:seed
pnpm db:seed:realistic
pnpm db:seed:test
pnpm db:seed:test:additive
pnpm db:seed:test:report
pnpm db:studio
```

Local infra:

- Postgres container: `fittrack-db-local`
- Postgres URL shape: `localhost:5433`, database `fittrackdb`
- Redis container: `fittrack-redis-local`
- Redis port: `6379`

Local app ports:

- API: `http://127.0.0.1:3001/v1`
- Swagger: `http://127.0.0.1:3001/v1/docs`
- API health: `http://127.0.0.1:3001/v1/health`
- Web: `http://127.0.0.1:8080/login`
- Mobile web: `http://127.0.0.1:8081/login`
- AI microservice: `http://127.0.0.1:8000/health`
- Prometheus in Docker compose: `9090`
- Grafana in Docker compose: `3002`

Use `pnpm dev:stack:status` before starting duplicate supervised processes. Use `pnpm dev:stack:stop` for supervisor-owned shutdown.

## TypeScript And Style Conventions

The repo uses strict TypeScript:

- `strict: true`
- `isolatedModules: true`
- `moduleResolution: "bundler"`
- no `any`
- no TypeScript suppression comments unless explicitly justified
- compact formatting, no excessive blank lines
- prefer path aliases and existing local patterns

Important style guidance:

- Do not rewrite unrelated code.
- Do not revert user changes.
- Prefer existing Fit primitives and controllers over new abstractions.
- Add abstractions only when they remove meaningful duplication or match a nearby pattern.
- Persistent business data belongs in Postgres-backed endpoints, not browser storage.
- `localStorage` or `sessionStorage` should be used only for clearly local UI convenience.

## Backend Overview

Stack:

- NestJS 11
- Prisma 7
- PostgreSQL
- Redis
- Bull/BullMQ queues
- EventEmitter2
- Winston logs
- Swagger/OpenAPI
- Helmet, CORS, cookie parser
- class-validator and class-transformer
- PayMongo
- Cloudflare R2 file storage
- Prometheus/Grafana monitoring

API entry:

- `apps/api/src/main.ts`
- global prefix defaults to `/v1`
- Swagger at `/v1/docs`
- validation pipe uses whitelist, forbid non-whitelisted, transform, implicit conversion
- success responses pass through `ResponseInterceptor`
- errors pass through `HttpExceptionFilter`

Root module:

- `apps/api/src/app.module.ts`
- imports config, Prisma, mail, queue, health, audit, auth, admin, bookings, coaching, files, fitness, membership, notifications, nutrition, inventory, analytics, gym layout, staff, user, and AI modules
- Redis and Bull are configured centrally
- Prometheus path is `/metrics`
- Bull Board is mounted at `/queues`

Backend module folders:

```text
admin
ai
analytics
audit
auth
booking-venue
bookings
coach-appointment
coaching
common
config
files
fitness
gym-layout
inventory
jwt
mail
membership
notifications
nutrition
prisma
queue
staff
types
user
```

API controller route roots found in source:

```text
/v1/admin
/v1/admin/bookings
/v1/admin/deletion-requests
/v1/admin/gamification
/v1/admin/users
/v1/ai
/v1/analytics
/v1/appointments
/v1/attendance
/v1/audit
/v1/auth
/v1/bookings
/v1/bookings/recurring-coaching-plans
/v1/business-analytics
/v1/coaches
/v1/coaching
/v1/files
/v1/fitness
/v1/gym-chat
/v1/gym-chat/knowledge
/v1/gym-layout
/v1/health
/v1/inventory
/v1/membership
/v1/membership/card
/v1/notifications
/v1/nutrition
/v1/payments
/v1/pose
/v1/staff
/v1/users
/v1/venues
/v1/workout/equipment
```

Backend architecture pattern:

- Controllers should stay thin: routing, DTOs, guards, Swagger decorators, current user extraction.
- Services own orchestration, domain rules, events, queues, and cross-domain flows.
- Repositories own non-trivial Prisma access.
- Use transactions for multi-write persistence.
- Use queue lifecycle service plus processor pattern for scheduled/background work.
- Emit audit and notification side effects after required DB state commits.
- Preserve role guards and portal access semantics.

## API Contracts

Success envelope:

```ts
type ApiResponse<T> = {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};
```

Default rule: controllers return domain data and the response interceptor wraps it as `{ data }`. Paginated responses may return `{ data, meta }`.

Error shape:

```ts
type ProblemDetailsBody = {
  type: string;
  title: string;
  status: number;
  detail: string;
};
```

Common auth pieces:

- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`
- `apps/api/src/common/decorators/roles.decorator.ts`

Expected protected route pattern:

```ts
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
```

JWT payload concept:

```ts
type JwtPayload = {
  sub: string;
  role: "admin" | "staff" | "member" | "coach";
  status: "active" | "suspended" | "banned";
  jti: string;
  iat: number;
  exp: number;
};
```

Important API client behavior:

- `packages/api-client` unwraps `{ data }` envelopes in `request.ts`
- Axios transport injects bearer tokens from a token store
- 401 responses trigger refresh flow unless `_preserveSessionOn401` is set
- form data requests remove JSON content-type automatically

## Prisma And Database

Schema:

- `apps/api/prisma/schema.prisma`
- migrations: `apps/api/prisma/migrations`
- Prisma config: `apps/api/prisma.config.ts`
- local env resolution comes through `apps/api/env-path`

Development migration rule:

- prefer `pnpm db:migrate` / Prisma `migrate dev`
- avoid `db push` for long-lived schema changes unless explicitly requested for a dev shortcut
- update schema, migration, seed fixtures, repositories/services, and verification together
- keep local dev reseed-safe

Major Prisma domains and models:

- auth/user: `User`, `AuthIdentity`, `RefreshToken`, `OtpVerification`, `UserProfile`, `NotificationPreference`, `AccountDeletionRequest`
- membership/payment: `MembershipPlan`, `Subscription`, `MembershipCard`, `Payment`
- facilities/bookings: `Amenity`, `FacilityFloorPlanMedia`, `AmenityBooking`
- coaching: `CoachProfile`, `CoachAppointment`, `RecurringCoachingPlan`, `RecurringCoachingBillingCycle`, `CoachReview`, `CoachAvailabilitySlot`, `CoachClientRelationship`
- fitness/training/pose: `ExerciseCatalog`, `MuscleDefinition`, `ExerciseReviewSubmission`, `TrainingPlan`, `WorkoutSession`, `ExerciseLog`, `PoseExerciseProfile`, `PoseSession`, `MuscleMasteryProgress`
- gamification/moderation: `ProgressionSourceEvent`, `ProgressionGrantLedger`, `UserProgressionProfile`, `SeasonDefinition`, `SeasonalStanding`, `MilestoneDefinition`, `UserMilestoneProgress`, `RankingProfile`, `IntegrityProfile`, `IntegrityCase`, `IntegrityEvent`, `CreatorProfile`, `ModerationActionRecord`
- nutrition: `TdeeProfile`, `MacroTarget`, `NutritionLog`, `ProgressMetric`
- inventory/sales/equipment: `RetailProduct`, `SaleTransaction`, `SaleTransactionItem`, `GymEquipmentItem`, `EquipmentWriteOff`, `GymEquipment`
- AI/chat: `AiChatSession`, `AiChatMessage`, `AiInteractionLog`, `GymChatSession`, `GymChatMessage`, `GymChatInteractionLog`
- operations: `Notification`, `AuditLog`, `GymOperatingHour`, `GymSpecialSchedule`, `GymPromotion`, `GymFaqEntry`, `BusinessInsightRun`

Seed scripts:

- `apps/api/prisma/seed.ts` - default bootstrap seed
- `apps/api/prisma/bootstrap-defaults.ts` - admin, demo member, amenities, muscles
- `apps/api/prisma/seed-test-data.ts` - deterministic test fixture set
- `apps/api/prisma/report-test-data.ts` - prints seeded credentials, counts, and manual test paths
- `apps/api/prisma/seed-realistic-data.ts` - richer realistic fixtures

Current local DB snapshot after cleanup on 2026-05-11:

- Prisma migrations are up to date
- local schema was reset and reseeded with `pnpm db:seed:test`
- report command: `pnpm db:seed:test:report`

Seeded test credentials:

```text
seed.admin@fittrack.com / SeedAdmin!2026
seed.staff@fittrack.com / SeedStaff!2026
seed.coach.ridge@fittrack.com / SeedCoach!2026
seed.member.active@fittrack.com / SeedMember!2026
seed.member.premium@fittrack.com / SeedMember!2026
seed.member.frozen@fittrack.com / SeedMember!2026
seed.member.pending@fittrack.com / SeedMember!2026
seed.member.nomembership@fittrack.com / SeedMember!2026
seed.member.expired@fittrack.com / SeedMember!2026
```

Representative seeded counts from direct Prisma check:

```text
User 9
AuthIdentity 9
UserProfile 9
NotificationPreference 9
MembershipPlan 3
Subscription 4
MembershipCard 5
Payment 8
Amenity 4
FacilityFloorPlanMedia 3
AmenityBooking 4
CoachProfile 4
CoachAppointment 4
RecurringCoachingPlan 1
RecurringCoachingBillingCycle 2
ExerciseCatalog 8
MuscleDefinition 23
ExerciseReviewSubmission 18
TrainingPlan 1
WorkoutSession 2
ExerciseLog 2
PoseExerciseProfile 6
PoseSession 2
MuscleMasteryProgress 4
RetailProduct 6
SaleTransaction 4
SaleTransactionItem 8
GymEquipmentItem 4
GymEquipment 4
NutritionLog 24
BusinessInsightRun 2
```

Empty transient auth tables like refresh tokens and OTPs are expected on a clean seed.

## Web App

Path: `apps/web`  
Framework: Next.js 16 App Router, React 19, Tailwind, Radix, framer-motion, TanStack Query, lucide-react, Recharts, React Hook Form, zod.  
Dev port: `8080`

Key web folders:

- `apps/web/app` - route groups and page files
- `apps/web/components` - app-local components and Fit primitives
- `apps/web/components/fit` - preferred web UI primitives
- `apps/web/contexts` - auth, theme, schedule, member, analytics filter contexts
- `apps/web/hooks` - page/domain hooks
- `apps/web/lib` - query client, API client, portal access helpers

Web app providers:

- `apps/web/app/layout.tsx`
- wraps `ThemeProvider`
- wraps app `Providers`
- mounts `RootLayoutClient`
- mounts `sonner` toaster
- uses local fonts `blrrpixs016.ttf` and `caveatbrush.ttf`
- exports `dynamic = "force-dynamic"`

Current web routes from source:

```text
/(land)/(home)
/(land)/login
/(land)/locked
/(land)/payments/success
/(land)/payments/cancel
/(land)/dev/auth-bridge
/(auth)/dashboard
/(auth)/accounts
/(auth)/memberships-promos
/(auth)/schedule
/(auth)/facilities
/(auth)/inventory
/(auth)/analytics
/(auth)/ai
/(auth)/gym-actions
/(auth)/exercise-lab
/(auth)/workout
/(auth)/nutrition
/(auth)/mastery
/(auth)/gamification
/(auth)/bookings
/(auth)/profile
/(auth)/settings
```

Important web component folders:

```text
accounts
analytics
auth
chatbot
exercise-lab
fit
inventory
landing
layout
loading
map
member-only
modals
profile
requirements
schedule
settings
```

Important web hooks folders:

```text
ai
analytics
animations
dashboard
facilities
inventory
member-only
notifications
profile
```

Web implementation pattern:

- keep `page.tsx` readable as the surface assembly
- move query/mutation behavior to hooks or controller helpers
- use `packages/query` query options and invalidation helpers
- use `packages/api-client` instead of raw fetch
- prefer web Fit primitives from `apps/web/components/fit`
- `use client` is required for hook/event/browser-interactive files
- role/portal access lives around `apps/web/lib/portal-access.ts` and related auth context

## Mobile App

Path: `apps/mobile`  
Framework: Expo 55, Expo Router, React Native 0.83, React 19, Reanimated 4, TanStack Query, lucide-react-native, Vision Camera, Skia.  
Main entry: `expo-router/entry`  
Native dev command: `pnpm dev:mobile`  
Web command: `pnpm dev:mobile:web`  
Mobile web port: `8081`

Key mobile folders:

- `apps/mobile/app` - Expo Router routes
- `apps/mobile/components` - app-local components and Fit primitives
- `apps/mobile/components/fit` - preferred mobile UI primitives
- `apps/mobile/contexts` - auth, theme, fitness, FAB state
- `apps/mobile/hooks` - screen/domain hooks
- `apps/mobile/lib` - API client, query client, workout/pose helpers

Root providers in `apps/mobile/app/_layout.tsx`:

- `ThemeProvider`
- `FitnessProvider`
- `AuthProvider`
- `QueryProvider`
- API token hydration through `hydrateMobileApiAuth`
- font loading for `Blrrpix` and `CaveatBrush`
- max-width constrained mobile shell using `MAX_WIDTH` from `@fittrack/ui/tokens`

Current mobile routes from source:

```text
/(auth)/login
/(auth)/register
/(tabs)/index
/(tabs)/home
/(tabs)/facilities
/(tabs)/bookings
/(tabs)/nutrition
/(tabs)/workout
/(tabs)/mastery
/(tabs)/chathistory
/(tabs)/chatbot
/(tabs)/profile
/(tabs)/settings
```

Important mobile component folders:

```text
chatbot
fit
layout
loading
mastery
membership
modals
profile
requirements
settings
workout
```

Important mobile hooks folders:

```text
animations
chatbot
home
mastery
membership
profile
workout
```

Mobile implementation pattern:

- keep screen files readable as route-level assembly
- use `makeXxxStyles(colors)` style factories with `useMemo`
- use Reanimated only where actual animation is needed
- prefer app-local `Fit*` components before raw inputs/buttons
- keep persistent cross-device state in API-backed storage, not AsyncStorage unless it is a local device preference
- workout pose helpers live under `apps/mobile/lib/workout`

## AI Microservice

Path: `apps/ai-microservice`  
Framework: Python 3.11+, FastAPI, Pydantic 2, Uvicorn, MediaPipe, NumPy, Pillow, Ultralytics, HTTPX.  
Tests: pytest under `apps/ai-microservice/tests`

Entry:

- `apps/ai-microservice/app/main.py`
- includes router from `app/api/routes.py`
- loads local env via `app/env.py`
- normalizes service errors to problem-details-like payloads

Routes:

```text
GET  /health
POST /chat
POST /chat/gym
POST /generate-plan
POST /analytics/insights
POST /calculate-tdee
POST /equipment/detect
POST /exercise-drafts/propose
POST /pose/session/bootstrap
POST /pose/analyze
POST /pose/session/finalize
```

Service files:

```text
assistant.py
business_insights.py
equipment_detection.py
exercise_drafts.py
gym_chat.py
nutrition.py
pose_sessions.py
```

The Nest API has an `ai` module that proxies/coordinates with this service for application-facing behavior.

## Shared Packages

`packages/api-client`

- creates `createApiClient`
- exposes domain clients: auth, admin, users, venues, bookings, appointments, coaches, fitness, files, gym knowledge, inventory, gym layout, membership, notifications, recurring coaching plans, nutrition, staff, analytics, audit, ai
- contains token store, auth events, Axios transport, response unwrap helpers, API error normalization

`packages/query`

- TanStack Query options for every domain
- cache invalidation helpers
- query keys
- `makeQueryClient`
- `useStableQueryClient`

`packages/app-core`

- shared controllers/transforms:
  - auth session and `createAuthController`
  - booking transforms
  - member controller
  - schedule controller
  - action helpers
  - theme controller/state

`packages/types`

- shared TypeScript domain types for auth, booking, membership, member, facilities, files, fitness, gym layout, inventory, notifications, nutrition, theme, UI, analytics, AI

`packages/ui`

- shared tokens and themes
- `MAX_WIDTH = 450`
- default theme key: `night`
- theme labels include SertFit Gym, Morning Rise, Night Hours, Wavy Lights, Moody Blues

`packages/validators`

- shared validators for auth, booking, coaching, membership, nutrition, profile, AI

## Theme And UI Notes

Shared tokens:

- brand default token: `#06b6d4`
- primary product theme accent for `night`: `#E87722`
- card radius in shared token file is `12`, but repo-level frontend guidance often prefers tighter cards unless existing Fit primitives dictate otherwise
- mobile shell max width is `450`

Fit primitives are app-local:

- web: `apps/web/components/fit`
- mobile: `apps/mobile/components/fit`

Do not create a cross-platform UI abstraction too early. First reuse or improve the local Fit primitive closest to the feature.

UI surfaces should be operational and dense where appropriate. This is a gym/admin/member workflow app, not a generic marketing page. Avoid decorative pages when the user asks for a usable tool.

## Auth And Role Model

Roles:

- `admin`
- `staff`
- `member`
- `coach`

Statuses:

- `active`
- `suspended`
- `banned`

High-level role surfaces:

- admin/staff web portal: member operations, schedule, facilities, inventory, analytics, AI/admin tools, audit-like operations
- member mobile app: home, facilities, bookings, nutrition, workout, mastery, chat, profile, settings
- coach flows exist in API and web scheduling/coaching surfaces

Auth is JWT plus refresh token support. Token refresh is handled in shared API transport; do not hand-roll token refresh in pages/screens.

## Business Domains

The main product domains are:

- auth and user identity
- profile and progress
- membership plans/cards/subscriptions/payments
- facility amenities and bookings
- coaching, appointments, availability, recurring plans, billing cycles
- fitness catalog, training plans, workout sessions, pose sessions, exercise review submissions
- gamification, ranking, milestones, creator profiles, integrity moderation
- nutrition TDEE, macros, logs, progress
- retail inventory, sales, equipment, write-offs
- AI chat and gym knowledge
- notifications
- audit logs
- analytics and business insights
- gym layout/equipment live status

Domain docs that can help:

- `context/00-global-contracts.md`
- `context/s4-subscription-payments.md`
- `context/s5-facility-bookings.md`
- `context/s6-coaching.md`
- `context/s7-fitness-training.md`
- `context/s8-gamification.md`
- `context/s9-tdee-nutrition.md`
- `context/s10-inventory.md`
- `context/s11-ai-chatbot.md`
- `context/s12-notifications.md`
- `context/s13-gym-layout-analytics.md`
- `context/s14-auditing.md`
- `context/python/00-python-microservice-contracts.md`
- `context/python/s15-pose-estimate.md`
- `context/python/s16-ai-chatbot.md`
- `context/python/s17-business-analytics.md`

Task histories under `tasks/backend-builder/s*` are also useful for understanding intent and tradeoffs.

## Testing And Verification

General approach:

- use focused typecheck/lint/test commands, not full monorepo commands unless needed
- verify backend contract changes through tests, direct API checks, and Swagger when contract changed
- verify UI with the actual local app when visual/runtime behavior changed
- for frontend, run app-specific typecheck:
  - web: `pnpm --filter @fittrack/web run typecheck`
  - mobile: `pnpm --filter @fittrack/mobile run typecheck`
- for backend:
  - API unit tests: `pnpm --filter @fittrack/api run test`
  - API e2e: `pnpm --filter @fittrack/api run test:e2e`
  - API lint check: `pnpm --filter @fittrack/api run lint:check`

Useful manual seeded test paths from the seed report:

```text
web-members: /members using admin
web-inventory: /inventory using admin
web-analytics: /analytics using admin
web-member-profile-only: /profile using member-active
web-coach-dashboard: /coach/dashboard using coach
mobile-bookings: /(tabs)/bookings using member-active
mobile-nutrition: /(tabs)/nutrition using member-active
mobile-workout: /(tabs)/workout using member-active
mobile-chat-history: /(tabs)/chathistory using member-active
mobile-frozen-account: /(tabs)/profile using member-frozen
mobile-profile-no-membership: /(tabs)/profile using member-nomembership
web-schedule: /schedule using staff
```

Note: some route names in older docs may lag behind current source. Prefer the actual route files under `apps/web/app` and `apps/mobile/app`.

## Common Gotchas

- The repo is Windows/PowerShell based.
- Use `rg` for search.
- Do not read or expose `.env` secrets.
- Do not modify generated artifacts or `node_modules` manually.
- Do not use `db push` for checked-in schema evolution unless explicitly asked.
- Prisma may require filesystem approval on Windows when writing migrations or regenerating client.
- Preserve user-owned working tree changes.
- Some docs are stale. Source and current package scripts win.
- The backend is broad and coupled. Before widening an API response, check shared clients, query package, DTOs, web/mobile consumers, and Prisma seed implications.
- For pages/screens, keep routes thin but visible. Do not hide whole screens in a generic `XxxContent` if it makes the route unreadable.
- Web and mobile have separate Fit primitives; do not force a cross-platform UI abstraction prematurely.
- Role and portal access rules are intentional. Do not broaden access casually.

## Recommended First Files For Claude To Inspect

For backend/API tasks:

```text
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/prisma/schema.prisma
apps/api/src/common/interceptors/response.interceptor.ts
apps/api/src/common/filters/http-exception.filter.ts
apps/api/src/common/guards/jwt-auth.guard.ts
apps/api/src/common/guards/roles.guard.ts
.codex/skills/backend/references/api-conventions.md
.codex/skills/backend/references/migration-playbook.md
```

For web tasks:

```text
apps/web/app/layout.tsx
apps/web/app/(auth)/layout.tsx
apps/web/components/fit/index.ts
apps/web/lib/api-client.ts
apps/web/lib/queryClient.tsx
.codex/skills/frontend/references/route-map.md
.codex/skills/frontend/references/component-patterns.md
```

For mobile tasks:

```text
apps/mobile/app/_layout.tsx
apps/mobile/app/(tabs)/_layout.tsx
apps/mobile/components/fit/index.ts
apps/mobile/lib/api-client.ts
apps/mobile/lib/queryClient.tsx
apps/mobile/lib/workout/poseRepEngine.ts
```

For shared contract work:

```text
packages/api-client/index.ts
packages/api-client/request.ts
packages/api-client/transport/createAxiosTransport.ts
packages/query/index.ts
packages/query/query-keys.ts
packages/types/index.ts
packages/validators/index.ts
```

For AI microservice tasks:

```text
apps/ai-microservice/app/main.py
apps/ai-microservice/app/api/routes.py
apps/ai-microservice/app/models
apps/ai-microservice/app/services
context/python/00-python-microservice-contracts.md
```

## Suggested Prompt To Pair With This File

```text
You are working in the FitTrack monorepo. Read CLAUDE_CODEBASE_CONTEXT.md first, then inspect the current files related to the task. Follow the repo's existing patterns, preserve uncommitted user changes, avoid broad refactors, use shared packages for contracts/query/API wiring, keep backend schema changes migration-backed and reseed-safe, and run focused verification for touched surfaces.
```
