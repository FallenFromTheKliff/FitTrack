# FitTrack Architectural Context

## Overview

FitTrack is a unified fitness platform for SertFit Gym. The codebase is a Turborepo monorepo sharing types, utilities, validators, and design tokens between two distinct surfaces:

- **`apps/mobile`** — Expo app for gym members. Handles workout tracking, bookings, nutrition goals, and AI coaching.
- **`apps/web`** — Next.js 16 App Router app for gym admins and staff. Handles membership management, booking oversight, gym configuration, analytics, and inventory.

Both surfaces share the same design language, component vocabulary (the Fit system), and theme token system, but differ in framework, rendering model, and user role.

---

## Mobile Architecture (`apps/mobile`)

### Stack
- Expo 55 with Expo Router (file-based routing under `app/`)
- React Native 0.83 + React 19
- React Native Reanimated 4 for all animations
- TanStack Query 5 for server state
- AsyncStorage for local persistence

### Key Patterns

**Theme-Driven UI**: `ThemeContext` holds `settings` (themeKey, fontKey, animationLevel). Components call `useTheme()` for static colors and `useThemeTransitionAnim()` for animated color interpolations during theme transitions. The `ic` (InterpolatedColors) object drives `useAnimatedStyle` hooks.

**Style Factories**: Every component uses a `makeXxxStyles(colors: ThemeColors)` factory returning a `StyleSheet.create({})` object. Called inside `useMemo(() => makeXxxStyles(colors), [colors])`. Style files live in `apps/mobile/styles/`.

**Modal Layer**: All modals live in `components/modals/{category}/XxxModal.tsx` with style factories in `styles/modals/XxxStyles.ts`. No modal closes by tapping outside — only via explicit Close/Cancel buttons. `onRequestClose={undefined}` on every `<Modal>`.

**Fit Component System**: `FitText`, `FitButton`, `FitCard`, `FitSection`, `FitSearch`, `FitFilter`, `FitInputField` (with `compact` mode for tighter forms), `FitTextInput`.

**Data Layer**: `apps/mobile/data/` holds all static/mock data. No inline constant arrays in screens or modals.

**Contexts**: `AuthContext`, `ThemeContext`, `BookingContext`, `FABStateContext`, `FitnessContext`. `AuthContext` and `ThemeContext` are absolutely immutable.

---

## Web Architecture (`apps/web`)

### Stack
- Next.js 16 with App Router (`app/` directory)
- React 19
- `"use client"` directive required on all components that use context hooks, state, or effects
- TanStack Query 5 + React Query Devtools for client-side server state
- Tailwind CSS 3 + `cn()` (`clsx` + `tailwind-merge`) for component utility classes
- Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-switch`)
- Recharts for data visualisation
- Sonner for toast notifications
- `react-hook-form` + `@hookform/resolvers` for forms
- `date-fns` for date formatting
- `axios` for HTTP via `lib/axios.ts`
- `localStorage` for theme preference persistence

### Key Patterns

**Style Factory + CSS Variables**: Layout and page styles use `makeXxxStyles(colors: ThemeColors)` functions returning `CSSProperties` objects (identical pattern to Mobile). These are applied as `style={{}}` props on HTML elements. `ThemeContext` injects CSS custom properties (`--fit-brand`, `--fit-surface`, etc.) onto `document.documentElement`. Tailwind `tailwind.config.ts` maps these vars to Tailwind tokens. Fit components use `cn()` for composing Tailwind class strings internally.

**"use client" Everywhere**: Most `apps/web/` components and page files require `"use client"` because they use `useTheme()`, `useAuth()`, `useState`, `useEffect`, or event handlers. The layout file `app/(dashboard)/layout.tsx` is `"use client"`. True RSC is limited to files that need no browser APIs or context — currently only `app/(dashboard)/page.tsx` (a redirect) and `next.config.ts`.

**ThemeContext**: Calls `document.documentElement.style.setProperty(cssKey, v)` to inject CSS variables and toggles the `dark` class on `<html>`. Exposes `isTransitioning` for CSS transition gating. `useFontClass()` returns a Tailwind font class string. `useIsDark()` returns a boolean.

**Animation**: `useFadeIn({ fromY, duration })` returns a `CSSProperties` object for opacity + translateY CSS entrance animation. `useThemeTransition()` returns a CSS `transition` property object when `isTransitioning` is true. No Reanimated.

**Fit Component System (Web)**: Components render HTML and use inline `style={{}}` for theming + Tailwind classes for layout utilities.

**Routing Structure**:
```
apps/web/app/
  layout.tsx                  — root layout, ThemeProvider wrap
  (dashboard)/
    layout.tsx                — "use client", auth guard, Sidebar + Header shell
    page.tsx                  — redirects to /dashboard
    dashboard/
      page.tsx                — Dashboard overview
      members/page.tsx        — Member management
      schedule/page.tsx       — Booking & Trainer Scheduler
      floor-editor/page.tsx   — Gym Floor Editor
      inventory/page.tsx      — Inventory management
      analytics/page.tsx      — Analytics & Reports
      gym-settings/page.tsx   — Gym configuration, theme/font settings
    profile/page.tsx          — Admin profile settings
  login/page.tsx              — Login page (auth entry)
```

**Auth Flow**: `AuthContext` reads from `localStorage` (`fittrack_web_session`). On mount it checks for a stored session, calls `onUserLoaded(userId)` to load theme preferences, then sets `user`. Logout clears localStorage and calls `onUserCleared()`. The dashboard layout redirects to `/login` when `!isAuthenticated`. OTP modal appears post-login for verification.

**Admin/Staff Orientation**: The web app surfaces:
- Membership management (list, create, update, suspend members)
- Booking oversight (view, confirm, cancel reservations via `ScheduleContext`)
- Gym configuration (amenity/trainer/schedule management)
- Analytics dashboards (Recharts: bar, line, pie charts)
- Inventory management
- Floor editor (drag-and-drop gym layout — planned)
- Profile settings (theme, font, personal info)

**ScheduleContext**: Manages `Booking[]` in-memory for the web admin (add, remove, update, clear). Separate from Mobile's `BookingContext`.

---

## Shared Design Language

Both surfaces use the same:
- **Color tokens**: `colors.brand`, `colors.surface`, `colors.border`, `colors.textPrimary` etc. from `packages/ui/theme.ts`
- **Spacing rhythm**: 4px base unit, components spaced in multiples of 4
- **Component vocabulary**: `FitCard`, `FitButton`, `FitSection`, `FitText`, `FitInputField` — same prop contract on both platforms, different rendering target (HTML vs React Native)
- **Font system**: Mobile uses `FONT_FAMILIES[activeFont]` via `useFontFamily()`. Web uses `WEB_FONT_CLASSES[activeFont]` via `useFontClass()` returning a Tailwind class string.

---

## Audience Split

| Concern | Mobile (`apps/mobile`) | Web (`apps/web`) |
|---|---|---|
| Primary user | Gym member | Admin / Staff |
| Auth model | Member login (phone/email + OTP) | Staff/Admin login (email/password + OTP) |
| Primary actions | Book, train, track, chat | Manage, oversee, configure, report |
| Offline support | AsyncStorage persistence | `localStorage` for preferences only |
| Animation system | Reanimated `useAnimatedStyle` | CSS transitions via `useFadeIn`, `useThemeTransition` |
| Style system | `StyleSheet.create` factories + Reanimated | `CSSProperties` factories + Tailwind via `cn()` |