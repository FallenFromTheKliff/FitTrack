# Gym Operations Page Contract

## Purpose

`Gym Operations` is the merged admin surface for live schedule work, appointment handling, venue usage, and coach-data management.

It owns:

- live appointment and booking operations
- calendar and planning views
- venue and session pressure
- coach profile management as a contained management tab
- coach availability and booking visibility
- coach readiness for member-facing booking

It does **not** own:

- member account management
- milestone moderation
- exercise publishing
- AI chat

## Primary Operators

- admin
- staff

Current product truth:

- there is no separate coach-side admin surface to justify a dedicated route
- coach capabilities are currently delegated to staff and admin accounts
- coach data should be treated as managed profile data inside operations, not as a separate role-first product

## Page Family

`planner / dispatch` with a `roster operations` tab variant

## Genre Fit

Must feel like:

- premium gym operations console
- dispatch and planning surface
- live front-desk operations
- roster-aware scheduling control

Must not feel like:

- pure HR portal
- separate coach back-office
- generic calendar SaaS
- members page with coach labels

## Core Job

Run the gym’s daily operational surface from one place.

That means:

- managing live bookings and appointments
- reviewing coach appointment state
- maintaining coach availability and coach-facing booking readiness
- keeping coach profile data trustworthy enough for member-facing booking

## Top Actions

1. Review and act on coach appointments.
2. View and manage the live schedule.
3. Manage coach availability.
4. Edit coach profile details used in booking.
5. Toggle whether a coach is visible for booking.
6. Inspect coach readiness and current operational load.
7. Review venue and schedule pressure from the same route.

## Primary Objects

- `Appointment`
- `Schedule block`
- `Coach profile`
- `Coach availability`
- `Coach readiness`
- `Venue / resource booking`
- `Operational alert`

## Recommended Initial Tabs

- `Schedule`
- `Manage Coaches`
- `Appointments` if needed as a contained mode instead of a separate page

The exact tab naming can evolve, but coach management should remain a tab or mode inside `Gym Operations`, not a standalone route.

## What Belongs Here

- calendar and schedule workbench
- appointment queue
- coach availability editor
- coach profile edit flow
- coach booking visibility
- roster summary and readiness state
- lightweight coach operational stats

## What Does Not Belong Here

- member CRUD
- coach-side auth or separate coach portal management
- exercise governance
- milestone moderation
- AI training workflow

## MVP Scope

- rename the current schedule concept to `Gym Operations`
- keep the live schedule as the primary tab
- add a `Manage Coaches` tab for coach data
- move coach profile edit and availability management under that tab
- keep appointment actions in the same route
- avoid a separate `Coach Operations` route

## FitTrack-Native Couplings

- reuse the current schedule and appointment seams already in the web route
- reuse the current staff-managed coach availability and profile update contracts
- treat coaches as managed profiles, not as a separate admin role experience
- keep the route operational-first: schedule remains primary, coach management remains contained

## Relationship To Neighboring Pages

- `Members`: should not own coach management
- `Exercise Lab`: unrelated
- `Overview`: can summarize operational counts, but not own the workflow
- `Gym Operations`: becomes the single operational home for schedule + coach data

## Data And Code Seams

Current nearby seams already exist in:

- `packages/validators/coaching.ts`
- `packages/api-client/domains/coaches.ts`
- `packages/api-client/domains/staff.ts`
- `packages/query/staff.ts`
- `apps/web/app/(admin)/schedule/page.tsx`
- `apps/web/components/modals/CoachAvailabilityModal.tsx`
- `apps/web/components/modals/StaffDetailsModal.tsx`

This means the merged route is not greenfield. The code already behaves like a partial `Gym Operations` page; we are simply naming and structuring it correctly now.

## UI Shape Guidance

- `Schedule` remains the primary tab and first-glance surface
- `Manage Coaches` should be a quieter operational tab, not a competing page jammed beside the calendar
- coach editing should stay in contained modals/sheets
- the route should read as one unified operations console, not two unrelated apps sharing a header

## Risks To Avoid

- over-separating coach management into another fake route
- making the coach tab visually dominate the schedule
- pretending the product has a real coach-side portal when it does not
- bloating the route into a mini-suite with too many equal-weight modes

## Recommended Implementation Order

1. Rename the route concept and labels from `Schedule` / `Staff Schedule` to `Gym Operations`.
2. Keep the current live schedule as the primary tab.
3. Contain coach data management under a `Manage Coaches` tab.
4. Rework the route shell and hierarchy so the coach tab feels secondary but first-class.
5. Then do the premium Figma and implementation pass against the merged route.

## Page-By-Page Handoff Rule

After this contract is accepted, the next step should be the normal page-level premium flow:

1. page contract locked
2. references for this merged route only
3. Notion review packet
4. Figma concept and scaffold
5. later implementation

`Gym Operations` is now the next route-level proving ground after `Exercise Lab`.
