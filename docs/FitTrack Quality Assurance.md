# FitTrack Quality Assurance

_Refined on April 28, 2026 from:_
- `C:\Users\Khristiane\Downloads\CODEX_PROMPTS_AND_CHECKLIST (1).md`
- `C:\Users\Khristiane\Downloads\SYSTEM-FINAL-DESIGN-LAHJET.docx` including Word comments
- current merged FitTrack worktree after `temporary-branch` + `lucky-integration`
- current FitTrack codebase and live Swagger contract at `http://127.0.0.1:3001/v1/docs-json` when the stack is running

This version is optimized for **integration-first quality assurance**.

The goal is:
- verify what already exists before touching anything
- prefer shared-contract and data-flow fixes over cosmetic rewrites
- apply UI/UX changes only when they are required to surface missing behavior or resolve comment-driven confusion
- avoid re-implementing features that are already present in the current codebase

Current execution context:
- Project root: `C:\Users\Khristiane\Documents\GitHub\FitTrack`
- Runtime target: local web on `http://127.0.0.1:8080`, mobile web on `http://127.0.0.1:8081`, API on `http://127.0.0.1:3001/v1`
- Repo-pinned Node version: `20` from `.nvmrc`
- Package manager: `pnpm@10.30.3`
- On Windows, prefer `cmd /c pnpm ...` or `pnpm.cmd ...` when PowerShell blocks script execution.
- Web dev is intentionally forced through webpack via `next dev --webpack --port 8080` to avoid the observed Windows/Turbopack `spawn EPERM` / `0xc0000142` crash.
- Local Prisma engine commands may fail on this machine with `schema-engine-windows.exe spawn EPERM`; use Prisma MCP, direct DB checks, or targeted Postgres verification when that happens.

---

## 1. Global Execution Rules

Use this pattern for every prompt:

1. Inspect first.
   - Use `Serena` first for codebase discovery.
   - Use `Playwright` if available.
   - If `Playwright` is unavailable, use `Chrome DevTools MCP` plus `Swagger`, `Prisma Local`, and targeted direct API checks.
2. Check the current codebase before changing UI.
   - If the feature already exists and works, leave it alone.
   - If it exists but is partially broken, fix only the broken part.
3. Bias toward integration.
   - Shared endpoints
   - shared tables
   - query invalidation
   - cache consistency
   - mobile/web parity
4. UI/UX changes only when needed.
   - Do not redesign working surfaces just because the prompt lists a feature.
   - Only reshape layout when the teammate comments clearly require it or when the current UI blocks the workflow.
5. Cross-reference every shared flow.
   - Data created, updated, archived, restored, or deleted on web must reflect on mobile and vice versa where the feature is shared.
6. Flag product decisions before implementing them.
   - Some Word comments are not "fixes"; they are product-direction changes.
   - Pause and confirm before implementing those.

### Evidence order

Use this order when possible:

1. Serena code scan
2. live browser inspection
3. Swagger/OpenAPI contract check
4. Prisma or DB truth check for data-sensitive flows
5. targeted tests and type/lint checks

### Output expectation for every prompt

For each module, produce:
- current observed state
- what already exists
- what is missing or broken
- what was changed
- shared-contract parity notes
- blockers or product decisions that need confirmation

---

## 2. Current Codebase Snapshot (Do Not Rebuild These Blindly)

These are already present in the current repo and should be treated as **verify-first items**, not default implementation targets:

### Web
- `Account Module` naming is already present in the admin members route.
- `Termination Requests` status/filter already exists in the account flow.
- account deletion review actions already include `Approve request` and `Deny request`.
- BRODIGY AI already has deleted-chat handling, trash-icon delete behavior, and restore flow in the web history panel.
- Inventory already has:
  - retail image handling
  - equipment image handling and equipment image column
  - `Upload New Image`
  - `Image Reference`
  - `Restock Item`
  - restock target loading guard so first-submit restock does not silently no-op
  - `Record Sale`
  - multi-item manual sale flow with prices sourced from product records
  - current inventory product value display
- Analytics is already merged into `/analytics`, and `/dashboard` redirects into the new flow.
- Analytics PDF export route already exists: `POST /v1/analytics/export/pdf`.
- Notifications already have inbox, unread count, mark-read, mark-all-read, and delete query wiring.
- Web login already exists with:
  - forgot password modal
  - locked-account route
  - 30-minute cooldown UI
  - OTP path

### Backend / Shared Contracts
- shared notifications API exists
- inventory sales API exists and already distinguishes `manual` and `mobile` sale sources
- inventory activity events create notification rows for product add/update/restock/archive, manual sale, equipment add/update/archive/write-off
- analytics export PDF backend exists
- admin deletion requests endpoint exists
- gamification admin contracts from `lucky-integration` are present:
  - Prisma models and migration `20260423150000_add_gamification_backbone_foundation`
  - backend admin controller/service/repository
  - web `/gamification` route and query/API-client wiring
