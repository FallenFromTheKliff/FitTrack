# Integration Driver Page-First Surface Flow

Use this file for the default page-first cross-platform integration flow.

## Goal

Complete selected surface page bundles end to end while preserving continuous autonomous progress.
For each selected surface, drive the work from the live surface page, include required web and mobile companions when manifest parity says so, resolve gaps using the repo-local integration skills, verify the bundle through direct API checks plus Swagger and Playwright, sync the surface pages and any linked domain artifacts, and then continue to the next actionable surface unless a true global blocker stops the run.

The active flow is surface-based:

- `audit`
- `resolve`
- `verify`
- `blocked`
- `sync`

## Completion QA Rubric

Every selected surface bundle must be judged with page-completion QA, not only contract health.

Required categories:

- `Affordance gaps`
  - dead buttons
  - missing click handlers
  - buttons that open nothing
  - placeholders that should be hidden or completed
- `Flow gaps`
  - missing modal or confirm steps
  - broken close, cancel, or return paths
  - actions with no visible success or failure state
  - actions that leave the page in an inconsistent state
- `Data usability gaps`
  - obviously missing or broken sort and filter controls
  - wrong default sort
  - unusable chips or labels
  - data that renders but cannot be meaningfully acted on
- `Async state gaps`
  - missing loading, empty, error, retry, submit-pending, or disabled states
- `Contract-to-UI gaps`
  - fields mapped but surfaced poorly
  - enum or status values shown unclearly
  - pagination ignored
  - role-specific data shown without role-specific UI treatment
- `Parity gaps`
  - one platform works while the paired platform remains clearly partial or divergent

Every finding must be classified as exactly one of:

- `autofix_now`
  - decision-safe and directly implied by the current page intent
  - must be fixed in the same run before the surface can close
- `blocked_external`
  - external dependency or environment issue
  - must be written to the blocked area and may be skipped so the run can continue
- `blocked_hard`
  - true blocker needing durable follow-up
  - requires a linked task or explicit blocked surface bundle entry
- `product_followup`
  - non-trivial product decision or net-new capability
  - must not be silently invented by the run

## Driver Inputs

Read these values from `tasks/integration-builder/integration-driver.md`:

- `RUN_MODE`
- `SURFACE_SELECTION_MODE`
- `FOCUS_SURFACE_PAGE_TITLE`
- `FOCUS_SURFACE_PAGE_ID`
- `SURFACE_PLATFORM_SCOPE`
- `AUTO_FIX_SCOPE`
- `RUNTIME_MODE`
- `SOFT_BLOCK_RECHECK`
- `MAX_SELF_HEAL_ATTEMPTS_PER_SURFACE`
- `STATE_ACTIVE_SURFACE`
- `STATE_ACTIVE_COMPANION_SURFACES`
- `STATE_ACTIVE_PHASE`
- `STATE_ACTIVE_DOMAIN_TASK`
- `STATE_LAST_COMPLETED_SURFACE`
- `STATE_STOP_REASON`

## Surface Selection

Selection is controller-first:

1. if `SURFACE_SELECTION_MODE = single_surface`, resolve the exact surface page from `FOCUS_SURFACE_PAGE_ID` or `FOCUS_SURFACE_PAGE_TITLE`
2. if `SURFACE_SELECTION_MODE = next_incomplete_surface`, choose the next actionable surface from `Surface Verification Tracker` and the checked-in manifest, then repeat after every completed, deferred, or blocked bundle until no actionable surface remains
3. if `SURFACE_SELECTION_MODE = resume_active`, resume `STATE_ACTIVE_SURFACE` first
4. if `SURFACE_PLATFORM_SCOPE = auto`, use manifest fields such as `parityGroup`, `parityRequired`, and `verificationMode` to decide whether the selected surface requires companions
5. if `SURFACE_PLATFORM_SCOPE = web_only` or `mobile_only`, override the manifest and record the override reason in `Decision Log`
6. if `SURFACE_PLATFORM_SCOPE = cross_surface`, require every manifest companion in the parity group

## Continuous Execution Rules

Use these run-continuation rules:

1. `single_surface` stops after the selected bundle reaches `done`, `deferred_external`, or `blocked`
2. `resume_active` stops after the resumed bundle reaches `done`, `deferred_external`, or `blocked`
3. `next_incomplete_surface` is continuous:
   - when a bundle reaches `done`, sync it and immediately select the next actionable surface
   - when a bundle reaches `deferred_external`, write it into the blocked area, sync it, and continue to the next actionable surface
   - when a bundle reaches `blocked`, write the evidence, create or refresh any required linked domain task, sync it into the blocked area, and continue to the next actionable surface when a safe continuation remains
4. stop the entire run only for global blockers such as Notion unavailability, MCP parity failure, runtime unreachability that affects the whole run, or an unresolved product or security ambiguity
5. when `SOFT_BLOCK_RECHECK = yes`, recheck earlier blocked or deferred bundles later in the same continuous run only when the blocker appears transient or environmental

## Boundary Rehydration

At the start of every selected surface bundle, and again before any continuation after a blocker or restart:

1. activate Serena and read relevant Serena memories
2. rerun `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
3. fetch `Surface Verification Tracker`, the selected surface page, any required companion surface pages, `External Config Registry`, and only the linked `Domain - <domain>` pages or `Task - <domain> - <fix-slug>` pages needed for the current scope
4. if the surface bundle is DB-relevant, use Prisma MCP before relying on runtime symptoms
5. before the `verify` phase, rerun `tasks/integration-builder/integration-preflight.cmd -Mode runtime`
6. if runtime preflight fails only because the required host surfaces are down and `RUNTIME_MODE = attach_manual`, allow bounded recovery through `tasks/integration-builder/integration-host-start.cmd`, then rerun runtime preflight once before blocking the bundle

## Bundle Handling

The surface pass is page-driven, but it may contain multiple surfaces.

Use bundles like this:

1. start from the selected surface page
2. load required companions from manifest parity metadata
3. build one combined gap report with per-surface sections
4. keep one bundle-level stop boundary
5. do not close a cross-surface feature until every required surface has been audited, resolved, verified, and synced or is explicitly blocked with evidence
6. do not close a bundle while any `autofix_now` completion QA finding remains open

## Surface Phases

### `audit`

Do this:

1. set `STATE_ACTIVE_SURFACE` to the selected surface page and `STATE_ACTIVE_PHASE = audit`
2. set `STATE_ACTIVE_COMPANION_SURFACES` from the manifest bundle or to `none`
3. refresh repo truth against the selected surface page, companion surface pages, manifest metadata, linked domain pages, and linked task pages
4. inspect:
   - route files
   - primary components
   - shared query and API-client modules
   - direct backend routes, DTOs, services, and repositories touched by the feature
5. identify:
   - missing endpoints or backend seams
   - sorting, filtering, mapping, modal, loading, empty, or error-state gaps
   - role or auth mismatches
   - parity gaps between web and mobile for the same feature
   - reusable, cross-domain, or structurally large work that should become a linked task page
6. classify each gap as `autofix_now`, `blocked_external`, `blocked_hard`, or `product_followup`
7. write the combined gap report into the selected surface page and update companion surface pages as needed
8. write a dedicated `Completion QA` subsection covering:
   - visible primary actions
   - modal triggers
   - filter and sort usability
   - role-conditioned UI differences
   - obvious parity mismatches
9. if any decision-safe completion gap exists, treat it as `autofix_now` and do not consider the surface complete yet
10. if no actionable gap remains, move directly to `verify`
11. otherwise set `STATE_ACTIVE_PHASE = resolve`

### `resolve`

Do this:

1. use the repo-local `integration` skill as the orchestrator
2. route missing backend or contract work through the repo-local `backend` skill
3. route web and mobile UI or shared-client work through the repo-local `frontend` skill
4. fix local blockers plus obvious decision-safe UX and contract gaps according to `AUTO_FIX_SCOPE`
   - required `autofix_now` work includes obvious page-completion gaps such as dead actions, broken modals, missing state handling, and clearly incomplete filters or sort behavior
5. keep the selected surface page as the main execution record
6. create or refresh a linked `Task - <domain> - <fix-slug>` page only when the work is reusable, cross-domain, structurally large, or blocked
7. when subagents are used:
   - keep one orchestrator in the main chat
   - give each worker a bounded scope
   - keep overlapping write scopes serialized
8. run focused code checks before leaving the phase
9. set `STATE_ACTIVE_PHASE = verify`

### `verify`

Do this in order:

1. rerun runtime preflight
2. when TypeScript files were touched, rerun `tasks/integration-builder/integration-no-explicit-any.cmd <touched-ts-files...>` before runtime verification
3. run direct API checks first for the selected surface bundle
4. use Swagger only after direct API checks pass or when the live contract still needs confirmation
5. use Playwright last for every surface required by the bundle's `verificationMode`
6. confirm that every visible primary action, modal trigger, filter, and role-sensitive flow on the selected surface is either:
   - working
   - intentionally hidden
   - explicitly documented as blocked with evidence
7. record direct API, Swagger, Playwright, and completion-QA evidence separately on the selected surface page and any required companion surface pages
8. if verification reveals more decision-safe work or any remaining `autofix_now` item, return to `resolve`
9. if verification reveals a blocker that cannot be safely fixed in the current bundle, set `STATE_ACTIVE_PHASE = blocked`
10. otherwise set `STATE_ACTIVE_PHASE = sync`

### `blocked`

Do this:

1. capture the explicit blocker, evidence, attempted fixes, and continuation decision on the selected surface page
   - classify the blocker as `blocked_external` or `blocked_hard`
2. update `Companion Surface Status` for any required companion surfaces
3. create or refresh a linked `Task - <domain> - <fix-slug>` page when the blocker needs durable follow-up
4. update `Task Queue` and `Blocked Task References` only when a real linked domain task exists
5. add or refresh the blocked bundle entry in the root tracker `Blocked Surface Bundles` section
6. set `STATE_STOP_REASON` to the blocker summary
7. if `SURFACE_SELECTION_MODE = next_incomplete_surface` and no global blocker exists, continue to `sync` and then move on to the next actionable surface
8. otherwise stop after `sync`

### `sync`

Do this:

1. update the selected surface page:
   - `Execution State`
   - `Gap Report`
   - `Completion QA`
   - `Integration Plan`
   - `Applied Fixes`
   - `Direct API Evidence`
   - `Swagger Contract Evidence`
   - `Playwright Evidence`
   - `Companion Surface Status`
   - `Decision Log`
   - `Next Resume Step`
2. update companion surface pages when they were part of the bundle
3. update linked domain pages and linked task pages when reusable or blocked work was involved
4. update `Task Queue` only when a real linked domain task exists
5. update the root tracker:
   - completed bundles belong in the normal surface rollups
   - blocked or deferred bundles belong in `Blocked Surface Bundles`
6. update local state:
   - `STATE_LAST_COMPLETED_SURFACE`
   - clear `STATE_ACTIVE_DOMAIN_TASK` when appropriate
   - set `STATE_ACTIVE_PHASE = done` for completed bundles
   - keep the blocker summary in `STATE_STOP_REASON` for blocked bundles until the next bundle starts

## Linked Domain Task Rules

Create or refresh a linked domain task only when:

- the fix is reusable across multiple surfaces
- the fix is clearly owned by another domain
- the work is structurally large enough that it should not live only on the surface page
- the work is blocked and needs durable follow-up

Do not create a linked domain task for every page-local sort, filter, modal, or empty-state fix.

## Completion Rule

The selected surface bundle is complete only when:

- the selected surface page contains the current execution-state and evidence sections
- every required companion surface is either verified or explicitly blocked with evidence
- direct API checks pass for the attempted bundle
- Swagger confirmation exists when the live contract was part of the change
- Playwright evidence exists for every required web or mobile surface in the bundle
- linked domain pages and linked task pages were updated when reusable or blocked work was involved
- local state was rewritten consistently before the run stops
- no `autofix_now` completion-QA finding remains open on the selected bundle

For `SURFACE_SELECTION_MODE = next_incomplete_surface`, the continuous run is complete only when:

- no actionable surface remains in `Surface Verification Tracker` for the configured scope
- remaining unresolved surfaces are already recorded as blocked or deferred with evidence
- no selected surface still has open `autofix_now` completion-QA findings
- the blocked area and any linked domain-task follow-ups are up to date
- local state was rewritten consistently before the run stops
