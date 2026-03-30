# Styling & Design Rules

## Shared Principles (Both Apps)

- No hardcoded color hex values in component code. Use the token system (`colors.*` from `useTheme()`).
- No comments in source files.
- Compact spacing: no excessive blank lines, no vertical alignment, no trailing commas.
- Closing `}` must not be followed by a blank line before the next statement or EOF.

---

## Mobile (Expo / React Native)

### Factory Pattern
Every component uses a `makeXxxStyles(colors: ThemeColors)` factory returning a `StyleSheet.create({})` object. Factories live in:
- `apps/mobile/styles/components/FitStyles.ts` — Fit component styles
- `apps/mobile/styles/shared/ScreenStyles.ts` — screen-level styles
- `apps/mobile/styles/shared/LayoutStyles.ts` — Header, Sidebar layout
- `apps/mobile/styles/modals/XxxStyles.ts` — one file per modal (PascalCase)

Consume factories inside `useMemo`:
```ts
const s = useMemo(() => makeXxxStyles(colors), [colors]);
```
Never call a style factory naked in the render body.

### Theme-Aware Animated Styles
For values that animate during theme transitions, use `useThemeTransitionAnim()` to get the `ic` object, consumed inside `useAnimatedStyle`:
```ts
const { ic } = useThemeTransitionAnim();
const cardStyle = useAnimatedStyle(() => ({
  backgroundColor: ic.surface.value,
  borderColor: ic.border.value
}));
```
Do not call `useThemeTransitionAnim` in components that only need static colors.

### Fit Components
- `FitText` / `AnimatedFitText` — all text
- `FitButton` — all interactive buttons
- `FitCard` — list rows, stat tiles, selection cards
- `FitSection` — section containers
- `FitSearch` — search input
- `FitFilter` — animated filter panel
- `FitInputField` — form fields (use `compact` prop in tight modal layouts)
- `FitTextInput` — bare text input without form wiring

### Deprecated Native Props
- `shadow*` props are deprecated. Use `boxShadow` string + `elevation` for cross-platform shadow.
- `pointerEvents` must be in `style`, not as a JSX prop.

### Animations
- `react-native-reanimated` only. Never import `Animated` from `react-native`.

---

## Web (Next.js / React) — CSS Variables + Tailwind System

### Overview
The web app uses a two-layer styling system:

1. **`CSSProperties` factory objects** for page-level and layout-level styles.
2. **Tailwind utility classes via `cn()`** for component-level and interactive styles, consuming CSS variable tokens.

`ThemeContext` bridges the two layers by injecting `--fit-*` CSS custom properties onto `document.documentElement` on every theme change.

---

### Layer 1 — Style Factory Functions (Page & Layout)

`makeXxxStyles(colors: ThemeColors)` functions return plain `CSSProperties` objects. Applied via `style={{}}` on HTML elements:

```ts
export function makeDashboardStyles(colors: ThemeColors) {
  return {
    pageHeader: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 20
    } as CSSProperties,
    kpiCard: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 16
    } as CSSProperties
  };
}
```

```tsx
const s = useMemo(() => makeDashboardStyles(colors), [colors]);
return <div style={s.pageHeader}>...</div>;
```

Style files live in `apps/web/styles/`:
- `AuthStyles.ts` — login/locked page styles
- `FitStyles.ts` — Fit component style factories
- `LayoutStyles.ts` — `makeHeaderStyles`, `makeSidebarStyles`, `makeLayoutStyles`
- `ModalStyles.ts` — `makeModalStyles` for all modals
- `PageStyles.ts` — `makeDashboardStyles`, `makeProfileStyles` for admin pages

**Rule:** Do not apply Tailwind utility classes directly on page-level `div` layout elements. Those must use style factory objects.

---

### Layer 2 — Tailwind + `cn()` (Component-Level)

Fit components (`FitButton`, `FitText`, `FitInputField`, etc.) and their interactive states use Tailwind utility classes composed with `cn()` from `utils/cn.ts`:

```ts
import { cn } from "@/utils/cn";

const base = cn(
  "inline-flex items-center gap-2 rounded-lg transition-colors",
  fullWidth && "w-full",
  className
);
```

