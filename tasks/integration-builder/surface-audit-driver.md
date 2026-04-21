# Surface Audit Driver

Use this file as the stable entrypoint for whole-manifest bootstrap, tracker reconciliation, and guardrail recovery across the current web and Expo-web mobile surfaces.
Day-to-day integration now belongs in `tasks/integration-builder/integration-driver.md`. Use this audit driver when you need to refresh the checked-in manifest, backfill or reconcile `Surface Verification Tracker`, run a broad audit sweep, or recover drift across many surfaces at once.

Tell Codex:

```text
Read tasks/integration-builder/surface-audit-driver.md and run the configured whole-surface audit and reconciliation pass end to end. Refresh the checked-in manifest truth, reconcile Surface Verification Tracker for web and mobile Expo-web surfaces, verify each surface according to the configured scope, fix manifest or tracker drift plus obvious implementation defects, hand off ordinary page-first integration work to integration-driver.md or linked domain tasks when needed, treat PayMongo as temporarily disabled, sync Notion and local state, and stop only when the configured audit scope is complete or a real non-PayMongo blocker remains.
```

Do not use this driver for normal one-page integration corrections such as sorting fixes, filter drift, missing modals, missing endpoint consumers, or parity cleanup on a selected feature. Those now belong to the page-first integration driver.

---

## Audit Controller Variables

Edit these values before starting a chat:

- `AUDIT_PLATFORMS:` `web,mobile_web`
- `AUDIT_SCOPE:` `full_surface_inventory`
- `PAYMONGO_MODE:` `disabled`
- `REFACTOR_SCOPE:` `touched_plus_hotspots`
- `NOTION_PARENT_PAGE_TITLE:` `System Gap Analysis`
- `NOTION_TRACKER_TITLE:` `Surface Verification Tracker`
- `MAX_SELF_HEAL_ATTEMPTS_PER_SURFACE:` `2`

### Controller Meaning

- `AUDIT_PLATFORMS` controls which surface families are scanned in the run.
- `AUDIT_SCOPE = full_surface_inventory` means the run must use the full checked-in manifest, not an ad hoc subset.
- `PAYMONGO_MODE = disabled` means any client-initiated PayMongo start must short-circuit locally and show the temporary-unavailable modal instead of attempting checkout.
- `REFACTOR_SCOPE = touched_plus_hotspots` means:
  - always clean touched files
  - also clean already-oversized files in the active surface path
  - record, but do not automatically refactor, unrelated repo hotspots

---

## System-Managed State

Do not manually edit these values during normal execution.

- `STATE_ACTIVE_PLATFORM:` `none`
- `STATE_ACTIVE_SURFACE:` `none`
- `STATE_ACTIVE_PHASE:` `done`
- `STATE_LAST_COMPLETED_SURFACE:` `mobile-settings`
- `STATE_REMAINING_SURFACE_COUNT:` `0`

### State Meaning

- `STATE_ACTIVE_PLATFORM` is the current platform family being processed.
- `STATE_ACTIVE_SURFACE` is the current manifest surface id being processed.
- `STATE_ACTIVE_PHASE` must be one of:
  - `scan`
  - `inventory`
  - `verify`
  - `fix`
  - `reverify`
  - `sync`
  - `blocked`
  - `done`
- `STATE_LAST_COMPLETED_SURFACE` is the most recent manifest surface id completed in the run.
- `STATE_REMAINING_SURFACE_COUNT` is the count of manifest surfaces not yet closed for the current run.

---

## Canonical Inputs

Load and obey these sources before scanning:

