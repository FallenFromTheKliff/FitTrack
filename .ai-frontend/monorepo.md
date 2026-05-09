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
- Admin shell: `app/(admin)/layout.tsx`.
- Auth routes: `app/(auth)/login`, `app/(auth)/locked`.
- Admin routes: `ai`, `analytics`, `dashboard`, `exercise-lab`, `facilities`, `gamification`, `gym-actions`, `inventory`, `members`, `memberships-promos`, `profile`, `schedule`, `settings`.
- Support routes: `dev/auth-bridge`, `payments/success`, `payments/cancel`.
- Dev command: `pnpm dev:web` or repo stack scripts.
- API entry: `apps/web/lib/api-client.ts`.

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
- `apps/web/components/memberships-promos/` owns memberships and promotions UI.
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
6. Swagger MCP or Notion notes
7. backend source only when explicitly needed for contract truth