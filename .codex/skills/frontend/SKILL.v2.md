---
name: frontend
description: "Use for FitTrack frontend work across apps/web and apps/mobile: pages, screens, Fit primitives, feature components, hooks, helpers, controllers, query wiring, forms, auth flows, runtime polish, and frontend refactors that must match current repo patterns."
---

# FitTrack Frontend

Use this skill when adding or refactoring web or mobile UI in the FitTrack monorepo.

## Changelog

- 2026-04-13: expanded dynamic reusability across components, hooks, helpers, controllers, query helpers, and mini-functions; added runtime polish defaults and auth-role verification guidance.
- 2026-04-14: added UI-first handoff defaults, revision-heavy safety guidance, shared-client compatibility checks, and clearer MCP expectations for bounded frontend work.
- 2026-04-17: added anti-bloat enforcement, page architecture rules, UI elevation rules, motion guidance, and stronger MCP routing for Context7, Figma, Browser DevTools, and Exa-backed research handoffs.
- 2026-04-18: added a shared premium preset for motion timing, navigation experience, data-rendering discipline, and Magic UI-assisted microinteraction guidance on flagged premium surfaces.
- 2026-04-18: added route-vs-mode honesty and low-signal list or table cleanup so polished child modes cannot hide weak default route surfaces.
- 2026-04-18: added the route-wide rebuild gate so flagged admin pages are implemented from an approved route packet and Figma wireframes instead of isolated patch targets.
- 2026-04-19: added keep-replace-remove-add enforcement so approved route rebuilds can replace weak legacy functionality patterns instead of preserving them by inertia.
- 2026-04-19: added scaffold-first 1:1 implementation guidance so approved premium runs adapt theme and components without drifting from the scaffold.

## First pass

- Use Serena before broad repo scans.
- Ignore generated or noisy paths: `.artifacts/`, `apps/mobile/dist-web-auth-check/`, `apps/web/.next/`, `apps/mobile/.expo/`, `node_modules/`, and build outputs.
- Read only the smallest needed reference:
  - `references/component-patterns.md`
  - `references/reusability-ladder.md`
  - `references/api-client.md`
  - `references/route-map.md`
  - `references/runtime-polish.md`

## UI-first handoff defaults

- When the flow is still visually or interaction-wise unstable, let `frontend-uiux-polish` shape the surface first and then use this skill to lock reusable architecture, controller logic, and query wiring.
- If the page can be completed with presentation-only work, do not widen into backend or shared-client changes here.
- If the touched surface exposes contract drift, auth handling gaps, or backend-owned state problems, hand the seam back to `integration` or `backend` instead of hiding it in UI code.
- If a surface is functional but still static, crowded, flat, or structurally bloated, it is not done. Either elevate it here or hand it to `frontend-uiux-polish` first.
- When a premium-gap scan recommends removing duplicated metrics, reweighting data, splitting sections, or changing modal versus rail versus inline patterns, implement the smaller coherent architecture that matches the scan instead of preserving legacy composition by default.
- If the premium review verdict is `needs_component_replacement`, implement the approved replacement pattern instead of preserving the legacy table, rail, card, pagination, or task-view shell out of habit.
- If the scan recommends that a secondary workflow should become a tab, toggle, lower container, or child surface, prefer that containment model over preserving a competing permanent side panel.
- Free component replacement is allowed for flagged premium runs when the new pattern preserves or improves operator efficiency and stays FitTrack-native.
- When an approved scaffold exists, implement it 1:1 before making tasteful adjustments. Adapt theme, typography settings, accessibility, and reusable boundaries without changing the approved composition.
- Preserve the sequence: major component quality first, motion last. Do not ship fancy animation on top of weak pagination, weak filters, or weak table composition.
- For flagged premium runs, implement the approved navigation experience and data-rendering priorities before micro-polish:
  - one dominant command surface
  - obvious back paths and reversible state switches
  - supporting data kept secondary to the current task
