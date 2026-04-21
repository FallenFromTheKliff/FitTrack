# Integration Anti-Patterns To Avoid

## Stale tracker model

Bad shape:

- the run treats an old map or repo note as the live task board
- current queue state and runtime evidence are not checked

Why to avoid it:

- the current operating model uses `Task Queue` for live work and `Surface Verification Tracker` for evidence

## Orphaned UI

Bad shape:

- a page, modal, or button exists with no backend consumer path or query wiring

Why to avoid it:

- it creates false-complete features and broken user journeys

## Orphaned endpoint

Bad shape:

- backend route ships with no web or mobile consumer and no clear admin-only rationale

Why to avoid it:

- contract drift accumulates and the route becomes unverified dead weight

## Auth drift between surfaces

Bad shape:

- protected backend endpoint exists but the frontend does not attach tokens or handle `401` and `403`

Why to avoid it:

- this breaks the full flow even when the endpoint itself is correct

## Contract repair scattered across screens

Bad shape:

- every surface manually remaps field names or status enums on its own

Why to avoid it:

- the repo already has shared transport and query seams for this

## Verification skipped after wiring

Bad shape:

- feature was connected but no direct API, Swagger, or Playwright evidence was captured

Why to avoid it:

- the repo already has runtime truth tools and policy for evidence-backed verification

## QA used as the implementer

Bad shape:

- the final verifier starts patching architecture or contract seams instead of reporting them back to the owning layer

Why to avoid it:

- it blurs ownership and weakens the final verification pass

## Verified but uncanny

Bad shape:

- the API contract works and Playwright reaches the route
- but the page still has dead controls, incomplete modal flows, broken filters, or obviously missing async states

Why to avoid it:

- a surface should not close just because it is reachable; the current page intent still needs to feel complete
