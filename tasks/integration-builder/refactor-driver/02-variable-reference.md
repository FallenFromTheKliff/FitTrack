# Refactor Driver Variable Reference

Use this file when you need the allowed values, safety limits, reset rules, or resume meanings for `tasks/integration-builder/refactor-driver.md`.

## `REQUEST_SELECTION_MODE`

Allowed values:

- `single_page`

Rules:

- the run owns exactly one selected request page
- select it with `FOCUS_REQUEST_PAGE_ID` when possible
- fall back to `FOCUS_REQUEST_PAGE_TITLE` when the ID is not known yet

## `FOCUS_REQUEST_PAGE_TITLE`

- use the exact Notion page title when selecting by name
- expected pattern: `Refactor Request - <slug>`
- use `none` when `FOCUS_REQUEST_PAGE_ID` is used instead

## `FOCUS_REQUEST_PAGE_ID`

- use the exact Notion page ID when selecting by ID
- use `none` when `FOCUS_REQUEST_PAGE_TITLE` is used instead

## `MAX_SELF_HEAL_ATTEMPTS_PER_REQUEST`

- counts bounded recovery attempts after a failed implementation or verification step
- use `2` by default so the run can fix one real issue and retry once more
- do not spend this budget on missing Notion access or MCP drift; stop early instead

## `REFACTOR_SCOPE`

Allowed values:

- `touched_plus_hotspots`

Meaning:

- implement the request
- refactor touched files
- address direct nearby hotspots that are clearly in the path of the same change

## `PAYMONGO_MODE`

Allowed values:

- `disabled`

Meaning:

- preserve current deferred or unavailable PayMongo behavior
- do not silently re-enable live PayMongo paths during refactor work

## System-Managed State Rules

These values are worker-owned during normal execution.
Do not edit them manually unless you are intentionally resetting a request run or recovering from malformed local state.

### `STATE_ACTIVE_REQUEST`

- exact request page title such as `Refactor Request - tighten-member-booking-filters`
- `none`

### `STATE_ACTIVE_PHASE`

Allowed values:

- `review`
- `plan`
- `implement`
- `test`
- `blocked`
- `done`

### `STATE_LAST_COMPLETED_REQUEST`

- exact request page title
- `none`

### `STATE_STOP_REASON`

- short reason summary
- `none`

## Reset Rules

Fresh request reset:

- `STATE_ACTIVE_REQUEST:` `none`
- `STATE_ACTIVE_PHASE:` `done`
- `STATE_LAST_COMPLETED_REQUEST:` `none`
- `STATE_STOP_REASON:` `none`

Resume rule:

- if `STATE_ACTIVE_REQUEST` is set and not `none`, resume that request first
- otherwise, start from the selected request page in `FOCUS_REQUEST_PAGE_TITLE` or `FOCUS_REQUEST_PAGE_ID`
