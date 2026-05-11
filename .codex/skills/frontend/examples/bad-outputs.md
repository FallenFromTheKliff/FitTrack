# Frontend Anti-Patterns To Avoid

These are inferred from the current app structure and data-layer design.

## Feature logic dumped into a route file

Bad shape:

- route or screen owns queries, mutations, form parsing, modal state, repeated helpers, and large render branches all at once

Why to avoid it:

- the repo already favors hooks, controller helpers, focused sections, and small helper functions

## Whole page hidden behind one component

Bad shape:

- `page.tsx` returns only `XxxDashboard`, `XxxPageContent`, or `XxxShell`
- a mobile screen returns only `XxxScreenContent`
- that child owns the header, body sections, state branches, modal mounts, and all visible composition

Why to avoid it:

- `page.tsx` and mobile screen files should be the readable body assembly point
- components should stay precise building blocks, not alternate homes for the entire page or screen

## Ad hoc data access in components

Bad shape:

- raw `fetch`
- one-off axios calls
- hard-coded auth headers inside components

Why to avoid it:

- this bypasses `packages/api-client`, `packages/query`, shared invalidation, and auth failure handling

## Rebuilding primitives or helpers instead of reusing them

Bad shape:

- every page invents its own button, input, formatter, status mapper, or section layout

Why to avoid it:

- both apps already expose app-local `Fit*` primitives and reusable hooks or helpers that should be upgraded before duplicated

## Outdated reusable unit bypassed with a near-copy

Bad shape:

- an existing primitive, hook, or helper is close to the need
- but the implementation leaves it stale and creates a new page-local variation instead

Why to avoid it:

- it fragments the reusable layer and makes later refactors harder

## Platform storage logic mixed into feature code

Bad shape:

- direct token writes sprinkled through pages or modals
- role redirects hard-coded in random components

Why to avoid it:

- session storage and auth-failure behavior already live in the platform API client layer

## Verified but uncanny UI

Bad shape:

- a page technically works
- but visible controls are dead, filters are half-wired, modal flows are incomplete, labels are awkward, or the layout still looks unfinished

Why to avoid it:

- the touched surface still feels unfinished even if the data contract is technically correct
