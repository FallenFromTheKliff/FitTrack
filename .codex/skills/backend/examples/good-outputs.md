# Good Backend Outputs

Use these repo patterns as the default target shape.

## 1. Thin controller plus guard plus Swagger surface

Reference: `apps/api/src/user/user.controller.ts`

Why it is good:

- controller owns routing, guards, DTOs, and Swagger metadata
- actor context comes from `@CurrentUser()`
- business logic is delegated to services
- status-heavy endpoints document important failure responses

## 2. Lifecycle service plus queue processor split

References:

- `apps/api/src/bookings/booking/booking-lifecycle.service.ts`
- `apps/api/src/bookings/booking/booking-lifecycle.processor.ts`

Why it is good:

- queue constants, delayed jobs, and event handling live in the lifecycle layer
- processor stays small and delegates back to service methods
- notifications and other side effects are dispatched after state transitions

## 3. Domain contract rules written down beside code

References:

- `apps/api/docs/architecture/auth-domain-principles.md`
- `apps/api/docs/architecture/user-domain-principles.md`

Why it is good:

- required aggregates and nullable reads are documented explicitly
- transaction and security-sensitive behavior is standardized
- the next edit can extend an established pattern instead of re-deciding it

## 4. Migration-safe backend revision

Good shape:

- schema change, repository logic, seed assumptions, and verification notes move together
- the runtime path is rechecked through direct API and Swagger after tests pass

Why it is good:

- it keeps local development truth aligned with the checked-in contract
- it prevents false-green backend work caused by stale seed or Swagger state
