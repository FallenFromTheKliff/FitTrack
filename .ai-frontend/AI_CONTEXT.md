# FitTrack Architectural Context

## Overview

FitTrack is a unified fitness platform for SertFit Gym. The codebase is a Turborepo monorepo sharing types, utilities, validators, hooks, and design tokens between two distinct surfaces:

- **`apps/mobile`** — Expo app for gym members. Handles workout tracking, bookings, nutrition goals, and AI coaching.
- **`apps/web`** — Next.js 16 App Router app for gym admins and staff. Handles membership management, booking oversight, gym configuration, analytics, and inventory.

Both surfaces share the same design language, component vocabulary (the Fit system), and theme token system, but differ in framework, rendering model, and user role.

---

## Mobile Architecture (`apps/mobile`)

### Stack
- Expo 55 with Expo Router (file-based routing under `app/`)
- React Native 0.83 + React 19
- React Native Reanimated 4 for all animations
- TanStack Query 5 for server state (`useQuery`, `useMutation`)
- AsyncStorage for local persistence

### Key Patterns

**Theme-Driven UI**: `ThemeContext` holds `settings` (themeKey, fontKey, animationLevel). Components call `useTheme()` for static colors and `useThemeTransitionAnim()` for animated color interpolations during theme transitions. The `ic` (InterpolatedColors) object drives `useAnimatedStyle` hooks.

**Style Factories**: Every component uses a `makeXxxStyles(colors: ThemeColors)` factory returning a `StyleSheet.create({})` object. Called inside `useMemo(() => makeXxxStyles(colors), [colors])`. Style files live in `apps/mobile/styles/`.

**Modal Layer**: All modals live in `components/modals/{category}/XxxModal.tsx` with style factories in `styles/modals/XxxStyles.ts`. No modal closes by tapping outside — only via explicit Close/Cancel buttons. `onRequestClose={undefined}` on every `<Modal>`.

**Fit Component System**: `FitText`, `FitButton`, `FitCard`, `FitSection`, `FitSearch`, `FitFilter`, `FitInputField` (with `compact` mode for tighter forms), `FitTextInput`.

**Data Layer**: `apps/mobile/data/` holds all static/mock data. No inline constant arrays in screens or modals.

**API Layer**: All HTTP calls use `mobileApi` from `@/lib/api`. This is the single axios instance with JWT interceptor and auto-refresh. The file `apps/mobile/lib/axios.ts` does not exist — it was removed as a dead/misconfigured file.

**Server State**: TanStack Query (`useQuery`, `useMutation`) manages all API-sourced data. Query keys follow `['resource']` or `['resource', id]` convention. AsyncStorage remains for offline persistence of bookings, fitness data, and theme preferences.

**Contexts**: `AuthContext`, `ThemeContext`, `BookingContext`, `FABStateContext`, `FitnessContext`. `AuthContext` and `ThemeContext` are absolutely immutable unless an explicit migration task is approved.

---

## Web Architecture (`apps/web`)

