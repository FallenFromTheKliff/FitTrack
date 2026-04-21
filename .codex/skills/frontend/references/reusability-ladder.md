# Reusability Ladder

Use this ladder any time a frontend task touches repeated UI or logic.

## Order of reuse

1. Existing app-local `Fit*` primitive
2. Existing feature component or section
3. Existing hook, helper, controller, or query helper
4. New small shared helper or pure mini-function
5. New reusable unit only when the earlier layers are insufficient

## Upgrade before duplicate

- If an existing reusable unit is outdated but structurally close, upgrade it in place when safe.
- Prefer widening props, renaming for clarity, or extracting a stable core over creating another almost-identical unit.
- Duplicate logic is a stronger signal than duplicate markup alone. Repeated formatters, mappers, and action handlers count too.

## Local vs shared extraction

- Keep a helper feature-local when only one screen or route needs it.
- Promote it to a shared helper only when two or more real surfaces need the same behavior.
- Do not force web and mobile into one abstraction when their view-layer differences are still meaningful.

## Strong extraction candidates

- status-to-label or color mapping
- request payload shaping
- option building for filters or selects
- date, currency, quantity, and membership copy formatting
- repeated modal submission or mutation state handling

## Weak extraction candidates

- one-off string interpolation
- styling that is unique to a single surface
- helpers whose only purpose is to hide obvious single-line code
