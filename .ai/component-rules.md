# Component Rules

## Shared Rules (Both Apps)

- UI components that are logically and visually identical across Web and Mobile must live in `packages/ui`, not duplicated per app.
- Shared packages must be platform-agnostic: no `react-native` imports, no `next/*` imports.
- All forms on both platforms use `react-hook-form` with shared Zod schemas from `@fittrack/validators`.
- Shared component prop contracts are named consistently — `label`, `icon`, `variant`, `onPress`/`onClick`, `disabled` — do not add platform-specific props to shared definitions. Use platform-specific wrapper components instead.

---

## Mobile Component Rules (`apps/mobile/`)

### Fit Component System
Use Fit components for all UI. Do not use raw React Native primitives where a Fit equivalent exists.

| Use instead of | Raw primitive |
|---|---|
| `FitText` | `<Text>` |
| `FitTextInput` | `<TextInput>` (except for `ref`/`caretHidden`/`selectTextOnFocus` specialisations) |
| `FitButton` | `<Pressable>` for buttons/actions |
| `FitCard` | `<View>` for list rows and selection cards |
| `FitSection` | `<View>` for section containers with headings |
| `FitInputField` | Manual label + `FitTextInput` wiring (use `compact` prop in tight modal layouts) |

Acceptable raw primitive use:
- `<Pressable>` for non-button interactive layouts (map pins, custom tile grids)
- `<TextInput>` only when `ref`, `caretHidden`, or `selectTextOnFocus` is required (OTP inputs)
- `<View>` for layout containers, spacers, wrappers, and animated wrappers

### Animated Variants
Use `AnimatedFitText` (not `FitText`) when text color must animate during a theme transition via `useThemeTransitionAnim()`.

### Modal Rules
- Every modal: `apps/mobile/components/modals/{category}/XxxModal.tsx`
- Every modal's style factory: `apps/mobile/styles/modals/XxxStyles.ts` (PascalCase filename)
- No modal closes by tapping outside — no `<Pressable style={StyleSheet.absoluteFill}>` backdrop
- `onRequestClose={undefined}` on every `<Modal>` component
- Modal card uses `useOverlayAnim(isVisible, mode)` for entry/exit animation

### File Location Rules
| Type | Location |
|---|---|
| Screen components | `apps/mobile/app/(tabs)/` |
| Auth screens | `apps/mobile/app/(auth)/` |
| Fit components | `apps/mobile/components/fit/` |
| Layout components | `apps/mobile/components/layout/` |
| Loading components | `apps/mobile/components/loading/` |
| Modal components | `apps/mobile/components/modals/{category}/` |
| Settings panels | `apps/mobile/components/settings/` |
| Fit component styles | `apps/mobile/styles/components/FitStyles.ts` |
| Layout styles | `apps/mobile/styles/shared/LayoutStyles.ts` |
| Screen styles | `apps/mobile/styles/shared/ScreenStyles.ts` |
| Modal styles | `apps/mobile/styles/modals/XxxStyles.ts` |

---

## Web Component Rules (`apps/web/`)

### "use client" is Explicit and Required
Any component or page file that uses `useTheme()`, `useAuth()`, `useState`, `useEffect`, `useRef`, `useCallback`, or any browser event handler must have `"use client"` as the **absolute first line** of the file (before any imports). In practice nearly all files in `apps/web/components/` and `apps/web/app/(dashboard)/` are client components.

### Fit Component System (Web)
The web Fit system mirrors Mobile vocabulary but renders HTML. All web Fit components:
- Accept `className` for Tailwind utility extension
- Use `cn()` internally for composing Tailwind class strings
- Apply theme colors via `style={{}}` using `colors.*` from `useTheme()`

| Component | HTML output | Usage |
|---|---|---|
| `FitText` | `<span>` or the `as` prop value | All text — passes `style={{}}` for color |
| `FitButton` | `<button>` | All interactive buttons — variant styles via inline `style={{}}` |
| `FitCard` | `<div>` | List rows, stat tiles, selection cards |
| `FitSection` | `<div>` | Section containers with heading |
| `FitInputField` | `<div>` wrapper + `<input>` or `<textarea>` | Form fields with Controller from react-hook-form |

### Style Application on Web
- Page and layout elements: `style={s.key}` where `s` is from `makeXxxStyles(colors)`
- Component internal classes: `className={cn(...)}` with Tailwind utilities
- Never mix: do not apply Tailwind utility classes directly on page-level `div` layout elements

### Modal Rules (Web)
- Modal components live in `apps/web/components/modals/`
- Use `ConfirmModal` for all destructive confirmations
- Use `DetailsModal` for generic form-based modals (accepts `fields` array config)
- Modals use `isOpen` prop (not `isVisible`) and `onCancel`/`onConfirm` callbacks
- Overlay click closes the modal by default on web (this is standard web UX — unlike Mobile where it is blocked)

### Admin/Staff UI Patterns
The web app is admin-oriented. Standard UI patterns:
- KPI stat grids (4-column, `makeDashboardStyles.kpiGrid`)
- Data tables with status pills (`makeDashboardStyles.statusPill`)
- Recharts bar/line/pie charts inside `ResponsiveContainer`
- Inline `useLoadingText` on submit buttons during async operations
- `useTimedMessage` for inline success/error feedback after mutations
- Role-based conditional rendering based on `user?.role` from `useAuth()`

### File Location Rules (Web)
| Type | Location |
|---|---|
| Auth pages | `apps/web/app/login/` |
| Dashboard pages | `apps/web/app/(dashboard)/dashboard/` |
| Dashboard layout | `apps/web/app/(dashboard)/layout.tsx` |
| Profile page | `apps/web/app/(dashboard)/profile/` |
| Fit components | `apps/web/components/fit/` |
| Layout components | `apps/web/components/layout/` (`Header.tsx`, `Sidebar.tsx`) |
| Modal components | `apps/web/components/modals/` |
| Root providers | `apps/web/components/Providers.tsx` |
| Style factories | `apps/web/styles/` |
| Hooks | `apps/web/hooks/animations/` |
| Data | `apps/web/data/` |
| Utilities | `apps/web/utils/cn.ts` |

---

## Cross-App Duplication Prevention

Before creating a new component, check in order:
1. Does an equivalent exist in `packages/ui`? Use it.
2. Does an equivalent exist in the other app? If the logic is identical, propose moving it to `packages/ui`.
3. Only create an app-specific component if the rendering target (React Native vs HTML) or styling system makes sharing impossible.

The `useLoadingText` hook exists independently in both apps (`apps/mobile/hooks/animations/text/useLoadingText.ts` and `apps/web/hooks/animations/useLoadingText.ts`) with identical logic — this is an accepted duplication because hooks cannot be shared across React Native and React web contexts.