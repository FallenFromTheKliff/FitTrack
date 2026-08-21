# Styling And Design Rules

## Shared Principles

- Use FitTrack theme tokens instead of hardcoded color hex values in component code.
- Keep spacing compact and intentional.
- Avoid excessive blank lines, vertical alignment, and unused imports.
- Use app-local Fit primitives before creating one-off UI controls.
- Keep the two frontend surfaces visually related without leaking platform-specific styling across apps.
- Keep FitTrack geometry mostly box/rectangle based with subtle corner radii. Avoid exaggerated rounded containers unless an existing component pattern requires it.
- Preserve each theme's identity while keeping foreground/background contrast clear.
- Use success/green treatment for positive actions and danger/red treatment for destructive actions regardless of theme.
- Dark surfaces need light readable content; light surfaces need darker readable content.

## Mobile Styling

### Factory Pattern

Mobile components use `makeXxxStyles(colors: ThemeColors)` factories that return `StyleSheet.create({})` objects.

Common locations:

- `apps/mobile/styles/components/FitStyles.ts`
- `apps/mobile/styles/shared/ScreenStyles.ts`
- `apps/mobile/styles/shared/LayoutStyles.ts`
- `apps/mobile/styles/modals/XxxStyles.ts`

Consume factories with `useMemo`:

```ts
const s = useMemo(() => makeXxxStyles(colors), [colors]);
```

Never call a style factory naked in the render body.

### Theme-Aware Animation

- Use `useThemeTransitionAnim()` only when values animate during theme transitions.
- Consume animated colors inside `useAnimatedStyle`.
- Do not call `useThemeTransitionAnim()` in components that only need static colors.
- Use Reanimated for native animations. Do not import `Animated` from `react-native`.

### Mobile Fit Components

Use current app-local primitives from `apps/mobile/components/fit`:

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

Raw React Native primitives are acceptable for layout wrappers, custom camera/canvas surfaces, animated wrappers, and cases with no Fit equivalent.

## Web Styling

The web app uses two styling layers:

1. `CSSProperties` style factories for page and layout surfaces.
2. Tailwind utility classes composed through `cn()` inside reusable component primitives.

### Style Factories

Style factories live in `apps/web/styles/`:

- `authStyles.ts`
- `fitStyles.ts`
- `layoutStyles.ts`
- `modalStyles.ts`
- `pageStyles.ts`

Use them once near the top of the component:

```ts
const s = useMemo(() => makeDashboardStyles(colors), [colors]);
```

Then apply by key:

```tsx
return <div style={s.pageHeader}>...</div>;
```

Avoid Tailwind class piles directly on page-level layout `div`s when a style factory exists for that surface.

### Tailwind And `cn()`

Web Fit components use tokenized Tailwind classes and `cn()` for conditional class composition:

```ts
const base = cn(
  "inline-flex items-center gap-2 transition-colors",
  fullWidth && "w-full",
  className
);
```

Prefer token classes such as `bg-surface`, `bg-surface-raised`, `bg-base`, `text-text-primary`, `text-text-muted`, `border-border`, `bg-brand`, `text-success`, `text-warning`, and `text-danger`.

### Web Fit Components

Use current app-local primitives from `apps/web/components/fit`:

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

Use `FitTable`, `FitPagination`, and `FitPill` before inventing custom table/status/pagination patterns.

### Theme Integration

`ThemeContext` injects CSS variables onto `document.documentElement`. Style factories use runtime `colors.*`; Tailwind consumes mapped `--fit-*` variables.

Use `colors.*` in factory objects:

```ts
backgroundColor: colors.surface,
border: `1px solid ${colors.border}`
```

Use token classes in components:

```tsx
className="bg-surface border border-border text-text-primary"
```

Never hardcode raw hex values in app UI code unless defining theme tokens themselves.

### Raw Visual Exceptions

Hardcoded visual values are acceptable only when they are deliberately outside the runtime theme layer:

- app manifest/icon/background metadata
- generated export HTML, email-like markup, PDF snapshots, or image previews
- QR, camera, pose, chart, map, and sensor overlays where contrast has to remain stable over live media
- `rgba()` shadows, scrims, and alpha overlays that cannot be expressed by current tokens
- named feature-local visual constants while waiting for a shared token decision

New exceptions should be named semantically, kept near the feature or export helper that owns them, and avoided in ordinary page/component JSX.

### `useThemeTransition`

`apps/web/hooks/animations/useThemeTransition.ts` returns a Tailwind class string:

```ts
const themeTransition = useThemeTransition();
```

Apply it through `cn()`, not as a style object:

```tsx
<div className={cn("bg-surface", themeTransition)} />
```

### `"use client"`

Any web file using hooks, browser APIs, refs, state, callbacks, effects, TanStack Query hooks, or event handlers must have `"use client"` as the first line.

## Shared Token Layer

`@fittrack/ui` exports tokens, themes, font maps, radii, max widths, and style constants. App-local Fit components consume this shared layer, but component implementations live in each app.

| Token | Mobile | Web Factory | Web Tailwind |
|---|---|---|---|
| Brand | `colors.brand` | `colors.brand` | `bg-brand`, `text-brand` |
| Surface | `colors.surface` | `colors.surface` | `bg-surface` |
| Surface raised | `colors.surfaceRaised` | `colors.surfaceRaised` | `bg-surface-raised` |
| Border | `colors.border` | `colors.border` | `border-border` |
| Text primary | `colors.textPrimary` | `colors.textPrimary` | `text-text-primary` |
| Text muted | `colors.textMuted` | `colors.textMuted` | `text-text-muted` |
| Danger | `colors.danger` | `colors.danger` | `text-danger` |
| Success | `colors.success` | `colors.success` | `text-success` |
| Warning | `colors.warning` | `colors.warning` | `text-warning` |
