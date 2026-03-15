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

### General

- No `console.log` in production paths. Use `if (__DEV__) console.log(...)`.
- Minimize `useEffect` dependency arrays. Overly broad arrays cause effects to re-run on unrelated state changes.

---

## Web Performance (`apps/web`)

### Style Factories

- `makeXxxStyles(colors)` returns a plain object of `CSSProperties`. Call it once outside JSX or memoize if the component re-renders frequently: `const s = useMemo(() => makeDashboardStyles(colors), [colors])`.
- Do not call style factory functions inside JSX expressions — call once at the top of the component and reference by key.

### "use client" Boundary Size

- Keep client component files small and focused. Split large page files into smaller sub-components.
- Do not mark an entire layout or provider wrapper `"use client"` if only a leaf node needs it — though the dashboard layout is already `"use client"` due to auth/resize logic.

### Recharts

- All Recharts charts must be wrapped in `<ResponsiveContainer>` with explicit `height`.
- Do not render chart components in SSR context — they are always inside `"use client"` pages so this is handled automatically.
- For large datasets, memoize chart data with `useMemo` before passing as `data` prop.

### Image Optimization

- Use `next/image` for all images. Never use raw `<img>` tags.
- Set `width`, `height`, or `fill` on every `<Image>` to avoid layout shift (CLS).

### Data Fetching

- All data is currently local mock data. When real API calls are added, use TanStack Query (`useQuery`, `useMutation`) for client-side data. Set appropriate `staleTime` in the Query client (default `60_000`ms from `@fittrack/query`).
- For infrequently changing reference data (member tiers, amenity lists), define in `data/` files and import directly — do not use `useQuery` for truly static data.

### Tailwind Purging

- The `content` array in `tailwind.config.ts` covers `./app/**/*.{ts,tsx}`, `./components/**/*.{ts,tsx}`, `./contexts/**/*.{ts,tsx}`. Do not create Tailwind class strings via runtime string concatenation — Tailwind's purge cannot detect dynamically built class names. Use `cn()` with static class strings.

### Animations

- Use `useFadeIn` for entrance animations — it respects `animationLevel` and skips animation when set to `"none"`.
- Use CSS `transition` properties (via `useThemeTransition`) for theme color changes — not JS-driven updates.
- Do not animate `width`, `height`, or layout-affecting properties in hot paths. Prefer `opacity` and `transform`.

### Callbacks and Memos

- Wrap stable callbacks with `useCallback` when passed to memoized children.
- Memoize expensive computed values with `useMemo`.
- Use `useCallback` for event handlers that are passed to deeply nested components (e.g. Sidebar toggle, header search handler).

### General

- No `console.log` in production. Use `if (process.env.NODE_ENV === "development") console.log(...)`.
- Avoid `useEffect` with broad dep arrays.
- Do not import entire icon libraries — import lucide icons individually: `import { Bell } from "lucide-react"`.
- Use `Suspense` and `loading.tsx` boundaries for any future async page segments.