- local DB warning:
  - the merged code requires gamification tables such as `ranking_profiles`
  - if the running DB throws `The table public.ranking_profiles does not exist`, the code is not the issue; the local DB schema is behind the merged Prisma schema
  - on this machine, Prisma migrate/db-push may be blocked by `schema-engine-windows.exe spawn EPERM`, so verify DB truth with Prisma MCP or direct Postgres checks before assuming an application bug
- Swagger currently exposes 194 paths on the running local API
- recurring coaching plan files/contracts exist and have passed targeted backend/runtime checks in the current worktree:
  - preview endpoint generated sessions without increasing persisted appointment count
  - create endpoint persisted one parent plan and the expected child appointment rows
  - child sessions appeared through the existing staff/Gym Operations appointment endpoints
  - single-session reschedule changed only the selected child session
  - bulk future update changed selected-and-future sessions while preserving earlier sessions
  - cancel preserved completed/past sessions and cancelled only future non-completed sessions
- Facilities media contracts are present in the current codebase:
  - venue image fields are wired through venue/facility contracts
  - floor-plan media endpoints exist under `/v1/gym-layout/floor-plans/media` and `/v1/gym-layout/floor-plans/:floorId/media`
  - web facility map surfaces include image upload/edit wiring

### Mobile
- tab routes already exist for:
  - home
  - bookings
  - facilities
  - nutrition
  - mastery
  - workout
  - profile
  - settings
  - chatbot
- mobile profile hook already includes:
  - Attendance QR handling
  - loaded plan state
  - request termination flow
- mobile Muscle Mastery reads the shared `/v1/fitness/*` backend contracts and renders expected empty state when the active browser user has no mastery records
- mobile Workout reads the shared exercise/session contracts; direct runtime API smoke confirmed workout session start -> set log -> complete persistence

### Current Prompt Status

Treat these as currently passed from current code scan, Swagger/direct API checks, and targeted browser evidence where available:
- Web: `W-0`, `W-1`, `W-2`, `W-3`, `W-4`, `W-4A`, `W-5`, `W-6`, `W-7`, `W-8`, `W-9`, `W-10`
- Mobile: `M-1`, `M-2`, `M-3`, `M-4`, `M-5`, `M-6`, `M-7`, `M-8`, `M-9`, `M-10`, `M-11`

Treat these as still requiring broader final-regression proof, not feature implementation:
- complete one consolidated web browser walkthrough after the local stack is stable
- complete one consolidated mobile device/native walkthrough after the Android build environment is stable
- run API lint/type gates after the existing CRLF/Prettier and unsafe-type lint blockers are cleaned up

Current proof gaps to prioritize:
- full browser evidence for every module in the master QA prompt, not only targeted proof points
- native-device evidence for mobile modules, because current proof is mostly mobile web/API for the latest pass
- clean migration-history reconciliation for the local database if Prisma migrate remains drifted
- API lint cleanup:
  - `pnpm.cmd --dir apps/api lint:check` currently fails on existing Prettier CRLF issues and unsafe-type findings across API files
  - `pnpm.cmd --dir apps/web typecheck` passes
  - `pnpm.cmd --dir apps/mobile typecheck` passes

---

## 3. Product Decision Gates From The Commented DOCX

These should **not** be treated as automatic implementation items without confirmation:

- replacing milestone review/admin approval with fully automatic AI-driven milestone detection
- moving global exercise creation from web admin to mobile workout flow
- broad mobile IA changes like moving termination or support to Settings / Help Center
- major membership-plan commerce redesign
- “make it more colorful / animated / interactive” without concrete constraints
- replacing readiness with credentials in coach management if backend semantics are not already aligned

If any prompt touches one of these, stop and confirm first.

---

## 4. Master Prompt Wrapper

Use this wrapper before every module-specific prompt:

> Before making any changes, inspect the current implementation first. Use Serena for code discovery, then use Playwright if available; otherwise use Chrome DevTools MCP, Swagger, Prisma Local, and direct API checks. Verify which pieces already exist and work in the current codebase and runtime. Do not redesign or replace working UI. Prioritize shared contracts, backend wiring, cache consistency, and web/mobile parity. Add or fix only what is missing or broken. If the request drifts into a product decision rather than a clear implementation gap, pause and flag it before proceeding.

---

## 5. Revised Prompt Library

## PROMPT W-0 — LOGIN MODULE - WEB -DONE

Use the master prompt wrapper above, then:

- inspect the web login route and locked-account route
- verify:
  - Email field
  - Password field
  - `Forgot Password?`
  - Sign In button
  - account lockout after repeated failures
  - 30-minute cooldown flow
  - locked message consistency
  - OTP gating if applicable
- if all work correctly, leave them untouched
- if anything is broken, fix only the broken behavior

Cross-reference:
- lockout state must be backend-truth, not only local UI state
- mobile and web auth should not contradict each other on suspended/archived/locked users

## PROMPT W-1 — NOTIFICATION MODULE - WEB -DONE

