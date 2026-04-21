# Good Frontend Outputs

Use these repo patterns as the default target shape.

## 1. Thin route wrapper

Reference: `apps/web/app/(auth)/login/page.tsx`

Why it is good:

- route file stays tiny
- feature ownership lives in reusable components instead of the route shell

## 2. Feature hook owns orchestration

Reference: `apps/web/hooks/facilities/useFacilities.ts`

Why it is good:

- queries, mutations, derived state, and validation stay in a focused hook
- the UI can stay modular across map panels, tables, and modals
- line count in page components stays controlled

## 3. Mobile screen controller pattern

Reference: `apps/mobile/hooks/profile/useProfileScreen.ts`

Why it is good:

- query wiring, modal state, derived labels, and mutation flows are centralized
- screen components can compose sections and modals instead of owning every branch

## 4. Shared auth orchestration

Reference: `packages/app-core/auth/createAuthController.ts`

Why it is good:

- session behavior, role gating, and commit flows are centralized
- web and mobile can share the same action logic while keeping platform-specific storage behavior in their own API clients

## 5. Reusable helpers and mini-functions

Good shape:

- repeated formatters, status mappers, and payload shapers are extracted out of JSX or mutation handlers
- helper scope stays close to the owning feature until a broader shared need is real

Why it is good:

- it removes noisy inline logic
- it improves reuse without inventing unnecessary abstractions

## 6. Safe modernization of stale reusable units

Good shape:

- an older `Fit*` primitive or helper is widened, renamed, or cleaned up so the new feature can reuse it
- the implementation keeps the existing theme language and compatibility surface intact

Why it is good:

- it reduces duplicate UI and logic
- it preserves the app's current component vocabulary instead of fragmenting it
