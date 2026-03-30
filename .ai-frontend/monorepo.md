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
- Entry: `app/layout.tsx` (ThemeProvider), `app/(admin)/layout.tsx` (auth shell)
- Routes: `app/(admin)/dashboard/...` for admin pages, `app/(auth)/login/` for auth
- Dev: `localhost:8080`

---

## Shared Packages (`packages/`)

| Package | Import | Contents |
|---|---|---|
| `@fittrack/ui` | `packages/ui` | `themes`, `THEME_LABELS`, `FONT_FAMILIES`, `WEB_FONT_CLASSES`, `THEME_IS_DARK`, `THEME_ACCENT_COLOR`, `DEFAULT_THEME`, `DEFAULT_FONT`, `FitPreset` (Tailwind), `R`, `MAX_WIDTH` |
| `@fittrack/types` | `packages/types` | `AuthUser`, `Booking`, `CreateBookingDTO`, `ThemeColors`, `ThemeSettings`, `IThemeContext`, `ThemeKey`, `FontKey`, `MemberTier`, `BookingStatus`, `AnimationLevel`, `MemberRecord`, `CreateStaffInput`, `IMemberContext`, `IAuthContext`, `StorageAdapter` |
| `@fittrack/utils` | `packages/utils` | `formatBookingDate`, `formatDate`, `formatDateTime`, `timeAgo`, `calcBMI`, `splitFullName`, `revisePassword`, `formatCurrency`, `formatNumber`, `slotLabel`, `parseYMD`, `getDaysInMonth`, `getFirstDayOfWeek`, `formatShortDate`, `formatLongDate`, `formatMonthYear`, `formatScheduleDate` |
| `@fittrack/hooks` | `packages/hooks` | `useDebounce`, `useLoadingText`, `useTimedMessage` — pure-React hooks, no platform APIs, shared by both apps |
| `@fittrack/validators` | `packages/validators` | `loginSchema`, `registerSchema`, `profilePersonalSchema`, `profileFitnessSchema`, `changePasswordSchema`, `editProfilePersonalSchema`, `editProfileFitnessSchema`, `addProductSchema`, `createBookingSchema` + inferred types |
| `@fittrack/query` | `packages/query` | `makeQueryClient()` — TanStack Query client factory with `staleTime: 60_000`, `retry: 2` |

---

## Import Rules

- Always use path aliases: `@/*` for local app files (`@/components/...`, `@/contexts/...`).
- Import shared logic from `@fittrack/*` packages — never duplicate across apps.
- Import `useDebounce`, `useLoadingText`, `useTimedMessage` from `@fittrack/hooks` — not from local `@/hooks/`.
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
| `exercises.ts` | `EXERCISES`, `AI_TIPS` |
| `calendar.ts` | `MONTH_NAMES`, `WEEK_DAYS` |
| `labels.ts` | Label maps for UI display strings |

### Web: `apps/web/data/`
| File | Key Exports |
|---|---|
| `user.ts` | `MOCK_USERS`, `TIER_LABELS`, `TIER_LEVELS`, `TIER_COLORS`, `BADGE_COLORS`, `MOCK_BADGES`, `MOCK_ACHIEVEMENTS`, `PROFILE_FIELDS`, `STATS` |
| `members.ts` | `MEMBERS_LIST`, `STATUS_COLORS`, `TIER_COLORS` |
| `inventory.ts` | `PRODUCTS_LIST`, `STOCK_STATUS_COLOR`, `MONTHLY_SALES` |
| `schedule.ts` | `SCHEDULE_STATS` |
| `chat.ts` | `ChatSession` type, mock sessions |
| `labels.ts` | `PageKey` type and page label maps |
| `preferences.ts` | `loadPreferences(userId)`, `savePreferences(userId, settings)` — localStorage helpers |

---

## Routing Conventions