Known current state:
- inbox, unread count, mark-read, mark-all-read, and delete use the shared notifications API
- direct runtime smoke verified inventory activity mutations create unread inbox rows immediately
- browser proof now confirms an inventory restock mutation creates a notification row and updates the header bell with a red unread badge

Use the master prompt wrapper above, then:

- inspect notification delivery shape from live requests first
- verify:
  - mark all as read
  - card structure
  - title
  - description/body mapping
  - date/time mapping
  - single read action
  - delete action
  - unread badge consistency
- verify query invalidation and timing for mutations triggered from other modules
  - inventory activity
  - account actions
  - AI chat events
  - analytics/business events if applicable

Cross-reference:
- same notifications backend must serve mobile unless intentionally platform-specific

## PROMPT W-2 — PROFILE MODULE - WEB -DONE

Use the master prompt wrapper above, then:

- verify:
  - Name
  - Email
  - Phone
  - Date of Birth
  - Edit Profile save
  - Gym Name
  - Gym Phone
  - Location
  - Gym Email
  - Opening/Closing Hours
  - Edit Gym Details save

Cross-reference:
- edits must reflect on mobile profile where shared

## PROMPT W-3 — ACCOUNT MODULE - WEB -DONE

Known current state:
- route already uses `Account Module`
- `Termination Requests` flow already exists
- staff-role QA status:
  - staff Account Module now reads from the same canonical account directory truth used by admin
  - staff directory visibility is restricted to member accounts only; admin and staff records stay admin-visible
  - staff can open the create-account flow, but role creation is restricted to `staff` and `member` only
  - staff can edit details and manually check in eligible member accounts
  - admin remains a superset of staff inside Account Module
  - account-side actions now emit inbox notifications, including manual check-in
  - `Delete All` exists beside `Mark All Read` in the notification panel
  - runtime browser re-verification for this pass is still blocked locally when `next dev` fails with `spawn EPERM`

Use the master prompt wrapper above, then:

- verify module rename is complete
- verify add-account flow:
  - Member / Staff / Admin
  - First Name / Last Name / Email / Phone
  - password generator
  - inline password requirements
  - inline validation messages
  - review-before-create
  - account snapshot during review
- verify directory:
  - search
  - Active / Archived / Termination Requests
  - role filters
  - correct behavior when `Termination Requests` is active
- verify member/account details modal:
  - modal behavior
  - profile image
  - edit details fields
  - check-in
  - message
  - revoke/restore/archive confirmations
  - dynamic archive/restore labeling

Cross-reference:
- account creation and edits must reflect in mobile login/profile/access flows
- pending termination requests from mobile must surface correctly here

## PROMPT W-4 — GYM OPERATIONS MODULE - WEB -DONE

Use the master prompt wrapper above, then:

- inspect Schedule, Venue Booking, and Manage Coaches
- verify:
  - coach search and coach list
  - calendar navigation and current/past/future visibility
  - existing appointment rendering
  - venue/status filters
  - booking data wiring
  - manage-coach actions
  - `Open in Schedule`

Special caution:
- several Word comments here are layout or product-direction heavy
- treat schedule creation/update/delete gaps as integration scope only if backend support exists or is clearly missing
- do not over-redesign without confirmation

Cross-reference:
- bookings and appointments must remain shared with mobile
- for long-term recurring coaching plans, use `PROMPT W-4A - RECURRING COACHING PLANS - GYM OPERATIONS`

## PROMPT W-5 — EXERCISE LAB MODULE - WEB -DONE

Use the master prompt wrapper above, then:

- inspect:
  - Exercise Review
  - Milestones
  - Global Library
- verify:
  - publish queue
  - review workbench or equivalent moderation flow
  - milestone queue/review if still intended
  - create global exercise
  - search/filter/refresh
  - exercise card fields
  - edit/archive behavior

Decision gate:
- if the work begins to remove admin review or move creation ownership to mobile, stop and confirm first

Cross-reference:
- published/approved exercises must feed mobile surfaces that consume the global library

## PROMPT W-6 — BRODIGY AI MODULE - WEB -DONE

Known current state:
- deleted-chat filter and restore flow already exist in current code

Use the master prompt wrapper above, then:

- verify:
  - new chat
  - delete icon behavior
  - soft delete only
  - confirmation before delete
  - selected-card-only action visibility
  - left-side chat history
  - deleted chats filter
  - restore chat
  - conversation title placement

Cross-reference:
- determine whether web and mobile chats are shared or intentionally separate
- soft-deleted behavior must be consistent if sessions are shared

## PROMPT W-7 — FACILITIES MODULE - WEB -DONE

Known current state:
- archive, venue, equipment, and floor-plan surfaces exist.
- persisted venue/facility image fields are represented in shared contracts.
- persisted floor-plan media has backend contracts under `/v1/gym-layout/floor-plans/media`.
- web facility map surfaces include image upload/edit wiring.
- full browser upload proof is still needed before final release clearance.

Use the master prompt wrapper above, then:

