# Context Protection

Core context and infrastructure files are immutable. You may consume them (import, call hooks, read values) but must not edit their internal logic, state shape, reducer logic, or provider structure — unless the task is an explicitly approved migration (e.g. TanStack Query adoption) documented in the current task brief.

---

## Mobile Protected Files (`apps/mobile/`)

### Absolutely Immutable
- `apps/mobile/contexts/AuthContext.tsx`
- `apps/mobile/contexts/ThemeContext.tsx`
- `apps/mobile/contexts/BookingContext.tsx`

### Read Carefully Before Touching
- `apps/mobile/contexts/FABStateContext.tsx` — do not add signals or state without explicit approval
- `apps/mobile/contexts/FitnessContext.tsx` — adding new persisted keys requires updating the storage key constants at the top of the file

### Forbidden Actions (Mobile Contexts)
- Modifying any existing `useCallback` or `useEffect` block in a protected file
- Adding new state variables to a protected provider
- Changing AsyncStorage key formats or storage schemas
- Wrapping or re-exporting protected hooks under new names

### Permitted Additive Actions (Mobile)
- Adding a brand-new exported function to `AuthContext` (e.g. `changePassword`) that does not modify any existing function — must be declared alongside existing callbacks, added to `AuthContextType`, and added to the Provider `value` object
- Reading any context value anywhere in the app

---

## Web Protected Files (`apps/web/`)

### Absolutely Immutable
- `apps/web/contexts/ThemeContext.tsx`

### Mutable Only for Approved Migrations
- `apps/web/contexts/AuthContext.tsx` — internal query/mutation logic may be updated when a TanStack Query migration task is explicitly approved. The public API surface (`user`, `isAuthenticated`, `isLoading`, `login`, `register`, `logout`, `deleteUser`, `updateUser`, `sendOTP`, `verifyOTP`, `verifyCurrentPassword`, `changePassword`, `commitLogin`) must remain unchanged.
- `apps/web/contexts/MemberContext.tsx` — internal fetch logic may be updated for TanStack Query migration. Public surface (`members`, `isLoading`, `error`, `fetchMembers`, `createStaff`, `deleteUser`) must remain unchanged.
- `apps/web/contexts/ScheduleContext.tsx` — may receive additive new methods (`fetchBookings`, `confirmBooking`, `rejectBooking`) and TanStack Query internals when explicitly approved. Existing `addBooking`, `removeBooking`, `updateBooking`, `clearBookings` public surface must remain.

### Forbidden Actions (Web Contexts)
- Modifying `loadUserSettings`, `clearUserSettings`, or the CSS variable injection logic in `ThemeContext`
- Changing the `dark` class toggle behaviour on `<html>`
- Modifying the `isTransitioning` flag timing or the `triggerTransition` callback in `ThemeContext`
- Changing the `localStorage` key format for session or preference storage
- Removing or renaming any method from the public API surface of any context

### Web AuthContext API Surface
The web `AuthContext` exposes: `user`, `isAuthenticated`, `isLoading`, `login`, `register`, `logout`, `deleteUser`, `updateUser`, `sendOTP`, `verifyOTP`, `verifyCurrentPassword`, `changePassword`, `commitLogin`. Do not add mobile-only functions (`markOTPVerified`) to the web context.

---

## Shared Package Protection (`packages/`)

- `packages/types/index.ts` — TypeScript interfaces are additive only. Never remove or rename an existing exported field or type.
- `packages/validators/index.ts` — Zod schemas are additive only. Never weaken a validation rule or remove an existing schema.
- `packages/ui/theme.ts` — Theme definitions are additive. Never remove a theme key, rename a color token, or change an existing color value.
- `packages/ui/index.ts` — Exports are additive only. Never remove an existing export.
- `packages/hooks/index.ts` — Exports are additive only. Never remove `useDebounce`, `useLoadingText`, or `useTimedMessage`.

---

## General Rules

- Context files may be freely imported and consumed.
- If a task genuinely requires a context change beyond an additive-only function, document the reason and proposed diff explicitly and request confirmation before proceeding.
- Do not introduce new global state management systems (Redux, Zustand, Jotai, MobX) without explicit approval.
- Do not add a new context provider without explicit approval.