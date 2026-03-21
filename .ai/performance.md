# Performance Optimization Rules

## Guiding Principle

Every change must be evaluated not only for correctness and visual fidelity but also for its impact on render performance, memory pressure, and JS thread load. A feature that works but causes perceptible lag during inspection or on low-end devices is considered incomplete.

---

## Mobile Performance (`apps/mobile`)

### Reanimated

- Never read `sharedValue.value` during the render phase. Access `.value` only inside `useAnimatedStyle`, `useDerivedValue`, `useAnimatedReaction`, or `runOnUI` callbacks — not in `useCallback`, `useMemo`, `useEffect` deps, or the component body.
- Use `useDerivedValue` for derived animated values instead of computing inside `useAnimatedStyle`. Offloads computation to the UI thread and avoids redundant recalculation.
- Wrap `useThemeTransitionAnim` output in `useMemo` keyed on `[prevThemeKey, colors]` to prevent reconstructing the `ic` object on every render.
- Do not call `useThemeTransitionAnim` in components that do not theme-transition. If a component only uses static colors from `useTheme().colors`, do not import or call `useThemeTransitionAnim`.

### Style Factories

- All `makeXxxStyles(colors)` calls must be wrapped in `useMemo(() => makeXxxStyles(colors), [colors])`. Never call naked in the render body — it recreates the `StyleSheet` object on every render.
- When a factory accepts additional parameters (e.g. `makeFitInputFieldStyles(colors, compact)`), include all parameters in the `useMemo` dep array: `useMemo(() => makeFitInputFieldStyles(colors, compact), [colors, compact])`.

### TanStack Query (Mobile)

- Use `useQuery` for all API-sourced data. Do not fetch inside `useEffect` with manual `useState` loading/error state — that pattern is deprecated in this codebase.
- Set `enabled: !!userId` or similar guards on queries that depend on auth state to prevent fetching before a user is loaded.
- Use `queryClient.invalidateQueries({ queryKey: ['bookings'] })` inside `useMutation` `onSuccess` callbacks instead of the `bookingRefreshTick` counter pattern in `FABStateContext`.
- Do not call `refetch()` manually in response to user navigation — rely on `staleTime` and focus-based invalidation.

### BlurView (`expo-blur`)

- Gate `BlurView` on a boolean condition so it unmounts when not visible. Never keep a `BlurView` permanently mounted with `opacity: 0` — it continues to consume GPU resources while hidden.
- For overlay dimming that does not require blur, use a plain `View` with `backgroundColor: "rgba(0,0,0,0.35)"`. Reserve `BlurView` only where the blur effect is visually significant.

### Conditional Rendering

- Conditionally render expensive components (modals, heavy lists) rather than keeping them mounted with `display: none` or `opacity: 0`.
- Use `React.memo` on pure presentational components that receive stable props.
- Avoid anonymous object creation in JSX `style` props. Move static styles to `StyleSheet.create` or a factory.

### StyleSheet and Deprecated Props

- `shadow*` props are deprecated on React Native Web. Use `boxShadow` string + `elevation` for cross-platform shadow.
- `pointerEvents` must be in `style`, not as a JSX prop.

### Lists and Scrollables

- Use `FlatList` or `SectionList` for lists with more than ~10 items. `ScrollView` renders all children at once — use it only for short, bounded content.
- Set `removeClippedSubviews` on `FlatList` when the list is long.
- Avoid `useAnimatedScrollHandler` on every screen unless scroll-driven animations are actually needed. Plain `onScroll` with `scrollEventThrottle={16}` is sufficient for FAB hide/show.

### Callbacks and Memos

- Wrap all callbacks passed as props to child components in `useCallback` to prevent unnecessary re-renders of memoized children.
- `useFocusEffect` callbacks must be wrapped in `useCallback` with correct deps.
- `menuItems` arrays in FAB-enabled screens must be inside `useMemo`.

### Shared Hooks from `@fittrack/hooks`

