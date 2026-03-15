# Monorepo Structure

## Applications

### `apps/mobile` — Expo Member App
- Framework: Expo 55, Expo Router
- Audience: Gym members
- Entry: `app/_layout.tsx`
- Routes: `app/(tabs)/` for main screens, `app/(auth)/` for login/register
- Dev: `localhost:8081`

### `apps/web` — Next.js Admin App
- Framework: Next.js 16, App Router
- Audience: Gym admins and staff
- Entry: `app/layout.tsx` (ThemeProvider), `app/(dashboard)/layout.tsx` (auth shell)
- Routes: `app/(dashboard)/dashboard/...` for admin pages, `app/login/` for auth
- Dev: `localhost:8080`

---

## Shared Packages (`packages/`)

| Package | Import | Contents |
|---|---|---|
| `@fittrack/ui` | `packages/ui` | `themes`, `THEME_LABELS`, `FONT_FAMILIES`, `WEB_FONT_CLASSES`, `THEME_IS_DARK`, `THEME_ACCENT_COLOR`, `DEFAULT_THEME`, `DEFAULT_FONT`, `FitPreset` (Tailwind), `R`, `MAX_WIDTH` |
| `@fittrack/types` | `packages/types` | `AuthUser`, `Booking`, `CreateBookingDTO`, `ThemeColors`, `ThemeSettings`, `IThemeContext`, `ThemeKey`, `FontKey`, `MemberTier`, `BookingStatus`, `AnimationLevel` |
| `@fittrack/utils` | `packages/utils` | `formatBookingDate`, `formatDate`, `calcBMI`, `splitFullName`, `revisePassword`, currency helpers |
| `@fittrack/validators` | `packages/validators` | `loginSchema`, `registerSchema`, `profilePersonalSchema`, `profileFitnessSchema`, `changePasswordSchema`, `editProfilePersonalSchema`, `editProfileFitnessSchema` + inferred types |
| `@fittrack/query` | `packages/query` | `makeQueryClient()` — TanStack Query client factory |

---

## Import Rules

- Always use path aliases: `@/*` for local app files (`@/components/...`, `@/contexts/...`).
- Import shared logic from `@fittrack/*` packages — never duplicate across apps.
- Do not import `react-native` from `packages/` — packages must be platform-agnostic.
- Do not import `apps/mobile` code from `apps/web` or vice versa.
- Cross-platform UI patterns that are identical in logic belong in `packages/ui`, not duplicated per app.

---

## Data Layer

### Mobile: `apps/mobile/data/`
| File | Key Exports |
|---|---|
| `bookings.ts` | `AMENITIES`, `FACILITIES_ONLY_IDS`, `TRAINERS`, `TIME_SLOTS`, `STATUS_COLORS`, `FILTER_OPTIONS`, `StatusFilter`, `getTodayString` |
| `amenities.ts` | `AMENITY_META`, `AMENITY_STATUS_META`, `AMENITY_IMAGE_PLACEHOLDERS`, `AmenityStatus` |
| `chat.ts` | `MOCK_SESSIONS`, `GREETING_MESSAGE` |
| `facilities.ts` | `MAP_PINS`, `MapPin` type, `CARDIO`, `STRENGTH`, `FUNCTIONAL` equipment arrays |
| `nutrition.ts` | `GOAL_TYPES`, `GoalType` |
| `settings.ts` | `PREF_META` |
| `mock.ts` | `QUICK_ACTIONS`, `GOAL_ROWS` |
| `member.ts` | `TIER_LABELS`, `TIER_LEVELS`, `BADGE_COLORS`, `MOCK_BADGES`, `MOCK_ACHIEVEMENTS` |
| `workout.ts` | `EXERCISES`, `AI_TIPS` |
| `calendar.ts` | `MONTH_NAMES`, `WEEK_DAYS` |
| `user.ts` | `MOCK_USERS` (dev only) |

### Web: `apps/web/data/`
| File | Key Exports |
|---|---|
| `user.ts` | `MOCK_USERS`, `TIER_LABELS`, `TIER_LEVELS`, `TIER_COLORS`, `BADGE_COLORS`, `MOCK_BADGES`, `MOCK_ACHIEVEMENTS`, `PROFILE_FIELDS`, `STATS` |
| `members.ts` | `MEMBERS_LIST`, `STATUS_COLORS`, `TIER_COLORS` |
| `inventory.ts` | `PRODUCTS_LIST`, `STOCK_STATUS_COLOR` |
| `schedule.ts` | `SCHEDULE_STATS` |
| `preferences.ts` | `loadPreferences(userId)`, `savePreferences(userId, settings)` — localStorage helpers |

---

## Routing Conventions

### Mobile (Expo Router)
- `app/(tabs)/` — tab navigator screens (home, bookings, nutrition, workout, facilities, chatbot, chathistory, profile, settings)
- `app/(auth)/` — authentication screens (login, register)
- `app/_layout.tsx` — root layout with ThemeProvider, AuthProvider, BookingProvider, FitnessProvider

### Web (Next.js App Router)
- `app/layout.tsx` — root layout, wraps everything in `ThemeProvider`
- `app/(dashboard)/layout.tsx` — "use client", auth guard + responsive sidebar/header shell
- `app/(dashboard)/dashboard/` — admin page routes
- `app/login/` — authentication entry point (no sidebar)
- Page-level state and data access via `useState`/`useEffect`/context hooks (not async RSC in practice)
- Client interactivity is co-located in page files marked `"use client"`

---

## Style Systems Comparison

| | Mobile | Web |
|---|---|---|
| Layout styles | `StyleSheet.create({})` via `makeXxxStyles(colors)` | `CSSProperties` objects via `makeXxxStyles(colors)` |
| Applied via | `style={s.key}` on RN components | `style={s.key}` on HTML elements |
| Component utilities | N/A | Tailwind classes via `cn()` inside Fit components |
| Theme values | `colors.*` (runtime JS objects) | `colors.*` in factories + `var(--fit-*)` CSS variables on `<html>` |
| Animations | `react-native-reanimated` (`useAnimatedStyle`) | CSS transitions (`useFadeIn`, `useThemeTransition`) |
| Conditional styles | Array spread `[s.base, isActive && s.active]` | `cn("base", isActive && "active")` |
| Style files (Mobile) | `apps/mobile/styles/` | — |
| Style files (Web) | — | `apps/web/styles/` (`AuthStyles.ts`, `FitStyles.ts`, `LayoutStyles.ts`, `ModalStyles.ts`, `PageStyles.ts`) |

---

## Hooks

### Mobile: `apps/mobile/hooks/animations/`
- `core/useThemeTransitionAnim.ts` — Reanimated `ic` interpolated colors
- `core/useThemeTransition.ts` — static style helpers
- `modal/useOverlayAnim.ts` — modal entry/exit
- `screen/usePassageAnim.ts` — screen fade + slide
- `ui/usePanelAnim.ts`, `useFABOptions.ts`, `useExpandCard.ts`, `useToggleAnim.ts`
- `text/useLoadingText.ts`, `useTypewriter.ts`, `usePowerSlide.ts`
- `feature/useTimedMessage.ts`, `useAuthEntrance.ts`

### Web: `apps/web/hooks/animations/`
- `useFadeIn.ts` — CSS opacity + translateY entrance animation
- `useThemeTransition.ts` — CSS transition property object during theme switch
- `useLoadingText.ts` — animated dots on loading labels
- `useTimedMessage.ts` — timed inline message with auto-clear