- If only a child mode changed, do not assume the default route surface is now premium. Finish the landing state or report the route as still elevated.
- When a `premium-route-rebuild` packet exists, implement the route from that approved packet:
  - respect the approved `Keep / Replace / Remove / Add` matrix
  - route shell or controller
  - landing command deck
  - primary surface
  - contained secondary surfaces
  - create or task surface
  - overlay manager
- Do not reopen the route structure unless a real blocker appears. Prefer finishing the approved route slices over inventing new ones mid-run.
- If the approved packet still contains unresolved `Needs user decision` items, stop and hand the run back to `integration` instead of silently choosing one implementation branch.
- If a weak legacy interaction pattern was explicitly marked `Replace` or `Remove`, do not preserve it in code just because it already works.
- Do not replace an approved scaffold with a more generic reusable shell just to save code lines. Componentize under the scaffold instead of reshaping the scaffold to fit the components.

## Revision-heavy mode

- In active revision work, prefer the narrowest reusable fix that preserves neighboring behavior.
- Avoid wide helper or hook rewrites until the touched surface proves they are necessary.
- When changing a shared hook, controller, or query helper, scan its consumers first and keep the change backward-compatible unless the orchestrator already budgeted the wider update.
- For user-facing features, assume the UI shape should settle before pushing endpoint widening or large shared refactors.

## Repo defaults

- Web uses Next App Router with route groups under `app/(admin)` and `app/(auth)`.
- Mobile uses Expo Router with route groups under `app/(auth)` and `app/(tabs)`.
- Data access goes through `packages/api-client` and `packages/query`, not ad hoc `fetch` or one-off axios instances inside components.
- State is TanStack Query plus React context or controller helpers, not Redux or Zustand.
- Forms use `react-hook-form` with `zod` and `@fittrack/validators`.
- Auth tokens go through `createTokenStore`: `localStorage` on web, `AsyncStorage` on mobile.
- Shared action orchestration usually belongs in `packages/app-core`, feature hooks, or focused helpers, not route shells.

## Dynamic reusability rule

- Treat reusability as a full-surface policy across app-local `Fit*` primitives, feature components, hooks, helpers, controller utilities, query-shaping helpers, and small pure mini-functions.
- Apply this reuse ladder for touched frontend work:
  1. reuse an existing app-local `Fit*` primitive
  2. reuse an existing feature component or section
  3. reuse an existing hook, helper, controller, or query helper
  4. extract a small shared helper or pure mini-function
  5. create a new reusable unit only when the earlier layers are genuinely insufficient
- When a reusable unit is outdated but still structurally close to the need, upgrade it in place when safe instead of bypassing it with duplicate one-off logic.
- If the same formatter, label mapper, conditional branch, submit handler, or status helper appears twice, prefer extraction.
- Keep extraction scopes small and boring. Do not invent a cross-app abstraction when app-local reuse is enough.

## Page architecture rule

- Use this shape by default:
  - route or screen
  - feature page shell
  - sections or focused panels
  - hook or controller
  - query shapers, helpers, and pure mappers
  - Fit primitives
- Route or screen files should mostly assemble sections and hand off behavior.
- Multi-responsibility files that own large JSX trees, many local states, several modals, and multiple mutation flows at once are structural failures, not just untidy code.
- Split by section, modal flow, or controller seam before the page becomes a giant local command center.
- For route-wide rebuilds, split by route state first and then by section or overlay inside that state.

## Thin surface rule

- Keep route or screen files thin.
- Move orchestration into feature hooks, contexts, controller helpers, or focused feature helpers.
- Keep data shaping near query or controller helpers instead of inside large JSX trees.
- Promote repetitive inline conditions, formatters, mappers, and action handlers into reusable mini-functions when they are likely to recur.
- Compose UI through app-local `Fit*` primitives and focused feature components.
- Do not pretend `@fittrack/ui` is a full shared component library. In this repo it is mainly tokens, theme helpers, and shared styling primitives.
- Thin wrappers are not enough on their own; the surface must still feel complete and believable.

