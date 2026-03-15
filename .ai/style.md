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

## Web (Next.js / React)

### Style Factory Pattern (Primary System)
Layout and page-level styles use `makeXxxStyles(colors: ThemeColors)` factory functions that return plain `CSSProperties` objects — identical naming convention to Mobile but returning CSS objects instead of `StyleSheet`. Applied via `style={{}}` props:

```ts
// apps/web/styles/PageStyles.ts
export function makeDashboardStyles(colors: ThemeColors) {
  return {
    pageHeader: { display: "flex", justifyContent: "space-between", marginBottom: 20 } as CSSProperties,
    kpiCard: { backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12 } as CSSProperties
  };
}
```

```tsx
// In a page component:
const s = makeDashboardStyles(colors);
return <div style={s.pageHeader}>...</div>;
```

Style files live in `apps/web/styles/`:
- `AuthStyles.ts` — login/register page styles
- `FitStyles.ts` — Fit component style factories
- `LayoutStyles.ts` — `makeHeaderStyles`, `makeSidebarStyles`, `makeLayoutStyles`
- `ModalStyles.ts` — `makeModalStyles` for modals and dialogs
- `PageStyles.ts` — `makeDashboardStyles`, `makeProfileStyles` for page-level layouts

### Tailwind + cn() (Component-Level Utilities)
Fit components (`FitButton`, `FitText`, `FitInputField`, etc.) use Tailwind utility classes composed with `cn()`:

```ts
import { cn } from "@/utils/cn";

const base = cn(
  "inline-flex items-center gap-2 rounded-lg transition-colors",
  fullWidth && "w-full",
  className
);
```

Use `cn()` (from `utils/cn.ts`) — wraps `clsx` + `tailwind-merge` — for all conditional Tailwind composition. Never use string concatenation for class names.

**Do NOT** apply Tailwind utility classes directly on page-level `div` layout elements. Those use style factory objects.

### ThemeContext Integration
`ThemeContext` injects CSS custom properties onto `document.documentElement`:
```css
--fit-brand: #E87722;
--fit-surface: #FFFFFF;
--fit-border: #E5E7EB;
```
Tailwind `tailwind.config.ts` maps these to tokens: `brand`, `surface`, `border`, `text-primary`, `field-bg`, etc.

In style factories, use runtime `colors.*` values:
```ts
backgroundColor: colors.surface,
border: `1px solid ${colors.border}`,
```

In Tailwind component classes, use the mapped token names:
```tsx
className="bg-surface border border-border text-text-primary"
```

### "use client" Directive
Components that use `useTheme()`, `useAuth()`, `useState`, `useEffect`, or any event handler must have `"use client"` as the absolute first line of the file. In practice, nearly all `apps/web/` components and page files are client components.

### Animation
- `useFadeIn({ fromY, duration })` — returns a `CSSProperties` object for CSS opacity + translateY entrance. Gate with `animationLevel`.
- `useThemeTransition()` — returns a CSS `transition` property object when the theme is switching.
- No Reanimated. No `react-native-*` anything.

### FitButton / FitText Inline Styles
Both components use inline `style={{}}` driven by `colors.*` for their variant system. `className` is accepted for Tailwind extension. `cn()` is used inside the component to compose Tailwind layout utilities.

---

## Shared Design Token Mapping

| Token | Mobile (runtime) | Web (factory) | Web (Tailwind) |
|---|---|---|---|
| Brand color | `colors.brand` | `colors.brand` | `text-brand`, `bg-brand` |
| Surface | `colors.surface` | `colors.surface` | `bg-surface` |
| Border | `colors.border` | `colors.border` | `border-border` |
| Text primary | `colors.textPrimary` | `colors.textPrimary` | `text-text-primary` |
| Field bg | `colors.fieldBg` | `colors.fieldBg` | `bg-field-bg` |
| Danger | `colors.danger` | `colors.danger` | `text-danger` |
| Radius sm | `R.sm` (px) | `8` (inline) | `rounded-lg` |
| Radius md | `R.md` (px) | `10` (inline) | `rounded-xl` |
| Radius lg | `R.lg` (px) | `12` (inline) | `rounded-xl` |