- inspect:
  - Manage Archive
  - Venues
  - Equipments
  - Floor Plan
- verify only missing or broken pieces:
  - archive filter and restore flows
  - venue/equipment detail fields
  - add venue/equipment flows
  - view/edit lock behavior where present
  - floor layout save/clear behavior
  - drag/drop persistence
  - venue image upload/edit persistence
  - floor-plan image upload/edit persistence

Cross-reference:
- venue availability must feed booking constraints consistently across web/mobile

## PROMPT W-8 — INVENTORY MODULE - WEB -DONE

Known current state:
- retail image flow exists
- equipment image flow and equipment image list column exist
- image reference exists
- restock exists
- restock now loads the selected product detail before submit, preventing first-restock no-ops when the table cache is not ready
- manual `Record Sale` exists
- manual sale supports multiple items and uses database product prices, not editable local prices
- shared sales backend exists with `manual` and `mobile` sources
- source now accepts seeded non-v4 retail product UUIDs for manual sale payloads via `@IsUUID('all')`
- live runtime re-smoke already passed against the running API using a seeded non-v4 retail product id:
  - manual sale wrote successfully
  - restock restored stock successfully
  - product state stayed consistent in Postgres truth
- direct runtime smoke verified product add, first restock, manual sale, equipment add/update/write-off/archive, notification creation, and cleanup

Use the master prompt wrapper above, then:

- verify retail toolbar, add-product form, summary cards, filters, product card, product details, restock, and manual sale flow
- verify equipment toolbar, add-equipment flow, summary cards, equipment details, and archive behavior
- verify inventory analytics:
  - sales revenue chart
  - period filters
  - top retail items
  - metric filters

Cross-reference:
- stock must decrement from both manual web sales and member/mobile purchases
- both sales channels must write to the same transactions tables
- notifications for inventory actions must be consistent
- analytics revenue must include both channels
- do not add another sales table or POS store; the current POS-like source of truth is `sale_transactions` plus `sale_transaction_items`

## PROMPT W-9 — ANALYTICS MODULE - WEB -DONE

Known current state:
- analytics route already exists as the merged dashboard/analytics surface
- dashboard redirects away
- PDF export backend exists

Use the master prompt wrapper above, then:

- verify layout order without reworking successful structure unnecessarily
- verify dynamic data for:
  - Daily Insights
  - Performance KPIs
  - Revenue
  - Attendance
  - System Alerts
  - Recent Activities
- verify:
  - low stock and maintenance alerts are system-generated
  - alert actions open the relevant workflows
  - PDF export uses real analytics data
  - AI-generated insights are section-specific
  - inventory-derived analytics are included where intended

Cross-reference:
- analytics counts must align with account visibility rules, inventory sales, and check-in truth from both web and mobile

## PROMPT W-10 — SETTINGS MODULE - WEB -DONE

Use the master prompt wrapper above, then:

- verify:
  - theme
  - font
  - animations
  - notification preference toggles
  - change password
  - open profile

Cross-reference:
- notification preferences should be checked for shared backend truth with mobile before assuming parity

## PROMPT M-1 — LOGIN MODULE - MOBILE -DONE

Use the master prompt wrapper above, then:

- verify:
  - Email
  - Password
  - Login button
  - lockout/cooldown
  - backend-truth lockout behavior

Cross-reference:
- lockout state must remain consistent with web auth

## PROMPT M-2 — REGISTRATION MODULE - MOBILE -DONE

Use the master prompt wrapper above, then:

- verify:
  - Name
  - Email
  - Phone
  - Password
  - Confirm Password
  - Create Account
  - Verify OTP

Cross-reference:
- successful registration must create the same member/account record visible on web

## PROMPT M-3 — PROFILE MODULE - MOBILE -DONE

Known current state:
- attendance QR, loaded plan, and termination request handling are already present in current mobile profile logic

Use the master prompt wrapper above, then:

- verify:
  - profile summary data
  - fitness summary
  - health snapshot
  - edit profile
  - member access
  - attendance QR
  - loaded plan
  - payment history
  - request termination

Cross-reference:
- edits must reflect on web
- attendance QR must write to the same check-in truth used by analytics
- termination request must surface in web account review

## PROMPT M-4 — HOME MODULE - MOBILE -DONE

Known current state:
- greeting now includes current date and time
- schedule for today includes a `Book Now` fallback CTA when there is no booking
- home summary is wired to live booking, nutrition, fitness mastery, leaderboard, and recent workout session query state
- pinned goal and workout suggestions now adapt to coach/member state, member access, nutrition targets, streak progress, and current-day bookings

Use the master prompt wrapper above, then:

- verify:
  - greeting
  - date/time
  - summary widgets
  - today bookings
  - 7 day activity
  - rank / EXP / streak
  - pinned badge goal
  - workout suggestions
  - schedule for today
  - `Book Now` fallback CTA

Cross-reference:
- booking data must match web booking truth

## PROMPT M-5 — BOOKINGS MODULE - MOBILE -DONE