### Stack
- Next.js 16 with App Router (`app/` directory)
- React 19
- `"use client"` directive required on all components that use context hooks, state, or effects
- TanStack Query 5 + React Query Devtools for all server state (`useQuery`, `useMutation`)
- Tailwind CSS 3 + `cn()` (`clsx` + `tailwind-merge`) for component utility classes
- Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-switch`)
- Recharts for data visualisation
- Sonner for toast notifications
- `react-hook-form` + `@hookform/resolvers` for forms
- `date-fns` for date formatting
- `framer-motion` for entrance animations and directional slides (used in login page, schedule page)
- `axios` via `lib/axios.ts` for HTTP — single instance with JWT interceptor and auto-refresh
- `localStorage` for theme preference persistence

### Key Patterns

**Style Factory + CSS Variables**: Layout and page styles use `makeXxxStyles(colors: ThemeColors)` functions returning `CSSProperties` objects (identical pattern to Mobile). These are applied as `style={{}}` props on HTML elements. `ThemeContext` injects CSS custom properties (`--fit-brand`, `--fit-surface`, etc.) onto `document.documentElement`. Tailwind `tailwind.config.ts` maps these vars to Tailwind tokens. Fit components use `cn()` for composing Tailwind class strings internally.

**"use client" Everywhere**: Most `apps/web/` components and page files require `"use client"` because they use `useTheme()`, `useAuth()`, `useState`, `useEffect`, or event handlers. The layout file `app/(admin)/layout.tsx` is `"use client"`. True RSC is limited to files that need no browser APIs or context — currently only `app/(admin)/page.tsx` (a redirect) and `next.config.ts`.

**ThemeContext**: Calls `document.documentElement.style.setProperty(cssKey, v)` to inject CSS variables and toggles the `dark` class on `<html>`. Exposes `isTransitioning` for CSS transition gating, `onBrandTextColor` for readable text on brand-colored surfaces, and `getReadableTextColor(background)` for dynamic contrast resolution. `useFontClass()` returns a Tailwind font class string. `useIsDark()` returns a boolean.

**Animation**: `useFadeIn({ fromY, duration })` returns a `CSSProperties` object for opacity + translateY CSS entrance animation. `useThemeTransition()` returns a CSS `transition` property object when `isTransitioning` is true. `framer-motion` (`motion`, `animate`, `useMotionValue`) is used for richer entrance animations on the login page and directional slide transitions on the schedule page. No Reanimated.

**TanStack Query**: All server state uses `useQuery` and `useMutation`. Raw axios calls inside `useEffect` for data fetching are not permitted. Contexts (`MemberContext`, `ScheduleContext`, `AuthContext`) use TanStack Query internally. Query keys: `['members']`, `['deletion-requests']`, `['bookings']`, `['venues']`, `['coaches']`.

**Fit Component System (Web)**: Components render HTML and use inline `style={{}}` for theming + Tailwind classes for layout utilities.

**Routing Structure**:
```
apps/web/app/
  layout.tsx                  — root layout, ThemeProvider wrap
  (admin)/
    layout.tsx                — "use client", auth guard, Sidebar + Header shell
    page.tsx                  — redirects to /dashboard
    dashboard/
      page.tsx                — Dashboard overview
    members/page.tsx          — Member management
    schedule/page.tsx         — Booking & Trainer Scheduler
    facilities/page.tsx       — Gym Floor Editor (dnd-kit drag-and-drop)
    inventory/page.tsx        — Inventory management
    analytics/page.tsx        — Analytics & Reports
    settings/page.tsx         — Gym configuration, theme/font settings
    chatbot/page.tsx          — AI chat interface
    profile/page.tsx          — Admin profile settings
  (auth)/
    login/page.tsx            — Login page (auth entry)
    locked/page.tsx           — Account locked page