- `useDebounce`, `useLoadingText`, `useTimedMessage` must be imported from `@fittrack/hooks`. Local copies in `apps/mobile/hooks/` are deprecated — the agent must update import paths when touching files that use them.

### General

- No `console.log` in production paths. Use `if (__DEV__) console.log(...)`.
- Minimize `useEffect` dependency arrays. Overly broad arrays cause effects to re-run on unrelated state changes.

---

## Web Performance (`apps/web`)

### Style Factories

- `makeXxxStyles(colors)` returns a plain object of `CSSProperties`. Call it once outside JSX or memoize if the component re-renders frequently: `const s = useMemo(() => makeDashboardStyles(colors), [colors])`.
- Do not call style factory functions inside JSX expressions — call once at the top of the component and reference by key.

### TanStack Query (Web)

- Use `useQuery` and `useMutation` for all server state. Do not fetch inside `useEffect` with manual `useState` loading/error state — that pattern is not permitted for new code.
- Query keys follow the convention `['resource']` or `['resource', id]`. Examples: `['members']`, `['deletion-requests']`, `['bookings']`, `['venues']`, `['coaches']`.
- Always call `queryClient.invalidateQueries({ queryKey: ['resource'] })` inside `useMutation` `onSuccess` to keep cache fresh after mutations.
- Use `select` option on `useQuery` to derive filtered/transformed data rather than computing in the component body with `useMemo`.
- Set `staleTime` on infrequently-changing data (e.g. venues, coaches) to avoid unnecessary refetches: `staleTime: 5 * 60_000`.

### "use client" Boundary Size

- Keep client component files small and focused. Split large page files into smaller sub-components.
- Do not mark an entire layout or provider wrapper `"use client"` if only a leaf node needs it — though the dashboard layout is already `"use client"` due to auth/resize logic.

### Recharts

- All Recharts charts must be wrapped in `<ResponsiveContainer>` with explicit `height`.
- Do not render chart components in SSR context — they are always inside `"use client"` pages so this is handled automatically.
- For large datasets, memoize chart data with `useMemo` before passing as `data` prop.

### framer-motion

- Use `motion` components and `animate`/`useMotionValue` only for entrance animations and directional slides where CSS transitions are insufficient.
- Do not use framer-motion for theme-change color transitions — those are handled by `useThemeTransition()` returning a CSS transition class string.
- Wrap framer-motion animation definitions in `useMemo` when they depend on props or state to avoid object recreation on every render.

### Image Optimization

- Use `next/image` for all images. Never use raw `<img>` tags.
- Set `width`, `height`, or `fill` on every `<Image>` to avoid layout shift (CLS).

### Shared Hooks from `@fittrack/hooks`

- `useDebounce`, `useLoadingText`, `useTimedMessage` must be imported from `@fittrack/hooks`. Local copies in `apps/web/hooks/` are deprecated — the agent must update import paths when touching files that use them. The `"use client"` directive is not needed in the shared package versions.

### Tailwind Purging

- The `content` array in `tailwind.config.ts` covers `./app/**/*.{ts,tsx}`, `./components/**/*.{ts,tsx}`, `./contexts/**/*.{ts,tsx}`. Do not create Tailwind class strings via runtime string concatenation — Tailwind's purge cannot detect dynamically built class names. Use `cn()` with static class strings.

### Callbacks and Memos

- Wrap stable callbacks with `useCallback` when passed to memoized children.
- Memoize expensive computed values with `useMemo`.
- Use `useCallback` for event handlers that are passed to deeply nested components (e.g. Sidebar toggle, header search handler).

### General

- No `console.log` in production. Use `if (process.env.NODE_ENV === "development") console.log(...)`.
- Avoid `useEffect` with broad dep arrays.
- Do not import entire icon libraries — import lucide icons individually: `import { Bell } from "lucide-react"`.
- Use `Suspense` and `loading.tsx` boundaries for any future async page segments.