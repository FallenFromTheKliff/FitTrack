# Component Rules

## Shared Rules

- Prefer app-local Fit primitives before creating one-off controls.
- Shared packages should hold platform-neutral logic, contracts, tokens, validators, query options, and controllers.
- Do not assume `packages/ui` is a cross-platform component library. It currently exports tokens, themes, fonts, radii, max widths, and style constants.
- Identical logic can move to `@fittrack/app-core`, `@fittrack/utils`, `@fittrack/hooks`, or `@fittrack/query` when it is genuinely shared.
- Identical visual vocabulary should still be implemented with app-local rendering primitives unless a real shared package already owns it.
- Forms use `react-hook-form` and shared Zod schemas when available.
- Do not over-extract a one-off component that appears only once, but it must still follow FitTrack design and contract rules.
- Fit primitives should replace redundant static controls where a local primitive already covers the behavior.

## Page And Screen Body Ownership

- Web `page.tsx` files and mobile Expo Router screen files must own the body composition of their respective page or screen.
- Do not move the whole body into a single route surrogate component such as `XxxPageContent`, `XxxDashboard`, `XxxScreenContent`, or `XxxShell` just so the route file can return one child.
- Route and screen files should visibly assemble the header, primary regions, state branches, section order, and overlay or modal mount points for that surface.
- Components are building blocks. They should be precise and bounded like Fit primitives, feature sections, cards, controls, tables, forms, modals, drawers, overlay frames, or page-specific panels.
- Page-specific components are allowed when they own a surgical slice of the surface. They should not become the hidden owner of the entire page or screen.
- Hooks and controllers own behavior; route and screen files own body assembly; components own reusable or page-local pieces.

## Mobile Components

Use Fit components where they exist:

- `FitAvatarImage`
- `FitButton`
- `FitCard`
- `FitFAB`
- `FitFABMenu`
- `FitFilter`
- `FitInputField`
- `FitSearch`
- `FitSection`
- `FitSquareToggle`
- `FitText`

Raw React Native primitives are acceptable for layout, wrappers, animated wrappers, custom canvas/camera surfaces, and interactions with no Fit equivalent.

### Mobile Placement

| Type | Location |
|---|---|
| Routes | `apps/mobile/app/(auth)` and `apps/mobile/app/(tabs)` |
| Fit primitives | `apps/mobile/components/fit/` |
| Feature components | `apps/mobile/components/{feature}/` |
| Modals | `apps/mobile/components/modals/{category}/` |
| Feature hooks/controllers | `apps/mobile/hooks/{feature}/` |
| Shared mobile styles | `apps/mobile/styles/shared/` |
| Component styles | `apps/mobile/styles/components/` |
| Modal styles | `apps/mobile/styles/modals/` |

## Web Components

Files using hooks, browser APIs, state, refs, callbacks, effects, or event handlers must begin with `"use client"`.

Use web Fit components where they exist:

- `FitButton`
- `FitCard`
- `FitChartContainer`
- `FitFilter`
- `FitInputField`
- `FitPagination`
- `FitPill`
- `FitSearch`
- `FitSection`
- `FitTable`
- `FitText`

### Web Placement

| Type | Location |
|---|---|
| Public/landing routes | `apps/web/app/(land)/` |
| Authenticated portal routes | `apps/web/app/(auth)/` |
| Dev-only routes | `apps/web/app/(land)/dev/` |
| Payment status routes | `apps/web/app/(land)/payments/` |
| Fit primitives | `apps/web/components/fit/` |
| Layout components | `apps/web/components/layout/` |
| Feature components | `apps/web/components/{feature}/` |
| Modal components | `apps/web/components/modals/` |
| Route controllers/hooks | `apps/web/hooks/{feature}/` |
| API client | `apps/web/lib/api-client.ts` |
| Query provider/client | `apps/web/lib/queryClient.tsx` |
| Style factories | `apps/web/styles/` |

## Web Styling

- Page/layout surfaces use `makeXxxStyles(colors)` factories that return `CSSProperties`.
- Fit components use Tailwind utilities through `cn()` and token classes.
- Avoid Tailwind class piles directly on page-level layout `div`s when a style factory already exists for that surface.
- Use `FitChartContainer` or explicit stable dimensions around Recharts.
- Use `FitTable`, `FitPagination`, and `FitPill` before custom table/status/pagination patterns.

## Modal Rules

- Mobile modals should close through explicit actions, not outside tap.
- Mobile drawers and sidebars may close on backdrop tap when the backdrop is part of navigation chrome rather than a form, payment, booking, exercise, or destructive modal.
- Android hardware-back dismissal should be treated like a close action only when data loss is impossible or the modal has a clear cancel path.
- Web modals may close on overlay click when consistent with the local modal component.
- Destructive actions should use the existing confirmation modal pattern before adding a new destructive flow.
- Major modal redesigns should preserve existing data and mutation paths unless a task explicitly changes the product behavior.

## Duplication Rule

Before creating a component or helper:

1. Check app-local Fit primitives.
2. Check feature components in the same app.
3. Check `@fittrack/app-core`, `@fittrack/query`, `@fittrack/api-client`, `@fittrack/hooks`, `@fittrack/utils`, and `@fittrack/validators`.
4. Extract a small app-local helper if reuse is local.
5. Move to shared packages only when both surfaces or multiple features actually need the same non-visual logic.
