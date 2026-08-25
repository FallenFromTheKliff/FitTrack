# Monorepo Structure

## Applications

### `apps/mobile`

- Expo 55 member app.
- Router: Expo Router.
- Entry: `app/_layout.tsx`.
- Main route groups: `app/(auth)` and `app/(tabs)`.
- Dev command: `pnpm dev:mobile` or repo stack scripts.
- API entry: `apps/mobile/lib/api-client.ts`.

### `apps/web`

- Next.js 16 admin/staff app.
- Entry: `app/layout.tsx`.
- Public shell: `app/(land)/layout.tsx`.
- Public routes: `app/(land)/(home)`, `app/(land)/login`, `app/(land)/locked`.
- Authenticated portal shell: `app/(auth)/layout.tsx`.
- Authenticated portal routes: `accounts`, `ai`, `analytics`, `bookings`, `dashboard`, `exercise-lab`, `facilities`, `gamification`, `gym-actions`, `inventory`, `mastery`, `memberships`, `nutrition`, `profile`, `schedule`, `settings`, `workout`.
- Support routes: `app/(land)/dev/auth-bridge`, `app/(land)/payments/success`, `app/(land)/payments/cancel`.
- Dev command: `pnpm dev:web` or repo stack scripts.
- API entry: `apps/web/lib/api-client.ts`.
- Navigation labels should preserve current FitTrack naming, including `Accounts`, `Gym Actions`, and `Gym Memberships` for the memberships surface..

## Shared Packages

| Package | Contents |
|---|---|
| `@fittrack/api-client` | API domain clients, axios transport, token store, exported API DTO/record types |
| `@fittrack/app-config` | Shared app configuration helpers |
| `@fittrack/app-core` | Frontend controllers, auth/session helpers, schedule/member/booking transforms |
| `@fittrack/hooks` | Pure React hooks such as `useDebounce`, `useLoadingText`, `useTimedMessage` |
| `@fittrack/query` | TanStack Query option factories, mutation options, cache invalidation helpers, query keys |
| `@fittrack/types` | Shared domain, context, UI, and theme types |
| `@fittrack/ui` | Tokens, themes, font maps, radii, max widths, style constants |
| `@fittrack/utils` | Formatting, date/time, number, schedule, profile, and password utilities |
| `@fittrack/validators` | Shared Zod schemas and inferred form input types |

## Goal Scoping

- Web-only goal = work inside `apps/web` plus needed shared frontend packages.
- Mobile-only goal = work inside `apps/mobile` plus needed shared frontend packages.
- Shared-package goal = work inside `packages/*` only.
- Backend contract investigation = read-only backend lookup only when shared package/client/query/frontend usage is insufficient.
- Cross-surface goal = only when the user explicitly asks.
- Do not start commands for unrelated app surfaces.

## Route And Screen Body Ownership

- Web `page.tsx` files live in `apps/web/app/**/page.tsx` and own the body composition for their route.
- Mobile screen files live under `apps/mobile/app/(auth)` and `apps/mobile/app/(tabs)` and own the body composition for their screen.
- Route and screen files should assemble bounded sections, panels, controls, modals, and overlay mounts directly enough that the body is readable at the route level.
- Feature folders under `components/{feature}/` provide surgical building blocks, not one full-page component that replaces the route or screen body.
- If composition gets large, split by section, modal flow, or interaction owner while keeping `page.tsx` or the screen file as the primary body assembly point.

## Import Rules

- Use app aliases for app-local code: `@/components`, `@/contexts`, `@/hooks`, `@/lib`, `@/utils`.
- Use `@fittrack/*` packages for shared contracts and reusable pure logic.
- Do not import `apps/mobile` from `apps/web` or `apps/web` from `apps/mobile`.
- Do not import platform APIs from `packages/` unless that package is explicitly platform-specific. Current shared packages should stay platform-neutral.
- Prefer `@fittrack/query` and `@fittrack/api-client` over local ad hoc request code.

## Web Data And Feature Areas

- `apps/web/data/` is organized by feature folders such as auth, charts, facilities, inventory, members, profile, progress, and schedule.
- `apps/web/components/fit/` contains app-local HTML Fit primitives.
- `apps/web/components/map/` owns facilities and floor plan UI.
- `apps/web/components/schedule/` owns gym operations overlays and schedule UI.
- `apps/web/hooks/analytics/`, `hooks/ai/`, and `hooks/dashboard/` hold route controllers.

## Mobile Data And Feature Areas

- `apps/mobile/data/` contains bounded local data for amenities, bookings, exercises, home, member, nutrition, settings, and workout.
- `apps/mobile/components/fit/` contains app-local React Native Fit primitives.
- `apps/mobile/components/workout/`, `membership/`, `mastery/`, `profile/`, and `chatbot/` own feature UI.
- `apps/mobile/hooks/workout/`, `membership/`, `mastery/`, `profile/`, and `chatbot/` own feature controllers.

## Styling Shape

| Concern | Mobile | Web |
|---|---|---|
| Layout styles | `StyleSheet.create` factories | `CSSProperties` factories |
| Applied via | `style={s.key}` | `style={s.key}` |
| Component utilities | app-local RN Fit primitives | Tailwind through `cn()` inside app-local Fit primitives |
| Theme values | `colors.*` and Reanimated interpolated colors | `colors.*` plus CSS variables mapped into Tailwind tokens |
| Animations | Reanimated | CSS transitions and framer-motion |

## Backend Boundary

Frontend agents may acknowledge backend contracts but should not edit backend source by default.

Use this order for contract discovery:

1. current frontend usage
2. `@fittrack/query`
3. `@fittrack/api-client`
4. `@fittrack/app-core`
5. `@fittrack/types` and `@fittrack/validators`
6. Swagger MCP or explicitly requested Notion notes
7. backend source only when explicitly needed for contract truth