Known current state:
- member reservations and coach appointments are already wired through shared query contracts
- booking creation, appointment creation, cancellation, and coach response flows invalidate the same backend-truth booking and appointment queries used elsewhere in the stack
- no extra UI work was needed in this pass because the current mobile bookings surface already reads and writes shared booking truth cleanly

Use the master prompt wrapper above, then:

- inspect and verify current state first
- fix only if shared booking truth is broken

Cross-reference:
- venue bookings and coach appointments must write to the same web-visible tables

## PROMPT M-6 — FACILITIES MODULE - MOBILE -DONE

Use the master prompt wrapper above, then:

- Known current state:
  - mobile Facilities renders the shared venue/facility map from `venuesQueryOptions`.
  - the shared client maps `/v1/bookings/amenities` into venue records via `packages/api-client/domains/venues.ts`.
  - direct API smoke with the seeded premium member confirmed `/v1/bookings/amenities` is reachable and returns live facility data.
  - no UI changes were needed in this pass.
- inspect current state only
- verify shared venue/equipment data access if rendered
- do not invent new UI unless a broken existing dependency requires a fix

## PROMPT M-7 — NUTRITION MODULE - MOBILE -DONE

Use the master prompt wrapper above, then:

- Known current state:
  - mobile Nutrition uses shared nutrition query contracts for active TDEE, daily summary, and nutrition logs.
  - meal log and nutrition-goal modals submit through shared mutation helpers and invalidate nutrition queries.
  - direct API smoke with the seeded premium member confirmed `/v1/nutrition/tdee`, `/v1/nutrition/daily-summary`, and `/v1/nutrition/logs`.
  - no new UI was added because the prompt requested implementation truth unless a fuller spec exists.
- inspect current state
- report current implementation truth
- do not build new UI without a fuller spec

## PROMPT M-8 — MUSCLE MASTERY MODULE - MOBILE -DONE

Known current state:
- mobile Muscle Mastery is routed through `apps/mobile/app/(tabs)/mastery.tsx`.
- the screen uses `useMuscleMasteryScreen` and shared query contracts from `packages/query/fitness.ts`.
- live API/Swagger verification confirmed the shared endpoints:
  - `/v1/fitness/mastery`
  - `/v1/fitness/leaderboard`
  - `/v1/fitness/progression-profile`
  - `/v1/fitness/ranking-profile`
  - `/v1/fitness/season-standing`
  - `/v1/fitness/milestones`
  - `/v1/fitness/integrity-summary`
- mobile web runtime on `http://127.0.0.1:8081/mastery` loaded those shared contracts.
- the active browser user had no mastery rows, so the observed empty state was expected.
- direct API smoke with the seeded premium member confirmed real mastery data exists and is returned by the backend.

Use the master prompt wrapper above, then:

- inspect current state
- verify exercise source-of-truth only
- do not build new UI without a fuller spec

## PROMPT M-9 — WORKOUT MODULE - MOBILE -DONE

Known current state:
- mobile Workout is routed through `apps/mobile/app/(tabs)/workout.tsx`.
- the live screen uses `WorkoutLiveScreen` and `useWorkoutLiveController`.
- the workout surface reads shared fitness contracts for:
  - `/v1/fitness/exercises`
  - `/v1/fitness/plans`
  - `/v1/fitness/sessions`
  - `/v1/fitness/sessions/start`
  - `/v1/fitness/sessions/:id/sets`
  - `/v1/fitness/sessions/:id/complete`
  - `/v1/fitness/sessions/:id/cancel`
- mobile web runtime on `http://127.0.0.1:8081/workout` loaded the shared exercise catalog.
- direct API smoke with the seeded premium member confirmed session start, set logging, completion, and persisted completed-session retrieval.
- no duplicate workout session table was identified in the verified path.

Use the master prompt wrapper above, then:

- inspect current state
- verify exercise source-of-truth only
- do not build new UI without a fuller spec

## PROMPT M-10 — BRODIGY AI MODULE - MOBILE -DONE

Use the master prompt wrapper above, then:

- Known current state:
  - mobile BRODIGY AI uses the same `/v1/ai/chat/sessions`, `/messages`, delete, and restore contracts as web.
  - mobile chat history now has Active / All / Deleted filters, deleted chat labels, restore confirmation, and copy that says deleted chats are recoverable.
  - deleted sessions are read-only in the mobile chat screen until restored.
  - direct Swagger contract check confirmed `GET /v1/ai/chat/sessions`, `DELETE /v1/ai/chat/sessions/{id}`, and `PATCH /v1/ai/chat/sessions/{id}/restore`.
  - direct API smoke with the seeded premium member confirmed AI sessions load through the live API.
- inspect current state
- determine whether sessions are shared with web or not
- verify deleted/soft-deleted behavior consistency if shared

## PROMPT M-11 — SETTINGS MODULE - MOBILE -DONE

Use the master prompt wrapper above, then:

- inspect current state
- verify notification preferences and any shared settings only
- do not build new UI without a fuller spec

## PROMPT W-4A - RECURRING COACHING PLANS - GYM OPERATIONS -DONE

Known current state:
- recurring coaching plan backend contracts exist and are wired through:
  - preview
  - create
  - list sessions
  - update one session
  - bulk update future sessions
  - cancel plan
- web Gym Operations already includes:
  - `Create recurring plan`
  - preview/conflict review
  - confirm with skip-conflicts fallback
  - recurring session scope actions
  - future-session update flow
  - cancel-plan flow
- live member filtering for the create action now accepts local datasets that surface bookable members as `USER` rather than only `member`
- live API smoke already verified:
  - preview without persistence
  - create with generated child sessions
  - single-session reschedule
  - bulk future update
  - cancel plan
- current coach-schedule drag surfaces are not being exposed as persisted recurring-plan controls:
  - roster drag is disabled
  - weekly timeline drag is disabled
  - recurring changes are expected to go through the persisted recurring-plan actions, not local drag state
- member/mobile recurring-plan creation is still intentionally deferred by this prompt unless mobile coach-plan creation gets an explicit full spec later

Use the master prompt wrapper above, then:

- inspect the current Gym Operations schedule flow before making changes
- inspect existing coach appointment, staff appointment, coach availability, booking, notification, and Prisma schema contracts
- verify whether coaching appointments already support venue/location coupling before adding any venue conflict logic
- do not redesign the whole schedule UI; add only the surfaces needed to create, preview, confirm, edit, and cancel recurring coaching plans

Core problem:
- the current schedule supports one-off coach appointments, but a member who wants coaching for an extended period such as 3 or 6 months has no durable plan record, generated session list, conflict review, or safe edit behavior
- local-only calendar changes are not acceptable for recurring plans; every session must persist to backend truth and render through the existing appointment/schedule endpoints

Target process flow:

```text
Member or admin creates recurring coaching plan
  -> choose member, coach, frequency, days, time, start date, duration/end date
System previews generated sessions
  -> check coach availability
  -> check existing coach appointment conflicts
  -> check venue/location conflicts only if coaching appointments currently reserve venues
Conflicts found?
  -> no -> allow confirm
  -> yes -> resolve each conflict by skip, reschedule, or swap coach
Confirm plan
  -> create parent recurring plan
  -> create child coaching appointment records
  -> render all sessions in existing Gym Operations schedule
Session selected
  -> if one-off appointment -> use existing review modal behavior
  -> if recurring appointment -> show edit scope picker
Edit scope picker
  -> this session only -> create one appointment exception/reschedule
  -> this and future sessions -> update future generated sessions only
Cancel plan
  -> cancel future non-completed sessions
  -> preserve completed session history
Session completed
  -> existing complete endpoint marks appointment complete
  -> recurring plan progress updates
Plan has more sessions?
  -> yes -> continue normal schedule loop
  -> no -> mark plan completed or allow renewal later
```

Backend MVP:
- add a parent recurring coaching plan model/table
- add nullable `recurring_plan_id` to the existing coaching appointment record used by Gym Operations
- add status fields that distinguish active, paused, cancelled, and completed plans
- add session metadata for generated children:
  - generated from plan
  - skipped
  - individually rescheduled
  - cancelled
  - completed
- separate preview from persistence:
  - preview endpoint must return generated sessions and conflicts without writing plan/session rows
  - confirm endpoint must persist the parent plan and child appointment rows after conflicts are resolved
- add list-plan-sessions endpoint
- add single-session reschedule endpoint for recurring child appointments
- add bulk future update endpoint from a selected session forward
- add cancel-plan endpoint that cancels future non-completed sessions only
- keep existing appointment respond, complete, and cancel endpoints working for child sessions

Suggested endpoint shape:
- `POST /bookings/recurring-coaching-plans/preview`
- `POST /bookings/recurring-coaching-plans`
- `GET /bookings/recurring-coaching-plans/:id/sessions`
- `PATCH /bookings/recurring-coaching-plans/:id/sessions/:sessionId`
- `PATCH /bookings/recurring-coaching-plans/:id/sessions/bulk`
- `PATCH /bookings/recurring-coaching-plans/:id/cancel`

Web MVP:
- add a `Create recurring plan` action inside Gym Operations where coaching appointments are managed
- create a compact plan form:
  - member selector
  - coach selector
  - weekly or biweekly frequency
  - preferred day or days
  - preferred time
  - start date
  - duration: 1 month, 3 months, 6 months, or custom end date
  - computed session count
- add preview/conflict review before confirm
- show recurring sessions in the existing weekly timeline and appointment review modal
- add edit scope picker for recurring sessions:
  - `This session only`
  - `This and future sessions`
- add cancel plan confirmation with sessions completed and sessions remaining
- preserve existing Admin and Staff schedule behavior outside recurring-plan-specific actions