1. `tasks/integration-builder/surface-audit/surface-manifest.json`
2. `tasks/integration-builder/surface-audit/guardrail-drift-scan.mjs`
3. `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
4. `tasks/integration-builder/integration-preflight.cmd -Mode runtime`
5. Existing runtime sources of truth used by the manifest:
   - `packages/app-config/web-labels.ts`
   - `packages/app-config/mobile-labels.ts`
   - `apps/web/lib/portal-access.ts`
   - `apps/mobile/contexts/AuthContext.tsx`
   - route-level branching on `members`, `schedule`, `bookings`, and `profile`

Load `tasks/integration-builder/integration-driver.md` only when the audit finds ordinary page-first work that should be handled as a selected surface run instead of a broad sweep.

Do not invent surfaces outside the manifest unless the repo itself gained a new current route that the manifest must be refreshed to include.

---

## Audit Flow

Run each manifest surface through this exact sequence:

1. `scan`
   - read the route file
   - read the primary components listed in the manifest
   - verify manifest metadata including owning domain, parity fields, verification mode, preferred MCP hints, and primary query or API seams
2. `inventory`
   - create or update the matching Notion child page
   - ensure the surface page contains the required execution sections used by the page-first integration flow
   - write the feature and action inventory before test execution
3. `verify`
   - run direct API checks first when the surface depends on live backend behavior
   - run Playwright on web or Expo-web for the main happy path according to the manifest `verificationMode`
   - run at least one access-control check when the surface is role-gated or role-sensitive
4. `fix`
   - fix manifest drift, tracker drift, and obvious implementation defects discovered by verification
   - if the issue is a normal selected-surface integration correction, hand it off to `tasks/integration-builder/integration-driver.md`
   - if the issue is reusable, cross-domain, structurally large, or blocked, create or refresh the matching `Task - <domain> - <fix-slug>` page and link it from the surface page
5. `reverify`
   - rerun the same API and browser checks for the changed surface
6. `sync`
   - update the surface page
   - update the root tracker page
   - update any linked domain or task pages
   - update the local state above

Move to the next manifest surface only after the current one is either:
- complete
- explicitly deferred because of `PAYMONGO_MODE = disabled`
- blocked by a real non-PayMongo blocker with evidence

---

## Role And Access Rules

Use current implementation access, not future product intent, as the audit source of truth.

Required negative paths:
- member credentials must fail web portal access
- admin and staff credentials must fail mobile app access

Treat these as role-conditioned or role-sensitive surfaces even when multiple roles may enter them:
- `web-members`
- `web-schedule`
- `web-profile`
- `mobile-bookings`
- `mobile-profile`

For role-conditioned surfaces, document both:
- the roles that can reach the surface
- the role-specific behavior differences inside that shared surface

---

## Notion Tracker Contract

The audit tracker lives under `NOTION_PARENT_PAGE_TITLE` and remains separate from the domain and task structure.

Root page:
- title from `NOTION_TRACKER_TITLE`
- sections:
  - `Run Status`
  - `Accessibility Overview`
  - `Web Surfaces`
  - `Mobile Expo-Web Surfaces`
  - `Blocked Surface Bundles`
  - `Guardrail Drift Register`
  - `Deferred External Constraints`

Child pages:
- one child page per manifest surface
- naming pattern:
  - `Surface - web - <slug>`
  - `Surface - mobile-web - <slug>`

Each child page must record:
- platform
- route
- label
- current allowed roles
- conditional-role notes
- owning domain
- secondary domains
- parity group
- parity required
- verification mode
- preferred MCP hints
- primary API tags
- primary query modules
- role sensitive
- key user-visible actions
- key queries and mutations
- backend dependencies
- paymongo dependent: yes or no
- verification status
- findings
- linked domain or task page
- `Future Role Policy`
  - default value: `undecided`

Ensure each child page also contains the durable execution sections used by the page-first integration driver:
- `Execution State`
- `Gap Report`
- `Integration Plan`
- `Applied Fixes`
- `Direct API Evidence`
- `Swagger Contract Evidence`
- `Playwright Evidence`
- `Linked Domain Tasks`
- `Companion Surface Status`
- `Decision Log`
- `Next Resume Step`

Group the root rollup by current implementation accessibility:
- `public`
- `admin_staff`
- `admin_only`
- `user_coach`
- `user_only`
- `role_conditioned`

---

## Guardrail Recovery Rules

Before surface verification, refresh the repo drift snapshot with:

```text
node tasks/integration-builder/surface-audit/guardrail-drift-scan.mjs --write
```

Use the snapshot and live repo truth together.

Hard gates:
- route files at or below `100` lines before a surface closes
- non-route UI components targeted to `100` lines and refactored when `150+` or obviously mixed
- backend, controller, service, repository, and DTO files extracted when `250+` with mixed concerns or when one change causes large blended growth
- noticeable lag in shared navigation interactions such as mobile sidebar, tab, header, and overlay route changes is a blocking UX defect, not a minor cosmetic issue
- when a navigation control changes routes, avoid stacking modal close, overlay animation, and synchronous route replacement in one blocking interaction if a non-blocking route transition is available
- do not fire avoidable heavy screen-entry work in the same interaction tick as a shared navigation route switch

During this audit pass:
- always clean touched files
- also clean already-oversized files that are directly on the current surface path
- do not widen into a full repo cleanup
- record unrelated hotspots in the tracker instead of automatically refactoring them

---

## PayMongo Disabled Mode

When `PAYMONGO_MODE = disabled`:

- do not attempt live PayMongo initiation from the client
- show the temporary-unavailable modal before any checkout-start network call
- mark the surface as `deferred_external`, not hard-blocked
- keep public return pages documented and render-verified, but do not require live checkout proof

The current repo still treats PayMongo as a real dependency for some backend flows.
