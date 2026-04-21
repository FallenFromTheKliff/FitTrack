# Refactor Driver

Use this file as the stable entrypoint and control surface for one selected Notion refactor request.
Ordinary page-first integration corrections now belong in `tasks/integration-builder/integration-driver.md`. Use this driver only for explicit structural refactor requests that already live under `Refactor Requests`.

Edit only the execution controller variables before each run, leave the system-managed state alone during normal use, then tell Codex:

```text
Read tasks/integration-builder/refactor-driver.md and run the configured Notion refactor request end to end. Load the selected request page, write Review and Plan, implement the request, test the affected surfaces, sync the required system design docs, move the request into done, sync the local state, and stop only when the selected request is complete or a real blocker remains.
```

This file is intentionally thin so normal runs only load the active refactor contract, the controller values, and the local resume state.

---

## Execution Controller Variables

Edit these values before starting a chat:

- `NOTION_PARENT_PAGE_TITLE:` `System Gap Analysis`
- `REFACTOR_ROOT_PAGE_TITLE:` `Refactor Requests`
- `REQUEST_SELECTION_MODE:` `single_page`
- `FOCUS_REQUEST_PAGE_TITLE:` `none`
- `FOCUS_REQUEST_PAGE_ID:` `33a197c1-7473-8108-b17c-fd3d0b58da9a`
- `MAX_SELF_HEAL_ATTEMPTS_PER_REQUEST:` `2`
- `REFACTOR_SCOPE:` `touched_plus_hotspots`
- `PAYMONGO_MODE:` `disabled`
- `MODULE_HINTS:`
  - `apps/api/src`
  - `apps/ai-microservice`
  - `apps/web`
  - `apps/mobile`
  - `packages/types`
  - `packages/api-client`
  - `packages/query`
  - `packages/validators`

### Controller Intent

- `REQUEST_SELECTION_MODE = single_page` means the run owns exactly one selected `Refactor Request - <slug>` page.
- Prefer `FOCUS_REQUEST_PAGE_ID` when the exact page already exists and the title may change during drafting.
- Use `FOCUS_REQUEST_PAGE_TITLE` when the page is operator-selected by name and the ID is not yet known.
- `PAYMONGO_MODE = disabled` means payment work must preserve the current deferred-state behavior unless the request explicitly proves the external dependency is available.
- `REFACTOR_SCOPE = touched_plus_hotspots` means implement the request, refactor touched files, and fix direct nearby hotspots discovered while landing the change.

---

## System-Managed State

Do not manually edit these values during normal execution. They are the worker-managed local resume aid that sits alongside the durable Notion state.

- `STATE_ACTIVE_REQUEST:` `none`
- `STATE_ACTIVE_PHASE:` `done`
- `STATE_LAST_COMPLETED_REQUEST:` `Refactor Request - add-test-data-seeder-and-refactor-driver`
- `STATE_STOP_REASON:` `none`

### State Meaning

- `STATE_ACTIVE_REQUEST` is the exact active request page title, or `none`.
- `STATE_ACTIVE_PHASE` is the active request lifecycle phase:
  - `review`
  - `plan`
  - `implement`
  - `test`
  - `blocked`
  - `done`
- `STATE_LAST_COMPLETED_REQUEST` is the most recently completed request page title, or `none`.
- `STATE_STOP_REASON` is the current blocker or stop summary, or `none`.

---

## Routing Rules

After reading this file, load the shared refactor docs in this order:

1. `tasks/integration-builder/refactor-driver/03-runtime-core.md`
2. `tasks/integration-builder/refactor-driver/04-notion-contract.md`
3. `tasks/integration-builder/refactor-driver/05-phase-review-plan.md`
4. `tasks/integration-builder/refactor-driver/06-phase-implement-test.md`
5. `tasks/integration-builder/integration-driver/08-mcp-policy.md`

Load these references only when needed:

- `tasks/integration-builder/refactor-driver/02-variable-reference.md` when you need allowed values, reset rules, or state meanings
- `tasks/integration-builder/refactor-driver/01-operator-guide.md` when you need operator guidance or examples
- `agents/architecture.md` only when no clear nearby repo pattern exists
- `tasks/integration-builder/test-data-seeder.md` when the request needs deterministic test data

---

## Entry Point Contract

- Keep the controller-variable and system-managed-state bullet syntax stable unless the parsing logic is updated too.
- Keep the normal operator prompt aligned to the page-driven refactor flow:

```text
Read tasks/integration-builder/refactor-driver.md and run the configured Notion refactor request end to end. Load the selected request page, write Review and Plan, implement the request, test the affected surfaces, sync the required system design docs, move the request into done, sync the local state, and stop only when the selected request is complete or a real blocker remains.
```

- Keep `Refactor Requests` under `NOTION_PARENT_PAGE_TITLE`.
- Keep `Refactor Inbox`, `Refactor Active`, and `Refactor Done` as child pages of `Refactor Requests`.
- Keep each real request page under exactly one of those container pages at a time.
- During a normal run, load the selected request from inbox or active, move it to active, write `Review`, write `Plan`, implement, test, sync design docs, move it to done, and clear the local state.
- Reuse the integration-driver frontend, backend, shared-package, runtime, and MCP guardrails instead of inventing a second architecture standard.
- Preserve responsive mobile navigation when touching shared shell code such as sidebar, tabs, header, overlay, or route-transition plumbing.
- Keep PayMongo treated as disabled unless the request is explicitly about re-enabling it and the external dependency is verified.
- Do not use this driver for ordinary page-first fixes such as sorting drift, filtering drift, missing modal flows, missing frontend consumers, or endpoint wiring on a selected surface unless the request explicitly scopes that work as a refactor initiative.
