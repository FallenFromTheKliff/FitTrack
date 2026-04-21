# Refactor Driver Notion Contract

Use this file for the page structure, dedupe rules, and section contracts under the configured Notion parent page.

## Parent Page

- parent page title: use `NOTION_PARENT_PAGE_TITLE`
- default parent page title: `System Gap Analysis`
- output shape: child pages only
- do not create a Notion database for v1

## Root Refactor Pages

Create or maintain:

- `Refactor Requests`

Under `Refactor Requests`, create or maintain:

- `Refactor Inbox`
- `Refactor Active`
- `Refactor Done`

Do not create a second task database for this v1.

## Request Page Contract

Create or maintain request pages using this title pattern:

- `Refactor Request - <slug>`

Each real request page must live under exactly one of these containers at a time:

- `Refactor Inbox`
- `Refactor Active`
- `Refactor Done`

Every request page must include a metadata block near the top with:

- `status`
- `current phase`
- `repo areas`
- `preferred MCPs`
- `touches prisma`
- `needs runtime verification`
- `docs to sync`
- `attempt count`
- `refactor guardrails`

Every request page must keep these fixed sections on the same page:

- `Request`
- `Acceptance Criteria`
- `Review`
- `Plan`
- `Implementation Notes`
- `Tests and Verification`
- `System Design Updates`
- `Blocked`
- `Decision Log`
- `Next Resume Step`

## Execution Flow

The request flow is fixed:

1. fetch the selected request from inbox or active
2. move it to `Refactor Active`
3. backfill missing sections if needed
4. write `Review`
5. write decision-complete `Plan`
6. implement the request
7. run the relevant checks
8. update affected system design docs
9. move the request to `Refactor Done`
10. clear the local state

## System Design Sync Rules

When a request changes real behavior or structure, update the affected Notion system pages:

- `System Architecture Shape`
- `Runtime Map`
- `Shared Contracts Snapshot`
- `Shared Validation Snapshot`
- `Shared Transport Snapshot`
- relevant `Domain - <domain>` pages when domain behavior changes

Update `agents/architecture.md` only when the request establishes a reusable repo-wide convention, not for one-off implementation notes.

The request page's `System Design Updates` section must record:

- which Notion pages changed
- which repo docs changed
- why each update was needed

## Dedupe And Update Rules

- use exact page titles for idempotent updates
- update an existing request page instead of creating a duplicate when the title already exists
- request-page dedupe key must be the exact `Refactor Request - <slug>` title
- if a matching request page exists under the wrong container, move it instead of duplicating it
- when a request page is missing one of the fixed sections, backfill the section before implementation continues
