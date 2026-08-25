# FitTrack Frontend Context

## Overview

FitTrack is a Turborepo monorepo for SertFit Gym with two frontend surfaces:

- `apps/mobile`: Expo member app for workouts, bookings, nutrition, memberships, profile, AI chat, and fitness progression.
- `apps/web`: Next.js admin/staff app for operations, analytics, accounts, bookings, coaches, appointments, memberships, inventory, facilities, AI, gamification, and settings.

Frontend code acknowledges backend capabilities through the shared client and query packages. Backend implementation is not frontend-owned unless explicitly requested.

## Page And Screen Body Convention

- Web `page.tsx` files and mobile Expo Router screen files own the visible body composition for the route or screen.
- Thin route files are still assembly points: they should show the header, main regions, state branches, section ordering, and overlay or modal mounts.
- Do not hide an entire page or screen behind one full-surface component returned from `page.tsx` or a mobile screen file.
- Components should stay precise building blocks, similar to the app-local Fit primitives. Feature-specific components are fine when they own a bounded section, panel, form, table, modal, or interaction.

## Current Shared Contract Layer

Use these packages before reading backend source:

| Package | Purpose |
|---|---|
| `@fittrack/api-client` | Domain API clients, transport, token store, DTO/record exports |
| `@fittrack/query` | TanStack Query options, mutations, cache helpers, query keys |
| `@fittrack/app-core` | Shared frontend controllers and transforms for auth, members, schedule, bookings, theme |
| `@fittrack/app-config` | App-level config helpers |
| `@fittrack/types` | Cross-app domain and UI types |
| `@fittrack/validators` | Shared Zod schemas and inferred form types |
| `@fittrack/hooks` | Pure React hooks shared by web and mobile |
| `@fittrack/ui` | Theme tokens, themes, font mappings, radii, max widths, style constants |
| `@fittrack/utils` | Formatting, date, number, password, schedule, and domain utility helpers |

## Mobile Architecture

### Stack

- Expo 55 with Expo Router
- React Native 0.83 and React 19
- Reanimated 4
- TanStack Query 5
- AsyncStorage through existing token/theme/session helpers
- `mobileApiClient` from `apps/mobile/lib/api-client.ts`

### Main Route Shape

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(auth)/`
- `apps/mobile/app/(tabs)/`

### Current Local Areas

- `components/fit`: mobile Fit primitives
- `components/chatbot`, `components/mastery`, `components/membership`, `components/profile`, `components/workout`
- `components/modals`, `components/settings`, `components/requirements`
- `hooks/workout`, `hooks/chatbot`, `hooks/membership`, `hooks/mastery`, `hooks/profile`
- `data`: bounded local display/static data
- `lib/api-client.ts`, `lib/queryClient.tsx`

## Web Architecture

### Stack

- Next.js 16 App Router
- React 19
- TanStack Query 5
- Tailwind CSS 3 with `cn()` and token classes
- Radix primitives where installed and useful
- Recharts for charts
- Sonner for toast feedback
- `react-hook-form` and Zod validators
- `framer-motion` for richer web motion
- `webApiClient` from `apps/web/lib/api-client.ts`

### Current Route Shape

```text
apps/web/app/
  (auth)/
    accounts/
    ai/
    analytics/
    bookings/
    dashboard/
    exercise-lab/
    facilities/
    gamification/
    gym-actions/
    inventory/
    mastery/
    memberships/
    nutrition/
    profile/
    schedule/
    settings/
    workout/
  (land)/
    (home)/
      page.tsx
    locked/
    login/
    dev/
      auth-bridge/
    payments/
      cancel/
      success/
```

### Current Local Areas

- `components/fit`: web Fit primitives such as `FitButton`, `FitCard`, `FitChartContainer`, `FitFilter`, `FitInputField`, `FitPagination`, `FitPill`, `FitSearch`, `FitSection`, `FitTable`, `FitText`
- `components/layout`: admin shell layout pieces
- `components/analytics`, `components/exercise-lab`, `components/gamification-admin`, `components/gym-actions`, `components/inventory`, `components/map`, `components/schedule`
- `hooks/analytics`, `hooks/ai`, `hooks/dashboard`, `hooks/animations`
- `contexts`: `AuthContext`, `ThemeContext`, `MemberContext`, `ScheduleContext`, `AnalyticsSectionFilterContext`
- `lib/api-client.ts`, `lib/queryClient.tsx`, `lib/portal-access.ts`

## Current Contract Coverage

The frontend already has shared API/query coverage for many domains:

- auth, forgot/reset password, current user, OTP, profile
- admin members, deletion requests, attendance QR/manual check-in, membership cards
- bookings, venues, staff bookings, coach bookings, appointments, coaches, availability
- analytics snapshots, revenue, attendance, insights, PDF export
- AI chat sessions/messages and training plan generation
- inventory products, equipment, sales, restock/write-off
- memberships, membership payments
- gym layout equipment and floor plan media
- notifications and preferences
- exercise lab, pose sessions, muscles, rankings, milestones, plans
- gamification admin state, seasons, integrity, standings
- audit logs and gym actions summaries

Do not assume an endpoint is missing because older docs said it was. Check `@fittrack/api-client`, `@fittrack/query`, and current frontend usage first.

## Design And Notes Sources

- `.ai-frontend/ui-ux-workflow.md` contains the migrated local rules from the Notion `FitTrack - UI/UX Enhancements` sections `THINGS TO NOTE:` and `CODE RULES:`.
- `.ai-frontend/style.md` and `.ai-frontend/performance.md` define local implementation guardrails.
- Notion `FITTRACK: Backup Log` contains project notes, commands, UI/UX guidance, and copied environment/context pages, but Notion is explicit-only context.
- Notion notes can guide intent when explicitly requested, but current source files and shared contract packages decide what exists and how it is wired.
- Avoid repeating secrets from Notion or `.env` files in chat or docs.
