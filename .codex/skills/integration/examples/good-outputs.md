# Good Integration Outputs

Use these connected slices as the default shape for future integration work.

## 1. Shared auth orchestration across backend, web, and mobile

References:

- `apps/api/src/auth/auth.controller.ts`
- `apps/web/contexts/AuthContext.tsx`
- `apps/mobile/contexts/AuthContext.tsx`
- `packages/app-core/auth/createAuthController.ts`

Why it is good:

- backend, web, and mobile share one consistent auth contract
- session behavior is centralized instead of duplicated per surface
- role gating is handled deliberately instead of by accidental UI drift

## 2. Facilities and layout flow

References:

- `apps/api/src/gym-layout/gym-layout.controller.ts`
- `packages/api-client/domains/gym-layout.ts`
- `packages/query/gym-layout.ts`
- `apps/web/hooks/facilities/useFacilities.ts`

Why it is good:

- backend endpoint, API client, query layer, and feature hook line up cleanly
- the web feature composes modular UI pieces instead of one giant page file

## 3. Mobile profile and membership wiring

References:

- `apps/api/src/user/user.controller.ts`
- `apps/api/src/membership/subscription/subscription.controller.ts`
- `packages/query/profile.ts`
- `packages/query/membership.ts`
- `apps/mobile/hooks/profile/useProfileScreen.ts`

Why it is good:

- one screen hook coordinates multiple backend domains without inlining transport code
- membership and profile state stay aligned through the shared query layer

## 4. Integration routed to the right companion skills

Good shape:

- reusable UI and client wiring goes to `frontend`
- layout or modal polish goes to `frontend-uiux-polish`
- contract or DB-backed invariant fixes go to `backend`
- final verification goes to `quality-assurance`

Why it is good:

- it keeps each fix close to the right layer
- it reduces context sprawl during end-to-end work

## 5. Evidence-backed bundle closure

Good shape:

- direct API evidence exists for the touched contract
- Swagger is checked when the live contract changed
- Playwright captures the real browser flow and visible post-action state

Why it is good:

- the feature is closed on system truth, not just code inspection
