# Refactor Driver Implement And Test Phase

Use this file during the request `implement`, `test`, `blocked`, and `done` phases.

## Implement Phase

The implement phase must:

- land the requested behavior change
- refactor touched files plus direct hotspots discovered on the implementation path
- preserve the existing repo architecture unless a reusable improvement is clearly justified
- keep PayMongo behavior in the current disabled or deferred state unless the request explicitly and safely changes that

Write `Implementation Notes` with:

- what changed
- why the chosen approach fit the existing repo patterns
- any follow-up extraction points that were intentionally left out of scope

## Test Phase

The test phase must:

- run the relevant code-level checks
- run direct API checks first when backend behavior changed
- run browser or Expo-web verification when the request affects surfaced flows
- record the real verification evidence in `Tests and Verification`

If verification artifacts are produced, record their paths in the request page.

## Doc Sync

Before the request can move to done:

- update affected Notion system pages
- update repo design docs only when the change creates reusable conventions
- write the exact sync summary into `System Design Updates`

## Done Phase

A request is done only when:

- code changes are complete
- testing is complete or explicitly bounded
- design docs are synced
- the request page is moved into `Refactor Done`
- `STATE_LAST_COMPLETED_REQUEST` is updated
- `STATE_ACTIVE_REQUEST` is cleared
- `STATE_ACTIVE_PHASE` becomes `done`
- `STATE_STOP_REASON` becomes `none`

## Blocked Phase

When the request is blocked:

- move `STATE_ACTIVE_PHASE` to `blocked`
- write the exact blocker in `Blocked`
- set `STATE_STOP_REASON` to a short concrete summary
- stop unless a safe continuation still exists inside the same request
