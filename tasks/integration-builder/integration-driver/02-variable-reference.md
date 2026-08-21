# Integration Driver Variable Reference

Use this file when you need the allowed values, safety limits, reset rules, or resume meanings for `tasks/integration-builder/integration-driver.md`.

## Allowed `RUN_MODE` Values

- `integrate_surface_pages` -> run the page-first cross-platform surface flow
- `integrate_domain_journeys_legacy` -> use the older domain-first preset flow

`integrate_surface_pages` is the default.

## `SURFACE_SELECTION_MODE` Rules

- `single_surface` -> use the exact `FOCUS_SURFACE_PAGE_TITLE` or `FOCUS_SURFACE_PAGE_ID`
- `next_incomplete_surface` -> choose the next actionable surface from `Surface Verification Tracker` and manifest metadata
- `resume_active` -> resume `STATE_ACTIVE_SURFACE` or the matching surface page execution state

Use `single_surface` when the operator knows the exact page.
Use `next_incomplete_surface` for unattended day-to-day work.

## `FOCUS_SURFACE_PAGE_TITLE` And `FOCUS_SURFACE_PAGE_ID` Rules

- used only when `SURFACE_SELECTION_MODE = single_surface`
- prefer `FOCUS_SURFACE_PAGE_ID` when the exact page already exists and the title may drift
- use `FOCUS_SURFACE_PAGE_TITLE` when the operator is selecting by name
- use `none` for both when `SURFACE_SELECTION_MODE` is not `single_surface`

## `SURFACE_PLATFORM_SCOPE` Rules

- `auto` -> use manifest parity metadata to decide whether the run stays single-platform or becomes cross-surface
- `web_only` -> verify only the web surface even if a companion mobile surface exists
- `mobile_only` -> verify only the mobile Expo-web surface even if a companion web surface exists
- `cross_surface` -> require both web and mobile companion surfaces

Use `auto` by default.

## `AUTO_FIX_SCOPE` Rules

- `blocking_plus_obvious` -> fix blockers plus decision-safe UI or contract gaps such as sorting, filtering, modal, loading, empty, error, and mapping drift
- `blocking_only` -> fix only blockers and record smaller UI or contract issues for later

Use `blocking_plus_obvious` by default.

## `RUNTIME_MODE` Rules

- `attach_manual` -> assume the operator-managed watcher stack already owns API, web, and mobile
- `managed_recovery` -> use `integration-host-start.cmd` as fallback recovery when manual attachment fails

Use `attach_manual` by default.

## `NOTION_PARENT_PAGE_TITLE` Rules

- use the Notion parent page that owns the shared baselines, trackers, and domain pages
- default: `System Gap Analysis`

## `SOFT_BLOCK_RECHECK` Rules

- `yes` -> retry older tool-only, session-only, or env-only-looking blockers after fresh preflight before honoring the blocked state
- `no` -> trust the recorded blocked state and stop sooner

Use `yes` by default.

## `MAX_SELF_HEAL_ATTEMPTS_PER_SURFACE` Rules

- counts bounded recovery attempts after a failed runtime verification or implementation mismatch during one surface bundle
- use `2` by default so the run can fix one real issue and retry once more
- do not spend the retry budget on missing Notion access or MCP drift; stop early instead

## `MODULE_HINTS` Rules

- list the repo paths most likely to be relevant to the active integration work
- keep them broad enough to cover the shared contract spine and the likely app surfaces
- update them only when the repo layout changes materially

## System-Managed State Rules

These values are worker-owned during normal execution.
Do not edit them manually unless you are intentionally resetting a run or recovering from malformed local state.

### `STATE_ACTIVE_SURFACE`

- exact Notion surface page title such as `Surface - web - members`
- `none`

### `STATE_ACTIVE_COMPANION_SURFACES`

- comma-separated list of companion surface page titles
- `none`

Use `none` when the selected surface bundle is single-platform.

### `STATE_ACTIVE_PHASE`

Allowed values:

- `audit`
- `resolve`
- `verify`
- `sync`
- `blocked`
- `done`

Meaning:

- `audit` -> inspect the selected surface page, companion surfaces, manifest metadata, repo truth, and contract gaps
- `resolve` -> implement the required changes using the integration, backend, and frontend skills
- `verify` -> run direct API checks first, then Swagger, then Playwright on the required surfaces
- `sync` -> update surface pages, linked domain pages, linked task pages, and local state
- `blocked` -> the active surface bundle is stopped by a real blocker with no safe continuation
- `done` -> the active surface bundle is complete

### `STATE_ACTIVE_DOMAIN_TASK`

- exact Notion task page title such as `Task - auth - align-register-and-email-otp-contracts`
- `none`

Use `none` when the selected surface bundle does not require a reusable, cross-domain, structurally large, or blocked linked task page.

### `STATE_LAST_COMPLETED_SURFACE`

- exact Notion surface page title
- `none`

### `STATE_STOP_REASON`

- short concrete stop or blocker summary
- `none`

## Reset Rules

Fresh page-first reset:

- `STATE_ACTIVE_SURFACE:` `none`
- `STATE_ACTIVE_COMPANION_SURFACES:` `none`
- `STATE_ACTIVE_PHASE:` `audit`
- `STATE_ACTIVE_DOMAIN_TASK:` `none`
- `STATE_LAST_COMPLETED_SURFACE:` `none`
- `STATE_STOP_REASON:` `none`

Resume rule:

- if `STATE_ACTIVE_SURFACE` is set and not `none`, resume that surface bundle first
- otherwise use `SURFACE_SELECTION_MODE`

## Legacy Domain Fallback Variables

These apply only when `RUN_MODE = integrate_domain_journeys_legacy`:

- `EXECUTION_PRESET`
  - `batch_3_domains`
  - `single_domain`
- `DOMAIN_BATCH`
  - exactly 3 supported domain slugs when `EXECUTION_PRESET = batch_3_domains`
  - `none` when `EXECUTION_PRESET = single_domain`
- `FOCUS_DOMAIN`
  - one supported domain slug when `EXECUTION_PRESET = single_domain`
  - `none` when `EXECUTION_PRESET = batch_3_domains`
- `MAX_SELF_HEAL_ATTEMPTS_PER_DOMAIN`
  - bounded retry budget for the legacy flow

Legacy domain state remains:

- `STATE_ACTIVE_DOMAIN`
- `STATE_NEXT_DOMAIN`
- `STATE_DOMAIN_PHASE`
- `STATE_ACTIVE_TASK_PAGE`
- `STATE_LAST_COMPLETED_DOMAIN`