**Tailwind token classes** map to CSS variables injected by `ThemeContext`:
```
bg-brand          → var(--fit-brand)
bg-surface        → var(--fit-surface)
bg-surface-raised → var(--fit-surface-raised)
bg-base           → var(--fit-base)
bg-field-bg       → var(--fit-field-bg)
text-text-primary → var(--fit-text-primary)
text-text-muted   → var(--fit-text-muted)
border-border     → var(--fit-border)
border-brand      → var(--fit-brand)
text-success      → var(--fit-success)
text-warning      → var(--fit-warning)
text-danger       → var(--fit-danger)
```

**`globals.css` component classes** (defined with `@apply`) for recurring patterns:
```css
.fit-card          { @apply bg-surface border border-border rounded-xl overflow-hidden; }
.fit-kpi-card      { @apply bg-surface border border-border rounded-xl p-4; }
.fit-status-pill   { @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border; }
.fit-section-heading { @apply text-[11px] font-bold tracking-widest uppercase text-text-muted; }
.fit-table-head    { @apply text-left text-[11px] font-semibold tracking-wide uppercase text-text-muted px-4 py-3 border-b border-border; }
.fit-table-row     { @apply border-b border-border last:border-b-0 hover:bg-surface-raised transition-colors duration-100; }
.fit-table-cell    { @apply px-4 py-3 text-sm text-text-primary; }
.fit-table-cell-muted { @apply px-4 py-3 text-sm text-text-muted; }
```

---

### ThemeContext Integration
`ThemeContext` injects CSS custom properties:
```css
--fit-brand: #E87722;
--fit-surface: #FFFFFF;
--fit-border: #E5E7EB;
```
These are set via `document.documentElement.style.setProperty(cssKey, v)` in a `useEffect` that fires whenever `activeThemeKey` changes — including during live theme preview.

In style factories, use `colors.*` runtime values:
```ts
backgroundColor: colors.surface,
border: `1px solid ${colors.border}`,
```
In Tailwind component classes, use the mapped token names:
```tsx
className="bg-surface border border-border text-text-primary"
```
Never use raw hex values in either system.

---

### `useThemeTransition` — Returns Class String

The `useThemeTransition` hook returns a **Tailwind class string** (not a `CSSProperties` object):
```ts
export function useThemeTransition(): string {
  const { settings } = useTheme();
  if (settings.animationLevel !== "full") return "";
  return "transition-colors duration-[280ms] ease-linear";
}
```
Apply it as: `className={cn("...", themeTransition)}` — not as a `style` spread.

---

### "use client" Directive
Any web file using `useTheme()`, `useAuth()`, `useState`, `useEffect`, `useRef`, `useCallback`, or any event handler must have `"use client"` as the absolute first line.

### Animation
- `useFadeIn({ fromY, duration })` — returns `CSSProperties` for CSS opacity + translateY entrance.
- `useThemeTransition()` — returns a Tailwind class string for theme-change transitions.
- No `react-native-reanimated`. No `react-native` anything.

---

## Shared Design Token Mapping

| Token | Mobile (runtime) | Web (factory) | Web (Tailwind) |
|---|---|---|---|
| Brand color | `colors.brand` | `colors.brand` | `text-brand`, `bg-brand` |
| Surface | `colors.surface` | `colors.surface` | `bg-surface` |
| Surface raised | `colors.surfaceRaised` | `colors.surfaceRaised` | `bg-surface-raised` |
| Border | `colors.border` | `colors.border` | `border-border` |
| Text primary | `colors.textPrimary` | `colors.textPrimary` | `text-text-primary` |
| Text muted | `colors.textMuted` | `colors.textMuted` | `text-text-muted` |
| Field bg | `colors.fieldBg` | `colors.fieldBg` | `bg-field-bg` |
| Danger | `colors.danger` | `colors.danger` | `text-danger` |
| Success | `colors.success` | `colors.success` | `text-success` |
| Warning | `colors.warning` | `colors.warning` | `text-warning` |
| Radius input | `R.input` (px) | `BORDER_RADIUS.input` | `rounded-lg` |
| Radius card | `R.card` (px) | `BORDER_RADIUS.card` | `rounded-xl` |
| Radius modal | `R.modal` (px) | `BORDER_RADIUS.modal` | `rounded-2xl` |