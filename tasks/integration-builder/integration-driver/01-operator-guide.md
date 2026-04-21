# Integration Driver Operator Guide

Use this file for chat workflow reference.
It is not part of the normal task-run context unless the current run explicitly needs operator guidance.

## Chat Workflow

Use the same prompt every time:

```text
Read tasks/integration-builder/integration-driver.md and run the configured page-first cross-platform integration flow end to end. Start from the selected surface page, audit any required web and mobile companion surfaces, resolve gaps using the integration, backend, and frontend skills, verify through direct API checks plus Swagger and Playwright, keep the local watcher stack healthy, update Notion and the system-managed state, and stop only when the selected surface bundle is complete or a real blocker remains.
```

Normal rhythm:

1. edit only the `Execution Controller Variables` in `tasks/integration-builder/integration-driver.md`
2. leave `System-Managed State` alone during normal use
3. paste the fixed prompt above into a fresh chat
4. let the run update the selected surface pages, linked domain or task pages, and the local system-managed state
5. before the next surface bundle, update the controller variables and reset the system-managed state only if you are intentionally starting a fresh run boundary

The prompt stays fixed. The execution controller variables are the operator-owned inputs, while Notion plus the system-managed state carry the latest execution continuity.

## Recommended Defaults

- keep `RUN_MODE: integrate_surface_pages` for normal day-to-day integration work
- keep `SURFACE_SELECTION_MODE: next_incomplete_surface` unless you intentionally want one exact page
- keep `FOCUS_SURFACE_PAGE_TITLE: none` and `FOCUS_SURFACE_PAGE_ID: none` unless you intentionally target one exact surface page
- keep `SURFACE_PLATFORM_SCOPE: auto` so manifest parity decides whether the run stays single-platform or becomes cross-surface
- keep `AUTO_FIX_SCOPE: blocking_plus_obvious` so the run fixes clear UX and contract drift without widening into product redesign
- keep `RUNTIME_MODE: attach_manual` so the run attaches to your existing watcher stack first
- keep `SOFT_BLOCK_RECHECK: yes` so prior tool-only blockers are retried automatically

## Example Controller Setups

Run the next actionable surface from the tracker:

- `RUN_MODE:` `integrate_surface_pages`
- `SURFACE_SELECTION_MODE:` `next_incomplete_surface`
- `FOCUS_SURFACE_PAGE_TITLE:` `none`
- `FOCUS_SURFACE_PAGE_ID:` `none`
- `SURFACE_PLATFORM_SCOPE:` `auto`
- `AUTO_FIX_SCOPE:` `blocking_plus_obvious`
- `RUNTIME_MODE:` `attach_manual`

Run one exact surface by title:

- `RUN_MODE:` `integrate_surface_pages`
- `SURFACE_SELECTION_MODE:` `single_surface`
- `FOCUS_SURFACE_PAGE_TITLE:` `Surface - web - members`
- `FOCUS_SURFACE_PAGE_ID:` `none`
- `SURFACE_PLATFORM_SCOPE:` `auto`
- `AUTO_FIX_SCOPE:` `blocking_plus_obvious`
- `RUNTIME_MODE:` `attach_manual`

Run one exact surface by page id:

- `RUN_MODE:` `integrate_surface_pages`
- `SURFACE_SELECTION_MODE:` `single_surface`
- `FOCUS_SURFACE_PAGE_TITLE:` `none`
- `FOCUS_SURFACE_PAGE_ID:` `33a197c1-7473-810a-97c8-c4c2b3aa8afe`
- `SURFACE_PLATFORM_SCOPE:` `auto`
- `AUTO_FIX_SCOPE:` `blocking_plus_obvious`
- `RUNTIME_MODE:` `attach_manual`

Force a platform-specific pass:

- `RUN_MODE:` `integrate_surface_pages`
- `SURFACE_SELECTION_MODE:` `single_surface`
- `FOCUS_SURFACE_PAGE_TITLE:` `Surface - mobile-web - settings`
- `FOCUS_SURFACE_PAGE_ID:` `none`
- `SURFACE_PLATFORM_SCOPE:` `mobile_only`
- `AUTO_FIX_SCOPE:` `blocking_plus_obvious`
- `RUNTIME_MODE:` `attach_manual`

Use the older domain-first fallback:

- `RUN_MODE:` `integrate_domain_journeys_legacy`
- `EXECUTION_PRESET:` `single_domain`
- `DOMAIN_BATCH:` `none`
- `FOCUS_DOMAIN:` `membership`

## Resetting System-Managed State

Do this only when you intentionally start a fresh surface run or need to recover from malformed local state.

Fresh page-first reset:

- `STATE_ACTIVE_SURFACE:` `none`
- `STATE_ACTIVE_COMPANION_SURFACES:` `none`
- `STATE_ACTIVE_PHASE:` `audit`
- `STATE_ACTIVE_DOMAIN_TASK:` `none`
- `STATE_LAST_COMPLETED_SURFACE:` `none`
- `STATE_STOP_REASON:` `none`

Legacy domain reset:

- `STATE_ACTIVE_DOMAIN:` `none`
- `STATE_NEXT_DOMAIN:` `FOCUS_DOMAIN`
- `STATE_DOMAIN_PHASE:` `review`
- `STATE_ACTIVE_TASK_PAGE:` `none`
- `STATE_LAST_COMPLETED_DOMAIN:` `none`

## Notes

- the active stop boundary is the selected surface bundle, not a domain preset
- page-first execution now follows `audit -> resolve -> verify -> sync`
- companion surfaces are required automatically when the selected feature is marked cross-surface in the manifest
- surface pages are now the main execution record for normal integration work
- linked domain task pages remain optional escalations for reusable, cross-domain, structurally large, or blocked work
- Codex may use many subagents, but the main chat agent remains the only orchestrator and shared-state owner