## Theme fidelity rule

- Preserve the existing FitTrack visual language when refactoring or generating UI.
- Preserve identity, not old composition. Theme, token language, and brand voice may stay while weak layout and legacy controls are replaced.
- When implementing from an approved scaffold, preserve the scaffold's layout grammar and proportions at normal desktop zoom.
- Prefer `useTheme`, `make*Styles`, animated theme helpers, and app-local `Fit*` primitives over one-off palettes, spacing systems, or wrapper abstractions.
- New components should look native to the current app shell, not like generic AI-generated card piles or mismatched design experiments.
- When extracting or upgrading reusable units, keep theme transitions, tokens, and shared surface styling intact so the result inherits the current app look automatically.

## Platform rules

- Web files using hooks or browser APIs must start with `"use client"`.
- Mobile routing should keep Expo Router paths simple and role-aware.
- Reuse existing auth, theme, and feature contexts before adding a new one.
- Prefer the existing `packages/app-core` controller helpers when the UI needs reusable action orchestration.

## Shared-client compatibility checklist

- Check whether the touched flow also depends on:
  - `packages/api-client`
  - `packages/query`
  - `packages/app-core`
  - shared validators or auth storage behavior
- Keep field transforms close to the client or query layer instead of renaming the same data shape across multiple screens.
- If a screen or route needs a new field, first check whether the nearest controller, helper, or query layer is the right place to expose it once for all consumers.
- When changing role-aware or auth-aware behavior, preserve the existing token-store and refresh expectations unless the orchestrator explicitly widened the auth seam.

## MCP expectations

- `Serena` is required for discovery and existing-pattern lookup.
- `Context7` is allowed when framework or library truth matters more than local convention memory.
- `Figma` is allowed for high-value UI direction or design-to-code clarification, not routine tiny tweaks.
- When Figma is part of an approved route packet, use exact frame or component nodes with `get_design_context` and `get_screenshot` instead of implementing from memory.
- `Magic UI` is allowed for motion, hover, and tasteful transition inspiration after the structure is already right.
- `chromeDevtools` belongs to runtime diagnosis or targeted UI verification after the owning surface is implemented.
- `Exa` is not an implementation MCP here; use it only when the orchestrator explicitly routes outside research or benchmark inspiration into this lane.
- `Playwright` belongs to verification, not ordinary implementation, unless the orchestrator explicitly puts this skill into a runtime-check lane.

## Runtime verification defaults

- Use `.playwright-fittrack-flow.json` as the runtime source of truth when auth-role verification or post-login navigation matters.
- Web verification defaults:
  - login route: `/login`
  - protected route: `/dashboard`
  - allowed roles: `ADMIN`, `STAFF`
  - denied roles: `USER`, `COACH`
- Mobile Expo-web verification defaults:
  - login route: `/login`
  - protected route from config: `/`
  - expected landing usually resolves to the home tab
  - allowed roles: `USER`
  - denied roles: `ADMIN`, `STAFF`, `COACH`
- When the same feature exists on both web and mobile, check parity before treating the surface as done.
- Verify visible post-action state, not only network activity.

## Performance guardrails

- Keep ordinary mobile tab screens mounted. Do not combine Expo tab detachment with `if (!isFocused) return null` or similar full-screen blur unmounts for normal tabs; that pattern causes tab-switch lag through remounts, animation resets, and query churn.
- Use focus to pause heavy side effects or refresh data, not to tear down the entire screen tree. Reserve blur-time teardown for truly heavy resources such as camera, live pose tracking, or streaming sessions.
- Prefer cached TanStack Query data, focused invalidation, and controller-level derivations over refetching and recomputing large screen trees on every tab switch.
- When a screen has expensive derived UI, split it into smaller sections, lazily mounted modals, or non-urgent updates with `startTransition` instead of blocking navigation.
- Keep animations short and meaningful. Avoid stacking whole-screen entrance animations with forced remount patterns on tab navigation.

