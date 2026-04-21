# Integration Driver Notion Contract

Use this file for the page structure, dedupe rules, and section contracts under the configured Notion parent page.

## Parent Page

- parent page title: use `NOTION_PARENT_PAGE_TITLE`
- default parent page title: `System Gap Analysis`
- output shape: child pages only
- do not create a Notion database for v1

If the parent page exists, update its children in place.
If the parent page does not exist, create it first and then create the child pages below it.

## Root-Level Children

Keep these pages directly under the configured parent page:

- shared baseline pages
- shared registries
- `System Architecture Shape`
- `Blocked Task References`
- one `Domain - <domain>` page per owned domain
- `Surface Verification Tracker`
- `Refactor Requests`
- `Integration Map and Accomplishments`

Do not keep domain task pages or domain journey pages at the root when a matching domain page exists.
Do not keep surface pages at the root when `Surface Verification Tracker` exists.

## Baseline Child Pages

Create or maintain these child pages:

- `Shared Contracts Snapshot`
- `Shared Validation Snapshot`
- `Shared Transport Snapshot`
- `System Architecture Shape`
- `Runtime Map`
- `External Config Registry`
- `Domain Registry`
- `Task Queue`
- `Blocked Task References`
- `Surface Verification Tracker`
- `Refactor Requests`
- `Integration Map and Accomplishments`

These baseline and registry pages stay at the root under `NOTION_PARENT_PAGE_TITLE`.

## Baseline Page Contracts

`Runtime Map` must include a Markdown table with:

- service
- service type
- repo path
- compose service name
- depends_on
- internal port
- external port
- health endpoint
- docs endpoint
- required external config
- runtime owner mode

`System Architecture Shape` must include these sections:

- `Current Runtime Topology`
- `Shared Contract Spine`
- `Backend Shape`
- `Frontend Web Shape`
- `Frontend Mobile Shape`
- `AI Microservice Shape`
- `Cross-Layer Integration Flow`
- `Refactor Guardrails`
- `Allowed Refactor Moves`
- `Avoid Over-Engineering`

`External Config Registry` must include a Markdown table with:

- config key
- owning subsystem
- code consumers
- secret or non-secret
- required locally
- required for deploy
- current documentation status
- runtime blocker status
- notes

`Domain Registry` must include a Markdown table with:

- domain
- backend modules
- shared packages touched
- web surfaces
- mobile surfaces
- AI dependency
- deploy dependency
- status

`Task Queue` must include a Markdown table with:

- priority
- severity
- domain
- execution bucket
- queue state
- current phase
- task status
- block reason
- task page
- chosen fix
- source surface page
- source domain page
- last updated

Use `queue state` values:

- `seeded` -> a real `Task - <domain> - <fix-slug>` page exists and owns execution
- `reference_only` -> the row exists only as a cross-domain pointer and does not own execution

Use `current phase` values:

- `review`
- `plan`
- `implement`
- `test`

Use `task status` values:

- `planned`
- `implementing`
- `testing`
- `blocked`
- `done`

Use `execution bucket` values:

- `active`
- `backlog`
- `done`
- `reference_only`

`Task Queue` is the global rollup only.
It tracks only real linked domain task pages, not every page-local UI correction.

## Surface Verification Tracker Contract

`Surface Verification Tracker` is the primary execution home for page-first integration work.

The root tracker page must include these sections:

- `Run Status`
- `Accessibility Overview`
- `Web Surfaces`
- `Mobile Expo-Web Surfaces`
- `Cross-Surface Parity Groups`
- `Blocked Surface Bundles`
- `Guardrail Drift Register`
- `Deferred External Constraints`

The root tracker page should summarize:

- the active primary surface
- any active companion surfaces
- current runtime mode
- current blocker or stop reason
- the most recent completed surface bundle
- the currently blocked or deferred surface bundles awaiting follow-up

### Surface Child Page Contract

Create or maintain one child page per manifest surface using these title patterns:

- `Surface - web - <slug>`
- `Surface - mobile-web - <slug>`

Every surface page must record this metadata near the top:

- platform
- route
- label
- current allowed roles
- conditional-role notes
- paymongo dependent
- owning domain
- secondary domains
- parity group
- parity required
- verification mode
- preferred MCPs
- primary API tags
- primary query modules
- role sensitive
- linked domain or task page

Every surface page must keep these fixed sections on the same page:

- `Surface Summary`
- `Key User-Visible Actions`
- `Key Queries And Mutations`
- `Backend Dependencies`
- `Execution State`
- `Gap Report`
- `Completion QA`
- `Integration Plan`
- `Applied Fixes`
- `Direct API Evidence`
- `Swagger Contract Evidence`
- `Playwright Evidence`
- `Linked Domain Tasks`
- `Companion Surface Status`
- `Decision Log`
- `Next Resume Step`

