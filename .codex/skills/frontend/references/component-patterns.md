# Component Patterns

This repo favors body-owning but thin route or screen files, focused feature hooks, app-local Fit primitives, and reusable helpers that keep JSX trees small.

## 1. Thin route or screen body composition

Representative files:

- `apps/web/app/**/page.tsx`
- `apps/mobile/app/(auth)/**` and `apps/mobile/app/(tabs)/**`

Pattern:

- route or screen file owns the visible body assembly
- header, primary regions, state branches, section order, and overlay or modal mount points remain readable at the route level
- heavy behavior lives in hooks, controller helpers, query helpers, shared packages, or focused mini-functions
- components stay bounded: Fit primitives, sections, panels, tables, forms, modals, drawers, overlays, and page-specific slices

Use this when:

- a page or screen can be assembled from precise pieces
- behavior and data shaping belong elsewhere but the surface body should still be visible in `page.tsx` or the screen file

Avoid:

- making the route return only `XxxPageContent`, `XxxDashboard`, `XxxScreenContent`, or `XxxShell` when that child owns the full page or screen body

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
page.tsx or Expo Router screen body
  -> feature hook or controller
    -> query and mutation options
    -> helper functions or mappers
  -> app-local Fit primitives
  -> focused feature sections, cards, panels, modals, tables, forms, overlays
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
- keep the page or screen body assembled in the route file instead of moving it into one full-surface component
- reuse Fit form inputs, cards, buttons, search, filters, and sections instead of rebuilding layout primitives per page
- extract mini-functions when they remove repeated noise from JSX or controller bodies
