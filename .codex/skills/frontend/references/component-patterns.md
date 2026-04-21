# Component Patterns

This repo favors thin route files, focused feature hooks, app-local Fit primitives, and reusable helpers that keep JSX trees small.

## 1. Thin route wrappers

Representative file:

- `apps/web/app/(auth)/login/page.tsx`

Pattern:

- route file is often just a wrapper or assembly point
- heavy behavior lives in components, hooks, controller helpers, or focused mini-functions

Use this when:

- a page only needs to select the correct feature component
- routing concerns are simple and the feature logic belongs elsewhere

## 2. Feature hook or controller owns behavior

Representative files:

- `apps/web/hooks/facilities/useFacilities.ts`
- `apps/mobile/hooks/profile/useProfileScreen.ts`
- `packages/app-core/auth/createAuthController.ts`

Pattern:

- query and mutation wiring lives in hooks or controller helpers
- UI-facing derived state is computed close to the feature logic
- components receive already-shaped data and small handlers

Default split:

```text
route or screen
  -> feature page or screen component
    -> feature hook or controller
      -> query and mutation options
      -> helper functions or mappers
      -> app-local Fit sections, cards, modals, tables
```

## 3. Helpers and mini-functions are reusable surface area too

Representative shapes:

- label formatters
- status mappers
- small data shaping helpers
- modal submit handlers
- option builders

Pattern:

- move repeated inline logic out of JSX
- keep tiny pure helpers near the owning feature unless multiple features need them
- promote them to shared helpers only when the same logic is clearly recurring

Good candidates for extraction:

- repeated `status -> label/color` mapping
- repeated date or quantity formatting
- repeated action enable or disable logic
- repeated request payload shaping

## 4. Fit primitives are app-local

Representative exports:

- `apps/web/components/fit/index.ts`
- `apps/mobile/components/fit/index.ts`

What this means:

- web and mobile each have their own `Fit*` primitives
- prefer composing with these primitives before creating new raw inputs or buttons
- if a primitive is missing, add it near the existing app-local Fit layer instead of forcing a cross-platform abstraction too early

## 5. Upgrade outdated reusable pieces before duplicating them

Pattern:

- if an existing Fit primitive, helper, or controller is close but stale, modernize it in place when safe
- widen props, improve theme support, or tighten naming before creating another near-copy
- if the old unit is too narrow, extract the stable core and keep feature-specific differences local

Avoid:

- bypassing a nearly-correct reusable unit with page-local clones
- splitting the same logic across one component and two ad hoc helper blocks

## 6. Practical UI reduction rule

To reduce surface complexity without hiding logic:

- move data shaping into hooks or query helpers
- move action flows into controller helpers or dedicated handlers
- split modals, panels, and sections by responsibility
- reuse Fit form inputs, cards, buttons, search, filters, and sections instead of rebuilding layout primitives per page
- extract mini-functions when they remove repeated noise from JSX or controller bodies