Mobile/member scope:
- first inspect whether mobile coach booking already exists and is backend-wired
- if mobile coach booking exists, wire member recurring plan request/preview to the same backend contracts
- if mobile coach booking does not exist or is incomplete, flag mobile creation as a follow-up and implement web/admin creation first
- member-created recurring plans must appear in web Gym Operations after confirmation

Role rules:
- Admin can create, view, edit single session, edit future sessions, and cancel any recurring coaching plan
- Staff currently has Gym Operations parity with Admin for recurring-plan access in the backend and web flow
- Members are allowed by backend contract to create and view their own recurring plans, but mobile/member creation UI is not currently implemented in the verified mobile surface
- Members should not be able to alter another member's plan

Existing behavior to fix if still present:
- dragging a coach into a calendar slot must not remain local-only if used for persisted scheduling
- dragging an appointment to another slot must persist through a backend reschedule endpoint
- local override state must be replaced or backed by appointment truth before recurring plans rely on it

Deferred unless explicitly approved:
- refund policy automation
- automatic 24h/1h reminders
- coach payroll impacts
- complex custom recurrence rules beyond weekly/biweekly and simple selected days
- venue conflict logic if coaching appointments do not currently reserve venues
- major visual redesign of Gym Operations

Cross-reference:
- generated child sessions must use the same appointment source of truth as existing Gym Operations
- recurring sessions must be visible anywhere existing coach appointments are visible
- notifications should reuse the existing notification pipeline only after plan/session persistence works
- analytics/recent activity should read from persisted appointment events, not from local UI state
- Swagger/OpenAPI, Prisma schema, api-client, and shared types must stay aligned

QA requirements:
- prove preview does not persist rows
- prove confirm creates one parent plan and the correct number of child appointment rows
- prove child sessions appear in the existing schedule endpoints

Recurring payment-flow audit:
- PayMongo is already integrated and should be reused, not rewired.
- Existing PayMongo-backed flows include membership/subscription checkout, membership-card purchase, venue-booking checkout, coaching-appointment downpayment checkout, booking/appointment balance collection, inventory sale checkout, and the shared `/v1/payments/webhook` endpoint.
- Cash/manual payment verification already exists through the shared payments module and Admin/Staff verification flow.
- One-time venue bookings and one-time coach appointments create shared `payments` rows and complete through `payment.completed`.
- Recurring coaching plans now create monthly billing-cycle rows in `recurring_coaching_billing_cycles` when a plan is confirmed.
- Recurring-cycle payments use the shared `payments` table with `payable_type = recurring_coaching`.
- Cash recurring-cycle payment starts as `awaiting_verification`; Admin/Staff approval through the existing payment verification flow marks the cycle paid and confirms that month’s generated sessions.
- PayMongo recurring-cycle payment uses the existing checkout service and shared `/v1/payments/webhook`; completed webhook payment marks the cycle paid and confirms that month’s generated sessions.
- A recurring-billing lifecycle job now cancels/deactivates recurring plans when an unpaid cycle exceeds its 7-day grace window.
- The web recurring appointment review modal now displays billing-cycle amount, due date, paid date, and status for the current plan.
- prove a single-session edit does not change future sessions
- prove a future-series edit does not alter completed or past sessions
- prove cancel preserves completed sessions and cancels only future non-completed sessions
- prove Admin/Staff role access matches the current Staff-parity decision for Gym Operations

---

## 6. Integration-First Master Checklist

Use this checklist after module work is done.

### A. Shared Truth
- [x] Web and mobile use the same backend truth for currently verified shared modules.
- [ ] Shared counts match across module surfaces where they should.
- [ ] Soft-delete vs archive vs pending-review states are consistent.
- [x] Notification rows are created before UI invalidation expects them for verified inventory actions.
- [x] Shared transactions tables are used for manual web sales and mobile/member purchases.
- [ ] Shared check-ins/bookings tables are fully verified across all remaining mobile flows.

### B. Auth / Access / Identity
- [ ] Web login, mobile login, lockout, archive, and suspension logic do not conflict.
- [ ] Accounts created on one surface are usable on the other where expected.
- [ ] Attendance QR is tied to the correct member identity.
- [x] Staff web access now includes the intended Account Module capabilities: view canonical account directory, edit details, and manually check in members; admin remains the superset role in that module.

### C. Notifications
- [x] Mark all read works.
- [x] Single read works.
- [x] Delete works.
- [x] Delete all works in source/client wiring for the web notification panel.
- [x] Inventory cross-module mutations increment unread-count API immediately.
- [x] Header notification bell visually updates after cross-module mutations in browser evidence.
- [x] Cross-module events that should notify actually create inbox rows.
- [x] Account-module management actions now publish notification events in source/build verification, including manual staff/admin check-in.

### D. Inventory / Sales / Analytics Coupling
- [ ] Manual web sales decrement stock for all seeded retail items in the live runtime.
- [x] Member/mobile purchases decrement stock.
- [x] Both channels write to the same sales tables.
- [x] Inventory analytics reads from shared sales truth.
- [x] Analytics revenue includes both manual and mobile channels.
- [x] Restock / archive / update events that should notify actually notify.