```

**Auth Flow**: `AuthContext` reads from `localStorage` (`fittrack_access_token`). On mount it checks for a stored token, calls `GET /users/profile`, then calls `onUserLoaded(userId)` to load theme preferences. Logout clears localStorage and calls `onUserCleared()`. OTP modal appears post-login for 7-day re-verification. The dashboard layout redirects to `/login` when `!isAuthenticated`.

**Admin/Staff Orientation**: The web app surfaces:
- Membership management (list, create staff, suspend/terminate members) — `MemberContext`
- Booking oversight (view, confirm, cancel reservations) — `ScheduleContext` wired to real API
- Gym configuration (amenity/trainer/schedule management)
- Analytics dashboards (Recharts: bar, line, pie charts)
- Inventory management
- Floor editor (drag-and-drop gym layout via `@dnd-kit/core`)
- Profile settings (theme, font, personal info)
- AI chatbot interface

**MemberContext**: Manages member list state for the admin web app. Calls `GET /admin/users`, `POST /admin/create-staff`, `DELETE /admin/users/:id`. Uses TanStack Query internally with query keys `['members']`.

**ScheduleContext**: Manages booking state for the admin schedule view. Calls `GET /admin/bookings`, `PATCH /admin/bookings/:id/confirm`, `PATCH /admin/bookings/:id/reject`. Uses TanStack Query internally with query key `['bookings']`. The page-level display type maps API `VenueBooking` shapes to the scheduler's `startHour`/`durationMin` display format via a transform layer.

---

## Shared Design Language

Both surfaces use the same:
- **Color tokens**: `colors.brand`, `colors.surface`, `colors.border`, `colors.textPrimary` etc. from `packages/ui/theme.ts`
- **Spacing rhythm**: 4px base unit, components spaced in multiples of 4
- **Component vocabulary**: `FitCard`, `FitButton`, `FitSection`, `FitText`, `FitInputField` — same prop contract on both platforms, different rendering target (HTML vs React Native)
- **Font system**: Mobile uses `FONT_FAMILIES[activeFont]` via `useFontFamily()`. Web uses `WEB_FONT_CLASSES[activeFont]` via `useFontClass()` returning a Tailwind class string.
- **Pure-React hooks**: `useDebounce`, `useLoadingText`, `useTimedMessage` from `@fittrack/hooks` — no platform APIs, shared by both apps.

## Design Capture Notes

- Figma captures should be treated as an as-built or proposed UI reference, not as a replacement for source control or architecture docs.
- A captured screen includes whatever is visibly rendered from `apps/web`, `apps/mobile`, and approved shared packages. Shared package behavior appears only through rendered output.
- Captures do not reveal hidden business logic, backend schemas, query contracts, storage formats, or non-visual utility behavior unless those are already visible in the UI.
- If realistic data is needed in a design capture, the app must already render that data through live, seeded, or explicit mock states.
- Design changes discovered or proposed in Figma must still be mapped back into the real repository structure by intent rather than by screenshot similarity alone.

## Audience Split

| Concern | Mobile (`apps/mobile`) | Web (`apps/web`) |
|---|---|---|
| Primary user | Gym member | Admin / Staff |
| Auth model | Member login (phone/email + OTP) | Staff/Admin login (email/password + OTP) |
| Primary actions | Book, train, track, chat | Manage, oversee, configure, report |
| Offline support | AsyncStorage persistence | `localStorage` for preferences only |
| Animation system | Reanimated `useAnimatedStyle` | CSS transitions via `useFadeIn`, `useThemeTransition`; framer-motion for entrances |
| Style system | `StyleSheet.create` factories + Reanimated | `CSSProperties` factories + Tailwind via `cn()` |
| Server state | TanStack Query (`useQuery`/`useMutation`) + AsyncStorage | TanStack Query (`useQuery`/`useMutation`) |

---

## Known API Gaps (Planned)

The following API modules exist in `apps/api` but are not yet connected to either app:

- **Coaches** (`/coaches/*`): `GET /coaches`, `GET /coaches/:id`, `GET /coaches/:id/availability` — not connected on Mobile or Web.
- **Appointments** (`/appointments/*`): Full CRUD — not connected on Mobile or Web.
- **Forgot/Reset Password** (`POST /auth/forgot-password`, `POST /auth/reset-password`): Both login pages have a "Forgot Password?" button wired to `() => {}` — flow not implemented.
- **Phone verification** (`PATCH /auth/add-phone`, `POST /auth/verify-phone`): API built, not called from either app.
- **Admin venue management** (`POST /admin/venues`, `PATCH /admin/venues/:id`, `DELETE /admin/venues/:id`): Facilities page uses static data only.
- **Staff module** (`/staff/*`): All endpoints built, no frontend calls.
- **Deletion request reject** (`PATCH /admin/deletion-requests/:id/reject`): Approve is wired, reject is not.
- **TanStack Query migration**: Planned follow-up — migrate remaining raw axios `useEffect` fetches in individual page files to use `useQuery`/`useMutation` patterns.

---

## MCP Tools

Serena, Context7, Playwright, GitHub, and Figma are configured in `.vscode/mcp.json` when available for the workspace. See `.ai/agent.md` for the task pipeline and usage patterns.

- **Serena**: primary codebase understanding and editing tool
- **Context7**: primary documentation lookup tool for library APIs
- **Playwright**: runtime verification for web and browser-rendered mobile states
- **GitHub**: repository context for issues, pull requests, reviews, branches, and workflows
- **Figma**: design capture and design comparison tool using Figma Design files