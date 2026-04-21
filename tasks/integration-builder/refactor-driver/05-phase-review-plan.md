# Refactor Driver Review And Plan Phase

Use this file during the request `review` and `plan` phases.

## Review Phase

The review phase must:

- read the selected request page in full
- inspect the current repo truth before trusting the request wording
- identify affected frontend, backend, shared-package, Prisma, and AI surfaces
- identify whether the request changes real system behavior or only implementation details
- identify which system design pages must be updated if the request lands
- identify direct hotspots that fall within `REFACTOR_SCOPE = touched_plus_hotspots`

Write the `Review` section with:

- current behavior
- likely root cause or improvement target
- impacted repo areas
- likely risks and regressions
- doc-sync expectations

## Plan Phase

The plan phase must happen before code edits begin.

Write the `Plan` section with:

- implementation steps in dependency-safe order
- test steps
- runtime verification needs
- docs to sync
- any assumptions needed to proceed

A valid plan is decision-complete enough that implementation can proceed without reopening discovery unless new evidence appears.

## Review-To-Plan Hand-Off

Before leaving the plan phase:

- set `STATE_ACTIVE_REQUEST` to the selected page title
- set `STATE_ACTIVE_PHASE` to `plan` while writing the plan
- move to `implement` only after the `Plan` section is present and concrete
