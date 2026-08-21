# Performance Rules

## Guiding Principle

Every change must be evaluated for correctness, visual fidelity, render cost, memory pressure, network churn, and JS thread load. A feature that works but causes perceptible lag during normal use is incomplete.

## Agent Runtime Performance

- On a 16 GB RAM machine, avoid running Docker, web, mobile, browser automation, and semantic indexing together.
- Use local static evidence first: file reads, `rg`, git diff/status, focused type/lint/test commands, and existing package contracts.
- Treat MCPs as precision tools, not default discovery. Each MCP call should answer a named question that local static evidence cannot answer efficiently.
- Keep at most one heavy tool lane active per phase, such as Browser/Playwright, ChromeDevTools, Figma, Notion, Swagger, Docker, emulator, or semantic indexing.
- Do not launch a dev server, browser session, emulator, Docker service, or MCP workflow for rule edits, file-only audits, or documentation-only tasks.
- Prefer focused static checks before runtime checks.
- Avoid full monorepo builds unless explicitly requested.
- Avoid navigation-driven or hidden verification loops.
- Never use repeated screenshots as the main reasoning loop.
- For mobile work, do not launch Android Emulator unless explicitly requested.
- For web work, prefer one browser verification pass only after code changes.
- For backend contract checks, prefer shared packages and frontend usage before reading backend source.
- If resource pressure is suspected, stop and report instead of continuing.

## Mobile Performance

### Reanimated

- Never read `sharedValue.value` during render.
- Access `.value` only inside Reanimated worklets such as `useAnimatedStyle`, `useDerivedValue`, `useAnimatedReaction`, or `runOnUI`.
- Use `useDerivedValue` for derived animated values when the computation can live on the UI thread.
- Do not call `useThemeTransitionAnim()` in components that do not animate theme values.

### Style Factories

- Wrap `makeXxxStyles(colors)` calls in `useMemo`.
- Include all factory parameters in the dependency array.
- Avoid anonymous object creation in frequently rendered JSX style props.

### Query And API

- Use `@fittrack/query` and `mobileApiClient` from `apps/mobile/lib/api-client.ts` for API-sourced data.
- Use `useQuery` for API reads and `useMutation` for writes.
- Guard auth-dependent queries with `enabled`.
- Invalidate or patch cache through `@fittrack/query` helpers after mutations where available.
- Do not refetch manually on ordinary navigation when stale time, focus behavior, or explicit invalidation is sufficient.

### Lists And Heavy Views

- Use `FlatList` or `SectionList` for long lists.
- Keep ordinary tab screens mounted. Use focus to pause heavy work, not to unmount the whole screen tree.
- Reserve blur-time teardown for heavy resources such as camera, pose tracking, streaming, or sensors.
- Conditionally render expensive modals and camera/pose surfaces when not visible.

### Blur And Overlays

- Unmount `BlurView` when hidden.
- Use plain dim overlays when blur is not visually important.

### Hooks And Callbacks

- Wrap callbacks passed to memoized children in `useCallback`.
- Wrap `useFocusEffect` callbacks in `useCallback`.
- Keep FAB menu arrays and expensive derived UI in `useMemo`.
- Import `useDebounce`, `useLoadingText`, and `useTimedMessage` from `@fittrack/hooks`.

## Web Performance

### Style Factories

- Call `makeXxxStyles(colors)` once per component render, preferably memoized for frequently-rendering surfaces.
- Do not call style factories inside JSX expressions.
- Keep page shells thin but body-owning; move repeated view logic into focused components or hooks without hiding the whole page behind one child component.

### Query And API

- Use `@fittrack/query` and `webApiClient` from `apps/web/lib/api-client.ts` for API-sourced data.
- Use exported query option factories, mutation option factories, query keys, and invalidation helpers from `@fittrack/query`.
- Avoid raw request calls inside `useEffect` for new work.
- Server-only Next route fetches may exist for auth/bootstrap work when they use `cache: "no-store"` and do not duplicate a reusable shared client path.
- Use `select` or controller/helper transforms when the same derivation is reused or expensive.
- Set appropriate `staleTime` for infrequently changing data.
- User-triggered refresh controls may call `refetch()` when they represent an explicit Retry/Refresh action. Avoid hidden or navigation-driven manual refetch loops.

### Client Boundaries

- Keep client components focused.
- Do not mark a broad layout or provider client-only if a leaf component can own the browser behavior, except where the existing shell already needs auth/theme/resize state.
- Split oversized route files by section, controller hook, modal flow, or overlay manager, not by replacing the route body with one full-page surrogate component.

### Charts

- Wrap Recharts in `FitChartContainer` or a container with stable explicit dimensions.
- Memoize large chart datasets.
- Avoid rendering charts before the container has a meaningful size.

### Motion

- Use `useThemeTransition()` for theme-change color transitions.
- Use `framer-motion` for meaningful entrance, directional, or state transitions only after layout and data behavior are settled.
- Memoize reusable animation definitions when they depend on props/state.

### Images

- Use `next/image` for app images where possible.
- Provide stable `width`, `height`, or `fill` constraints to avoid layout shift.

### Hooks And Controllers

- Import shared hooks from `@fittrack/hooks`.
- Prefer `@fittrack/app-core` controllers/transforms for repeated action orchestration instead of duplicating async flow helpers inside route components.
- Wrap event handlers passed deeply or to memoized children in `useCallback`.
- Memoize expensive derived values.

### General

- Avoid production `console.log`.
- Avoid broad effect dependency arrays that rerun unrelated work.
- Import lucide icons individually.
- Use loading boundaries or route-local loading states for future async segments where appropriate.
