# Refactor Driver Operator Guide

Use this file for chat workflow reference.
It is not part of the normal task-run context unless the current run explicitly needs operator guidance.

## Chat Workflow

Use the same prompt every time:

```text
Read tasks/integration-builder/refactor-driver.md and run the configured Notion refactor request end to end. Load the selected request page, write Review and Plan, implement the request, test the affected surfaces, sync the required system design docs, move the request into done, sync the local state, and stop only when the selected request is complete or a real blocker remains.
```

Normal rhythm:

1. create or update the request page under `Refactor Inbox`
2. write the request and acceptance criteria
3. set `FOCUS_REQUEST_PAGE_TITLE` or `FOCUS_REQUEST_PAGE_ID` in `tasks/integration-builder/refactor-driver.md`
4. leave `System-Managed State` alone during normal use
5. paste the fixed prompt into a fresh chat
6. review the finished page under `Refactor Done`

## Recommended Defaults

- keep `NOTION_PARENT_PAGE_TITLE: System Gap Analysis`
- keep `REFACTOR_ROOT_PAGE_TITLE: Refactor Requests`
- keep `REQUEST_SELECTION_MODE: single_page`
- keep `MAX_SELF_HEAL_ATTEMPTS_PER_REQUEST: 2`
- keep `REFACTOR_SCOPE: touched_plus_hotspots`
- keep `PAYMONGO_MODE: disabled`

## Example Controller Setup

- `NOTION_PARENT_PAGE_TITLE:` `System Gap Analysis`
- `REFACTOR_ROOT_PAGE_TITLE:` `Refactor Requests`
- `REQUEST_SELECTION_MODE:` `single_page`
- `FOCUS_REQUEST_PAGE_TITLE:` `Refactor Request - tighten-member-booking-filters`
- `FOCUS_REQUEST_PAGE_ID:` `none`
- `MAX_SELF_HEAL_ATTEMPTS_PER_REQUEST:` `2`
- `REFACTOR_SCOPE:` `touched_plus_hotspots`
- `PAYMONGO_MODE:` `disabled`

## Resetting System-Managed State

Do this only when you intentionally start a fresh request run from the beginning or recover from malformed local state.

- `STATE_ACTIVE_REQUEST:` `none`
- `STATE_ACTIVE_PHASE:` `done`
- `STATE_LAST_COMPLETED_REQUEST:` `none`
- `STATE_STOP_REASON:` `none`

## Notes

- the active stop boundary is the selected request, not a page-count limit
- the request page itself is the durable execution record
- request execution always follows `review -> plan -> implement -> test`
- system design updates are required whenever the landed change alters real behavior or structure
- `agents/architecture.md` changes are reserved for reusable repo-wide conventions, not one-off implementation notes