## Motion and delight rule

- Base motion:
  - hover, press, focus, elevation, and tiny opacity or scale shifts
- Structural motion:
  - modal open or close, drawers, section reveals, filter panel transitions, and step transitions
- Reward motion:
  - achievement reveal, XP gain, milestone card reveal, streak continuation feedback
- Keep celebration effects rare and earned. Do not spray particles or heavy animation across ordinary controls.
- On mobile, prefer press feedback and state transitions over hover assumptions.
- Respect reduced-motion expectations and do not make motion the only carrier of meaning.
- For flagged premium runs, use these timing defaults unless the touched surface has a strong reason to diverge:
  - micro feedback: `120-160ms`
  - state switches and segmented transitions: `180-220ms`
  - drawers, sticky footers, modals, and larger panels: `220-280ms`

## Navigation and data-rendering rule

- Dedicated task flows should replace the main content area or become a child surface when that creates a clearer operator experience.
- Route-wide rebuilds should implement coordinated state transitions and obvious back paths across the whole route, not only the create flow.
- Avoid local swaps that leave the old page chrome competing with the new task unless the scan explicitly approves that structure.
- Let the most actionable data own the page. Supporting counts, helper copy, and secondary summaries should stay quieter than the main list, table, task view, or command surface.
- Prefer standard pagination, clear filter ownership, concise status treatment, and obvious drill-in paths over decorative dashboard clutter.
- If a table or list is dominated by repetitive row values, mostly-empty columns, or oversized row chrome, regroup or suppress that information instead of preserving it out of habit.

## UI completion checklist

- Visible primary actions must either work, be intentionally hidden, or be explicitly documented as blocked.
- Modal-triggered flows must open, close, and submit or cancel cleanly.
- Sorting and filtering controls must be usable and match the data model the page exposes.
- Loading, empty, error, retry, pending, and success states must be explicit for touched async flows.
- Success and failure feedback should be visible after meaningful user actions.
- Layout must adapt intentionally across narrow mobile, normal desktop, and wide admin widths when the surface supports them.
- Important controls should have believable hover, press, focus, or transition feedback instead of feeling dead.
- Broken navigation return paths, dead controls, and uncanny status labels are completion bugs, not optional polish.
- If the page's most important data is visually secondary to decorative or low-value information, the page is not complete.
- If the route's default landing state still carries oversized section headers, dead top bands, or low-signal row design, the page is not complete even when a child task mode is strong.
- When the same feature exists on both web and mobile, check parity before treating the surface as done.

## Polish-phase bug bar

- Treat stale branding, mojibake or encoding glitches, awkward labels, broken modal flows, layout jitter, weak spacing, missing empty or error states, dead-feeling interaction feedback, and browser-visible warnings that degrade the actual flow as completion bugs or explicit triage items.
- Verified but uncanny output is still a miss even when the data contract technically works.
- External asset failures or outdated reusable surfaces should be repaired or explicitly classified, not ignored because the page still renders.

## Future extension rule

- If a new framework or library is added later, scan the repo first and extend the nearest proven pattern.
- Do not create a parallel data layer, form layer, or UI architecture because a new package exists.

## Output defaults

- Favor thin wrappers, feature hooks, controller helpers, focused feature components, and small helper functions over huge route files.
- Keep loading, error, empty, pending, and success states explicit for async UI.
- Keep shared contract transforms near the API or query layer instead of scattering field remaps across screens.
- Fix decision-safe completion gaps on the touched surface before treating the page as finished.
- Keep generated UI intentional and production-looking: consistent spacing, clear hierarchy, adaptive layout, believable motion, strong modal behavior, and the existing FitTrack theme language should do most of the visual work.
- If the change is broad enough to risk nearby modules, stop and hand the coupling decision back to `integration` instead of guessing the safe blast radius inside the frontend lane.

## Examples

- See `examples/good-outputs.md`.
- Avoid the anti-patterns in `examples/bad-outputs.md`.