### Mobile (Expo Router)
- `app/(tabs)/` — tab navigator screens (home, bookings, nutrition, workout, facilities, chatbot, chathistory, profile, settings)
- `app/(auth)/` — authentication screens (login, register)
- `app/_layout.tsx` — root layout with ThemeProvider, AuthProvider, BookingProvider, FitnessProvider

### Web (Next.js App Router)
- `app/layout.tsx` — root layout, wraps everything in `ThemeProvider`
- `app/(admin)/layout.tsx` — "use client", auth guard + responsive sidebar/header shell
- `app/(admin)/dashboard/` — admin page routes
- `app/(auth)/login/` — authentication entry point (no sidebar)
- `app/(auth)/locked/` — account locked page
- Page-level state and data access via TanStack Query + context hooks (not async RSC in practice)
- Client interactivity is co-located in page files marked `"use client"`

---

## Style Systems Comparison

| | Mobile | Web |
|---|---|---|
| Layout styles | `StyleSheet.create({})` via `makeXxxStyles(colors)` | `CSSProperties` objects via `makeXxxStyles(colors)` |
| Applied via | `style={s.key}` on RN components | `style={s.key}` on HTML elements |
| Component utilities | N/A | Tailwind classes via `cn()` inside Fit components |
| Theme values | `colors.*` (runtime JS objects) | `colors.*` in factories + `var(--fit-*)` CSS variables on `<html>` |
| Animations | `react-native-reanimated` (`useAnimatedStyle`) | CSS transitions (`useFadeIn`, `useThemeTransition`); framer-motion for entrances/slides |
| Conditional styles | Array spread `[s.base, isActive && s.active]` | `cn("base", isActive && "active")` |
| Style files (Mobile) | `apps/mobile/styles/` | — |
| Style files (Web) | — | `apps/web/styles/` (`authStyles.ts`, `fitStyles.ts`, `layoutStyles.ts`, `modalStyles.ts`, `pageStyles.ts`) |

---

## Hooks

### Shared: `@fittrack/hooks` (both apps import from here)
- `useDebounce` — debounces a value by delay ms
- `useLoadingText` — animates trailing dots on a loading label
- `useTimedMessage` — shows a message string that auto-clears after duration

### Mobile-only: `apps/mobile/hooks/animations/`
- `core/useThemeTransition.ts` — Reanimated `ic` interpolated colors + `useThemeTransition` static style helpers
- `core/useThemeTransitionAnim.ts` — same file, named export
- `modal/useOverlayAnim.ts` — modal entry/exit
- `screen/usePassageAnim.ts` — screen fade + slide
- `ui/usePanelAnim.ts`, `useFABOptions.ts`, `useExpandCard.ts`, `useToggleAnim.ts`
- `text/usePowerSlide.ts`, `text/useTypewriter.ts`
- `feature/useTimedMessage.ts` — DEPRECATED: import from `@fittrack/hooks` instead
- `feature/useAuthEntrance.ts` — Reanimated floating animation for auth screens
- `animations/text/useLoadingText.ts` — DEPRECATED: import from `@fittrack/hooks` instead
- `useDebounce.ts` — DEPRECATED: import from `@fittrack/hooks` instead

### Web-only: `apps/web/hooks/animations/`
- `useFadeIn.ts` — CSS opacity + translateY entrance animation
- `useThemeTransition.ts` — CSS transition class string during theme switch
- `usePowerSlide.ts` — framer-motion directional slide (uses `useMotionValue`, `animate`)
- `useToggleAnim.ts` — CSS toggle animation
- `usePanelAnim.ts` — CSS panel slide animation
- `useTypewriter.ts` — framer-motion-based typewriter effect
- `useAuthEntrance.ts` — framer-motion floating animation for auth screens
- `useTimedMessage.ts` — DEPRECATED: import from `@fittrack/hooks` instead
- `useLoadingText.ts` — DEPRECATED: import from `@fittrack/hooks` instead
- `useDebounce.ts` — DEPRECATED: import from `@fittrack/hooks` instead