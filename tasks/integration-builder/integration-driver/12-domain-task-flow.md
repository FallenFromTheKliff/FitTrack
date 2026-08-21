# Integration Driver Domain Task Flow

Use this file for the shared Notion-backed linked domain task execution model that the page-first integration flow uses when a selected surface must escalate work into a reusable, cross-domain, structurally large, or blocked task.

## Goal

Keep page-first surface execution as the default while making linked domain-task execution easier to navigate and harder to derail whenever work must move beyond a single surface bundle.

The domain task flow must:

- let selected surfaces escalate owned work into real linked domain tasks without losing the surface-first execution trail
- keep one selected domain as the active execution boundary
- use journeys to discover the required domain-owned work
- seed real owned tasks during the domain `seed` phase
- write `Review` and `Plan` during seeding so newly created tasks are implementation-ready immediately
- keep exactly one owned task active unless parallel work is explicitly requested
- preserve a sequential execution plan inside each domain
- record cross-domain ownership without duplicating task pages
- keep Notion and the local system-managed state aligned at every execution boundary

## Notion Execution Surfaces

Every `Domain - <domain>` page must include:

- `Execution State`
- `Sequential Execution Plan`
- `Active Tasks`
- `Backlog Tasks`
- `Done Tasks`
- `Cross-Domain Task References`

Use them like this:

- `Execution State` -> current domain phase, current active task, next ready task, last completed task, last completed domain, stop reason, and last block reason
- `Sequential Execution Plan` -> dependency-aware order for real owned tasks in this domain
- `Active Tasks` -> the one real owned task currently being executed
- `Backlog Tasks` -> real owned task pages that are already reviewed and planned and are ready to implement
- `Done Tasks` -> completed owned task pages with preserved verification history
- `Cross-Domain Task References` -> links to tasks owned by another domain that affect the current domain

The root `Task Queue` remains the cross-domain rollup, not the day-to-day domain workspace.
`Blocked Task References` is the root-level quick-jump page for currently blocked real task pages.

## Controller And State Boundaries

Do not let Notion execution sections silently replace the local driver controls.

The execution controller variables decide:

- whether the run is `batch_3_domains` or `single_domain`
- which domains are in scope for the current preset
- how much bounded recovery is allowed

The local system-managed state decides:

- which domain is currently active
- which domain comes next inside the configured preset
- which domain phase is active
- which owned task page is currently executing
- which domain was completed last

Use Notion to store the durable execution history.
Use the local system-managed state to keep the current preset readable and easy to resume.

## Domain Review To Seed Intake

When a domain starts or is rehydrated:

1. refresh repo truth with Serena
2. use Prisma MCP when DB-backed truth may change the outcome
3. refresh the selected domain page, its relevant journey pages, the root `Task Queue`, and `Blocked Task References`
4. identify required domain-owned work and cross-domain references from the journey inventory
5. create or refresh real task pages in the owning domain for the required domain-owned gaps
6. write `Review` and `Plan` immediately for each chosen owned task
7. place those owned task pages into `Backlog Tasks`
8. write or refresh `Sequential Execution Plan`

Special handling for deferred payment config blockers:

- if a domain-owned verification slice depends on intentionally deferred external payment config such as `PAYMONGO_*`
- create or refresh a real owned task page for that payment slice instead of leaving it as a note-only blocker
- mark that task `task status = blocked`
- keep it linked from `Blocked Task References`
- do not let that blocked payment slice stop unrelated non-payment work in the same preset

Backlog tasks are expected to be planned and implementation-ready by default.
Newly created owned backlog tasks should normally end the seed phase with:

- `status = planned`
- `current phase = implement`
- `task status = planned`
- `execution bucket = backlog`

Legacy tasks that still sit in an earlier lifecycle remain valid and must still be executable after their missing review or plan content is backfilled.

## Active Task Selection

When execution needs the next task inside a domain, use this order:

1. the one owned task listed in `Active Tasks`, when present
2. otherwise the first ready owned task from `Backlog Tasks` whose dependencies are done and whose `task status` is not `blocked` or `done`

Keep exactly one owned task active unless the user explicitly requests parallel work.

Execution continues inside the current domain until:

- the owned backlog is clear and the domain moves to domain-level `test`
- or the domain becomes hard-blocked with no independently actionable same-domain continuation

## Cross-Domain Ownership

Every real task belongs to exactly one owning domain.

Rules:

- create the real task page only under the owning `Domain - <domain>` page
- update the root `Task Queue` row using the owning domain
- add a reference entry under the non-owning current domain instead of cloning the task
- do not create duplicate task pages for the same gap under multiple domains

Example:

- if `user` review reveals an auth gap, create or refresh `Task - auth - <fix-slug>` under `Domain - auth`
- add a `Cross-Domain Task References` entry under `Domain - user`
- keep the root `Task Queue` row owned by `auth`

## Structural Guardrails

Backend and shared-code work:

- copy the closest existing repo pattern first
- if no clear local pattern exists, use `agents/architecture.md` as the fallback authority
- preserve the current layered shape instead of inventing a parallel architecture

Frontend work:

- keep every route file at or below 100 lines
- keep route files as thin wrappers that compose shared UI
- reuse existing shared components first
- when existing components are insufficient, create a new shared component instead of inflating `page.tsx`
- if a touched route file still exceeds 100 lines, do not move the task to `test` or `done` until it is split
- keep non-route UI components compact; target 100 lines and treat 150+ lines or multiple unrelated sections as a refactor signal
- cohesive helper functions may exceed the component target when necessary, but still compress or extract helpers when the file becomes hard to scan
- keep UI theme-compatible using the existing theme context, tokens, and style factories

Backend and API work:

- copy the nearest controller, service, repository, DTO, validator, and mapper pattern before inventing a new one
- if one touched controller, service, repository, or DTO file grows by roughly 150+ lines in one task or ends above roughly 250 lines with mixed responsibilities, extract helpers, validators, mappers, or sub-services before closing the task
- record any intentional exception under `refactor guardrails` on the task page with the reason and the next extraction point

## Completion And Sync

When a task changes state, update all five surfaces:

1. the task page
2. the owning domain page execution sections
3. the root `Task Queue`
4. `Blocked Task References` when the task enters or leaves `blocked`
5. the local system-managed state when the active task or domain phase changes

Expected sync:

- newly seeded and planned -> `Backlog Tasks` + `execution bucket = backlog` + `current phase = implement`
- in progress -> `Active Tasks` + `execution bucket = active`
- completed -> `Done Tasks` + `execution bucket = done`
- blocked -> task-page `Blocked` section completed + `task status = blocked` + `Task Queue.block reason` populated + task link added or refreshed in `Blocked Task References`
- blocked by deferred payment config -> same blocked-task handling as above, but the owning domain may still close and the preset may still advance when the remaining non-payment outcomes are already verified
- cross-domain mention only -> `Cross-Domain Task References` + `execution bucket = reference_only`

When the domain backlog becomes clear:

1. clear `Active Tasks`
2. set the local state to domain `test`
3. re-verify the relevant journeys and representative surfaces for the domain
4. close the domain or mark it hard-blocked with evidence
