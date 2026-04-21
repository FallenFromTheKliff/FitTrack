# Integration Driver Autonomous Domain Flow

This file remains at the existing path for continuity, but it is now the legacy fallback flow used only when `RUN_MODE = integrate_domain_journeys_legacy`.
The page-first surface flow in `13-run-mode-integrate-surface-pages.md` is the default day-to-day integration path.

## Goal

Complete the configured preset domain by domain when the operator intentionally chooses the legacy fallback mode.
For each selected domain, drive the work from real journeys, seed the required owned tasks, execute those tasks sequentially, verify the domain end to end, and then move on to the next configured domain.

The active flow is domain-based, not page-based:

- `review`
- `seed`
- `implement`
- `test`

Journeys still drive discovery and evidence, but they no longer define the chat stop boundary.
The normal stop boundary is the configured preset.

## Driver Inputs

Read these values from `tasks/integration-builder/integration-driver.md`:

- `EXECUTION_PRESET`
- `DOMAIN_BATCH`
- `FOCUS_DOMAIN`
- `SOFT_BLOCK_RECHECK`
- `MAX_SELF_HEAL_ATTEMPTS_PER_DOMAIN`
- `STATE_ACTIVE_DOMAIN`
- `STATE_NEXT_DOMAIN`
- `STATE_DOMAIN_PHASE`
- `STATE_ACTIVE_TASK_PAGE`
- `STATE_LAST_COMPLETED_DOMAIN`

## Preset Selection

Preset selection is controller-first:

1. if `EXECUTION_PRESET = batch_3_domains`, resolve the ordered target set from `DOMAIN_BATCH`
2. if `EXECUTION_PRESET = single_domain`, resolve the ordered target set to only `FOCUS_DOMAIN`
3. do not rewrite `DOMAIN_BATCH`, `FOCUS_DOMAIN`, or `EXECUTION_PRESET` during the run
4. use `STATE_ACTIVE_DOMAIN` when it is set and still valid for the configured preset
5. otherwise start from `STATE_NEXT_DOMAIN`
6. if `STATE_NEXT_DOMAIN = done`, the configured preset is already exhausted locally and the run should stop until the operator chooses the next preset

For `batch_3_domains`, the configured preset is complete only when all 3 listed domains are complete or a real hard blocker stops the active domain with no independently actionable same-domain continuation.

For `single_domain`, the configured preset is complete only when the focus domain is complete or hard-blocked.

## Boundary Rehydration

At the start of every selected domain, and again before any same-domain continuation after a blocker or restart:

1. activate Serena and read relevant Serena memories
2. rerun `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
3. fetch `System Architecture Shape`, `External Config Registry`, `Task Queue`, `Blocked Task References`, the selected `Domain - <domain>` page including its execution sections, and the relevant journey pages
4. create or refresh missing journey pages when they are needed for a real business outcome in the active domain
5. if the domain is DB-relevant, use Prisma MCP before relying on runtime symptoms
6. before the domain `test` phase, rerun `tasks/integration-builder/integration-preflight.cmd -Mode runtime`
7. if runtime preflight fails only because required host surfaces are down, run `tasks/integration-builder/integration-host-start.cmd`, then rerun runtime preflight once before blocking the domain

Do not trust prior chat memory for domain continuation when Notion already carries the execution history.

## Journey Handling Inside A Domain

The domain pass is still journey-driven, but the domain owns the stop boundary.

Use journeys like this:

1. review the domain `Journey Inventory` against current repo truth
2. create or refresh the journey pages that matter for the active domain outcome
3. use those journeys to identify required domain-owned gaps, env blockers, optional deferred work, and cross-domain ownership
4. during domain testing, write fresh `Integrated Now`, `Direct API Evidence`, and `Playwright Evidence` back to the affected journeys

Do not stop the full domain only because one journey page is blocked when another journey or seeded task in that same domain is still actionable.

## Domain Phases

### `review`

Do this:

1. set `STATE_ACTIVE_DOMAIN` to the selected domain and `STATE_DOMAIN_PHASE = review`
2. refresh the domain `Page Inventory` and `Journey Inventory` against repo truth
3. inspect the domain page, relevant journey pages, current backlog tasks, current `Task Queue` rows, runtime dependencies, and cross-domain references
4. identify:
   - required domain-owned work
   - cross-domain work that must be referenced but not owned here
   - env-only blockers
   - payment-coupled deferred verification slices that should become real blocked task pages instead of stopping the preset
   - optional or deferred work that must not become a real task now
5. update the domain page sections that summarize the current repo truth and required follow-up gaps
6. if the domain already has no unresolved required owned work and no remaining owned backlog tasks, move directly to `test`
7. otherwise set `STATE_DOMAIN_PHASE = seed`

### `seed`

Do this:

1. create or refresh real owned `Task - <domain> - <fix-slug>` pages for every required domain-owned gap that still needs explicit implementation work
2. write `Review` and `Plan` immediately into each new or refreshed task page so the task is implementation-ready by default
3. set seeded or refreshed owned backlog task pages to:
   - `status = planned`
   - `current phase = implement`
   - `execution bucket = backlog`
4. order those owned tasks into `Sequential Execution Plan` in dependency-safe order
5. place those owned tasks into `Backlog Tasks`
6. write cross-domain follow-up work only under the owning domain and add references in `Cross-Domain Task References` when needed
7. record env-only blockers on the domain page, the relevant journey pages, and `External Config Registry` instead of seeding implementation tasks for them
8. exception: when a payment or checkout path is real domain-owned work but external payment config such as `PAYMONGO_*` is intentionally deferred, create or refresh a real blocked `Task - <domain> - <fix-slug>` page for that verification slice, mark it `task status = blocked`, add it to `Blocked Task References`, and keep non-payment work moving
9. if no owned backlog tasks remain after seeding, move directly to `test`
10. otherwise set `STATE_DOMAIN_PHASE = implement`

### `implement`

Do this:

1. select the active task inside the domain using this order:
   - the one owned task already listed in `Active Tasks`
   - otherwise the first ready owned task from `Backlog Tasks` in dependency-safe order
2. set `STATE_ACTIVE_TASK_PAGE` to that task
3. if the selected task is a legacy page that still lacks durable `Review` or `Plan` content, backfill those sections before implementation
4. implement only the selected fix for that task
5. copy the closest existing backend, shared-package, DTO, validator, controller, and query pattern first; only fall back to `agents/architecture.md` when the repo does not already show a clear local pattern
6. when the task touches frontend page or UI work, keep each route file thin and at or below 100 lines, reuse existing app components first, and move missing presentation into shared component files instead of page-local markup; if a touched route still exceeds 100 lines, stop and refactor before the task may move to `test` or `done`
7. keep frontend integration work theme-compatible by using the existing theme context, tokens, and style factories; do not hardcode colors or build light-only UI that breaks under another theme
8. when TypeScript files were touched, run `tasks/integration-builder/integration-no-explicit-any.cmd <touched-ts-files...>` and stop the task if it reports explicit `any`
9. before marking the task complete, sanity-check the touched files against the refactor guardrails: route files at or below 100 lines, non-route UI components kept compact unless explicitly justified, and backend/API files extracted when a single task caused large mixed-responsibility growth
10. after each task implementation, run the focused code checks and direct verification that belong to that task before marking it complete
11. update the task page, domain page, `Task Queue`, and `Blocked Task References` after every task state change
12. continue sequentially inside the same domain until:
   - the owned backlog is clear, then move to `test`
   - or the domain becomes hard-blocked with no independently actionable same-domain continuation, then set `STATE_DOMAIN_PHASE = blocked` and stop

### `test`

Do this in order:

1. set `STATE_DOMAIN_PHASE = test` and `STATE_ACTIVE_TASK_PAGE = none` unless one specific task is still needed as context
2. rerun runtime preflight
3. when TypeScript files were touched in the active domain pass, rerun `tasks/integration-builder/integration-no-explicit-any.cmd <touched-ts-files...>` before runtime verification
4. run direct API checks first for the representative journeys and updated task surfaces in the active domain
5. use Swagger only after direct API checks pass or when the live contract still needs confirmation
6. use Playwright last for the required web and mobile Expo-web surfaces that belong to the active domain outcome
7. update the relevant journey pages:
   - `Integrated Now`
   - `Direct API Evidence`
   - `Playwright Evidence`
   - `Required Follow-Up Gaps`
   - `Next Resume Step`
8. update the domain page:
   - `Integrated Now`
   - `Blocked By Env Or Dependency`
   - `Required Follow-Up Gaps`
   - `Execution State`
   - `Done Tasks`
9. keep `Blocked Task References` aligned with every task page whose `task status = blocked`
10. if the domain is complete:
   - set `STATE_LAST_COMPLETED_DOMAIN` to the current domain
   - advance `STATE_NEXT_DOMAIN` to the next domain in the configured preset or `done`
   - set `STATE_ACTIVE_DOMAIN = none`
   - set `STATE_DOMAIN_PHASE = done`
11. if the domain is hard-blocked with no same-domain continuation:
   - set `STATE_DOMAIN_PHASE = blocked`
   - keep the concrete stop reason in the domain page and relevant task or journey pages
   - stop the run

Special rule for deferred external payment blockers:

- if the only remaining unresolved work in the domain is payment-coupled verification blocked by intentionally deferred external config such as `PAYMONGO_SECRET_KEY`
- and the non-payment domain outcomes are already integrated and verified
- then seed or refresh the real blocked payment task, update `Task Queue`, `Blocked Task References`, the domain page, and `External Config Registry`
- then treat the domain as complete for preset-advancement purposes and move to the next configured domain instead of stopping the whole batch

## Domain Completion Rule

The active domain is complete only when:

- the domain page and the relevant journey pages are updated through the active pass
- env-only blockers are recorded as dependency notes, not implementation tasks
- deferred external payment blockers may remain as real blocked task pages when they represent future owned verification work and the remaining non-payment domain outcomes are already verified
- required domain-owned work has been seeded, implemented, and verified, or explicitly blocked with evidence
- `Task Queue` reflects the correct `execution bucket`, `current phase`, `task status`, and block reason for the owned tasks
- domain execution sections reflect the correct `Active`, `Backlog`, `Done`, and cross-domain-reference state
- direct API checks pass for the journeys attempted in this domain pass
- Playwright web and mobile checks pass or are explicitly blocked with artifact evidence when those surfaces belong to the active domain outcome
- `STATE_LAST_COMPLETED_DOMAIN`, `STATE_NEXT_DOMAIN`, and `STATE_DOMAIN_PHASE` are rewritten consistently before the run advances or stops
- `Next Resume Step` is explicit on the relevant domain, journey, or blocked task surfaces