Surface pages are the durable execution record for normal integration work.
If a cross-surface feature is in progress, the selected surface page is the primary record and companion surface pages must reflect the same bundle outcome in `Companion Surface Status`.
If a surface bundle becomes blocked or deferred, the selected surface page must preserve the blocker summary, evidence, continuation decision, and linked follow-up under `Execution State`, `Decision Log`, and `Next Resume Step`.
`Gap Report` and `Completion QA` must classify each active finding as one of:

- `autofix_now`
- `blocked_external`
- `blocked_hard`
- `product_followup`

`Execution State` should make it obvious whether the page is:

- fully complete
- legacy-verified but pending completion review
- deferred_external
- blocked_hard

## Domain Page Contract

Create or maintain one page per domain:

- `Domain - <domain>`

Each domain page stays at the root under the configured parent page.
Each domain page is also the parent for that domain's real task pages and journey pages.

Every domain page must include these sections:

- `Backend Overview`
- `Backend Gap Summary`
- `Shared Package Overview`
- `Web Admin Overview`
- `Web Frontend Gap Summary`
- `Mobile Member Overview`
- `Mobile Frontend Gap Summary`
- `AI Dependency Overview`
- `Microservice Gap Summary`
- `Deploy And Config Dependency Overview`
- `Architecture Fit Notes`
- `Gap Tables`
- `Page Inventory`
- `Journey Inventory`
- `Integrated Now`
- `Blocked By Env Or Dependency`
- `Required Follow-Up Gaps`
- `Deferred Optional Endpoints`
- `Execution State`
- `Sequential Execution Plan`
- `Active Tasks`
- `Backlog Tasks`
- `Done Tasks`
- `Cross-Domain Task References`

Domain pages keep ownership summaries, reusable domain backlog, and cross-surface notes.
They are not the default execution record for page-local integration work.

## Journey Page Contract

Create or maintain journey pages using this title pattern:

- `Journey - <domain> - <page-slug>`

Every journey page must be a child of its matching `Domain - <domain>` page.

Every journey page must include a metadata block near the top with:

- `page or surface`
- `platform scope`
- `integrated status`
- `current phase`
- `Preferred MCPs`
- `Touches Prisma`
- `Needs Runtime Verification`
- `Host-Run Commands`
- `source domain page`

Every journey page must keep these fixed sections on the same page:

- `Required Business Journeys`
- `Required Endpoints And Contracts`
- `Optional Endpoints Not Needed Now`
- `Integrated Now`
- `Env Or Dependency Blockers`
- `Direct API Evidence`
- `Playwright Evidence`
- `Required Follow-Up Gaps`
- `Decision Log`
- `Next Resume Step`

Journey pages remain the durable discovery and verification record for domain-owned business outcomes.

## Task Page Contract

Create or maintain task pages using this title pattern:

- `Task - <domain> - <fix-slug>`

Every task page must be a child of its matching `Domain - <domain>` page, not a root child of `NOTION_PARENT_PAGE_TITLE`.
Task pages remain the durable implementation record for reusable, cross-domain, structurally large, or blocked work discovered during page-first execution.

Every task page must include a metadata block near the top with:

- `status`
- `current phase`
- `severity`
- `execution bucket`
- `dedupe key`
- `source gap cluster`
- `chosen fix`
- `source surface page`
- `Preferred MCPs`
- `Touches Prisma`
- `Needs Runtime Verification`
- `Host-Run Commands`
- `Attempt Count`
- `architecture alignment notes`
- `existing pattern references`
- `refactor guardrails`
- `depends on`
- `execution order`
- `referenced by surfaces`
- `referenced by domains`
- `repo surfaces involved`
- `FE web impact`
- `FE mobile impact`
- `backend/API impact`
- `AI dependency impact`
- `shared package impact`
- `infra and deploy dependency impact`
- `source domain page`

Every task page must keep these fixed sections on the same page:

- `Review`
- `Plan`
- `Implementation Notes`
- `Tests and Verification`
- `Runtime and Playwright Artifacts`
- `Blocked`
- `Decision Log`
- `Next Resume Step`

## Dedupe And Update Rules

- use exact page titles for idempotent updates
- update an existing page instead of creating a duplicate when the title already exists
- surface-page dedupe key must be the exact `Surface - <platform> - <slug>` title
- journey-page dedupe key must be `domain + page-slug`
- task-page dedupe key must be `domain + fix-slug`
- if a matching surface page exists at the root from an older run, move it under `Surface Verification Tracker` and refresh it there
- if a matching journey page exists at the root from an older run, move it under `Domain - <domain>` and refresh it there
- if a matching task page exists at the root from an older run, move it under `Domain - <domain>` and refresh it there
- each actionable required gap cluster must have exactly one chosen fix before it becomes a real task page
- chosen fixes must align with `System Architecture Shape` and explain why they do not broaden the architecture unnecessarily
- do not create task pages for env-only blockers or optional unused endpoints
- create or refresh a linked task page only when the work is reusable, cross-domain, structurally large, or blocked
- keep `Task Queue.current phase` and the linked task page `current phase` aligned at every execution boundary
- keep `Task Queue.execution bucket`, the linked task page `execution bucket`, and the matching domain lane sections aligned at every execution boundary
