---
name: frontend
description: "Use for FitTrack frontend work across apps/web and apps/mobile: pages, screens, hooks, controllers, forms, query wiring, API client usage, auth flows, modular Fit components, and frontend refactors that must match current repo patterns."
---

# FitTrack Frontend

Use this skill when adding or refactoring web or mobile UI in the FitTrack monorepo.

## First pass

- Use Serena before broad repo scans.
- Ignore generated or noisy paths: `.artifacts/`, `apps/mobile/dist-web-auth-check/`, `apps/web/.next/`, `apps/mobile/.expo/`, `node_modules/`, and build outputs.
- Read only the smallest needed reference:
  - `references/component-patterns.md`
  - `references/api-client.md`
  - `references/route-map.md`

## Repo defaults

- Web uses Next App Router with route groups under `app/(admin)` and `app/(auth)`.
- Mobile uses Expo Router with route groups under `app/(auth)` and `app/(tabs)`.
- Data access goes through `packages/api-client` and `packages/query`, not ad hoc `fetch` or one-off axios instances inside components.
- State is TanStack Query plus React context or controller helpers, not Redux or Zustand.
- Forms use `react-hook-form` with `zod` and `@fittrack/validators`.
- Auth tokens go through `createTokenStore`: `localStorage` on web, `AsyncStorage` on mobile.

## Modular UI rule

- Keep route or screen files thin.
- Move orchestration into feature hooks, contexts, or shared controller helpers.
- Compose UI through app-local `Fit*` primitives and focused feature components.
- Do not pretend `@fittrack/ui` is a full shared component library. In this repo it is mainly tokens, theme helpers, and shared styling primitives.
- Thin wrappers are not enough on their own; the surface must still feel complete.

## Theme fidelity rule

- Preserve the existing FitTrack visual language when refactoring or generating UI.
- Prefer `useTheme`, `make*Styles`, animated theme helpers, and app-local `Fit*` primitives over one-off palettes, spacing systems, or wrapper abstractions.
- New components should look native to the current app shell, not like generic AI-generated card piles or mismatched design experiments.
- When extracting components, keep theme transitions, tokens, and shared surface styling intact so the result inherits the current app look automatically.

## Platform rules

- Web files using hooks or browser APIs must start with `"use client"`.
- Mobile routing should keep Expo Router paths simple and role-aware.
- Reuse existing auth, theme, and feature contexts before adding a new one.
- Prefer the existing `packages/app-core` controller helpers when the UI needs reusable action orchestration.

## Performance guardrails

- Keep ordinary mobile tab screens mounted. Do not combine Expo tab detachment with `if (!isFocused) return null` or similar full-screen blur unmounts for normal tabs; that pattern causes tab-switch lag through remounts, animation resets, and query churn.
- Use focus to pause heavy side effects or refresh data, not to tear down the entire screen tree. Reserve blur-time teardown for truly heavy resources such as camera, live pose tracking, or streaming sessions.
- Prefer cached TanStack Query data, focused invalidation, and controller-level derivations over refetching and recomputing large screen trees on every tab switch.
- When a screen has expensive derived UI, split it into smaller sections, lazily mounted modals, or non-urgent updates with `startTransition` instead of blocking navigation.
- Keep animations short and meaningful. Avoid stacking whole-screen entrance animations with forced remount patterns on tab navigation.

## UI completion checklist

- Visible primary actions must either work, be intentionally hidden, or be explicitly documented as blocked.
- Modal-triggered flows must open, close, and submit or cancel cleanly.
- Sorting and filtering controls must be usable and match the data model the page exposes.
- Loading, empty, error, retry, and pending states must be explicit for touched async flows.
- Success and failure feedback should be visible after meaningful user actions.
- Broken navigation return paths, dead controls, and uncanny status labels are completion bugs, not optional polish.
- When the same feature exists on both web and mobile, check parity before treating the surface as done.

## Future extension rule

- If a new framework or library is added later, scan the repo first and extend the nearest proven pattern.
- Do not create a parallel data layer, form layer, or UI architecture because a new package exists.

## Output defaults

- Favor thin wrappers, feature hooks, controller helpers, and small section or modal components over huge route files.
- Keep loading, error, and empty states explicit for async UI.
- Keep shared contract transforms near the API or query layer instead of scattering field remaps across screens.
- Fix decision-safe completion gaps on the touched surface before treating the page as finished.
- Keep generated UI intentional and production-looking: consistent spacing, clear hierarchy, and the existing FitTrack theme language should do most of the visual work.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