### E. Account / Termination Coupling
- [x] Mobile termination request appears in web account review.
- [x] `Termination Requests` isolates pending member requests properly.
- [x] Approve / deny actions move records into the correct next state.
- [x] Analytics active member count uses active membership-card truth and excludes pending termination in the verified local data set.

### E2. Recurring Coaching Plans
- [x] Preview endpoint generates sessions without persisting rows.
- [x] Confirm endpoint creates one parent plan and child appointment rows.
- [x] Child sessions render through the existing Gym Operations schedule endpoints.
- [x] Single-session edit creates an exception without changing future sessions.
- [x] Future-series edit updates only future non-completed sessions.
- [x] Cancel plan preserves completed/past sessions and cancels future non-completed sessions.
- [x] Admin and Staff role access matches the current Staff-parity decision for Gym Operations.
- [x] Mobile/member creation is explicitly deferred; backend member-owned contract exists, but mobile creation UI was not found in the verified mobile surface.

### E3. Payments / PayMongo / Recurring Billing
- [ ] PayMongo checkout can be started from mobile venue booking and redirects to the hosted checkout URL.
- [ ] PayMongo checkout can be started from mobile coach appointment downpayment and redirects to the hosted checkout URL.
- [ ] PayMongo webhook `/v1/payments/webhook` receives the tunnel callback and marks the linked payment `completed`.
- [ ] Completed PayMongo venue-booking payment moves the booking out of pending state and records the paid timestamp.
- [ ] Completed PayMongo coach-appointment downpayment moves the appointment from `pending_payment` to `confirmed` and records `downpayment_paid_at`.
- [ ] Cash venue booking remains pending until Admin/Staff confirms or verifies the payment.
- [ ] Cash coach appointment or balance payment remains pending/awaiting verification until Admin/Staff confirms or verifies it.
- [ ] Admin/Staff payment approval emits the expected notification and updates member payment history from processing/pending to completed.
- [ ] Analytics revenue increases only after a payment is completed/verified, not merely after a pending checkout is created.
- [ ] Membership application/payment approval updates membership-card state and is reflected in member access/payment history.
- [ ] Booking, membership, coach appointment, and PayMongo payment amounts match exactly: total amount, downpayment, balance, provider amount, and analytics amount.
- [x] Recurring coach plans create monthly billing-cycle rows from persisted generated sessions.
- [x] Recurring coach-plan modal displays billing-cycle amount, due date, paid date, and status.
- [x] Recurring coaching billing cycles can start PayMongo checkout through the existing checkout integration.
- [x] Recurring coaching billing cycles can start cash/manual verification through the shared payments module.
- [x] Completed recurring-cycle payments confirm the matching month’s pending generated sessions through the shared `payment.completed` event.
- [x] Recurring coaching revenue includes completed `recurring_coaching` payments in analytics coaching totals and gym-share revenue.
- [x] 7-day overdue auto-cancellation/deactivation is wired through the coaching lifecycle queue.
- [ ] Browser/API proof still needed for a full recurring-cycle PayMongo checkout, webhook completion, monthly session activation, analytics refresh, and 7-day overdue cancellation run.

### F. AI / Export / Reporting
- [x] Analytics export PDF uses real section data.
- [x] AI insight blocks are section-specific.
- [x] Inventory-backed data is included where intended.
- [x] Export route works on the running API, not just in source.

### G. Facilities Media
- [x] Venue image support is represented in the shared venue/facility contracts.
- [x] Floor-plan media endpoints exist in Swagger/source under `/v1/gym-layout`.
- [x] Web facility map surfaces include image upload/edit wiring.
- [ ] Full browser upload proof for venue and floor-plan images is still needed before final release clearance.

### H. Verification Discipline
- [x] Serena/code scan completed before edits.
- [x] Browser evidence captured where tooling allowed.
- [x] Swagger contract checked for touched inventory, notification, analytics, auth, and recurring-plan surfaces where runtime API was available.
- [x] Prisma/DB truth checked for data-sensitive inventory, notification, analytics, and account-count flows.
- [x] Tests/typecheck run where practical and blockers reported honestly.
- [x] API build passed after recurring-coaching billing changes.
- [x] Web typecheck passed in the latest QA pass.
- [x] Mobile typecheck passed in the latest QA pass.
- [ ] API lint is not clean yet; current blocker is existing CRLF/Prettier and unsafe-type errors across API files.

---

## 7. Practical Notes For Future Codex Runs

- Do not ask Codex to rebuild a module from scratch if the current repo already contains the requested feature.
- Prefer prompts that say `verify first, then fix only the missing or broken part`.
- When a Word comment changes product ownership, workflow governance, or IA, treat it as a decision gate.
- When browser tooling is unavailable, do not fake Playwright evidence. Fall back honestly to code + API + DB truth.
- Keep prompts explicit about shared contracts. That is where most FitTrack regressions have come from.
