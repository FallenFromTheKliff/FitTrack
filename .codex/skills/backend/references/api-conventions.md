# API Conventions

This skill is grounded in the current `apps/api` implementation.

## Entry-point defaults

Source of truth: `apps/api/src/main.ts`

- Global prefix comes from config and defaults to `/v1`.
- `helmet`, `cookie-parser`, and CORS are enabled centrally.
- The global `ValidationPipe` uses:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
  - implicit conversion enabled
- The app installs:
  - `ResponseInterceptor`
  - `HttpExceptionFilter`
- Swagger is served at `/v1/docs` and uses bearer auth id `access-token`.

## Success envelope

Source of truth: `apps/api/src/common/interceptors/response.interceptor.ts`

Default success shape:

```ts
type ApiResponse<T> = {
  data: T
  meta?: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}
```

Rules:

- Non-paginated handlers should return domain data and let the interceptor wrap it as `{ data }`.
- Paginated handlers may return `{ data, meta }` directly.
- Do not hand-roll alternate success envelopes.

## Error shape

Source of truth: `apps/api/src/common/filters/http-exception.filter.ts`

Problem details shape:

```ts
type ProblemDetailsBody = {
  type: string
  title: string
  status: number
  detail: string
}
```

Observed standard `type` values from the filter:

- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `GONE`
- `UNPROCESSABLE_ENTITY`
- `LOCKED`
- `TOO_MANY_REQUESTS`
- `PAYLOAD_TOO_LARGE`
- `INTERNAL_SERVER_ERROR`

Rules:

- Throw domain-safe `HttpException` variants. Do not leak raw Prisma errors.
- Preserve security-sensitive nullability in auth flows when the repo already does so.
- File upload failures are normalized by the global filter. Do not add bespoke upload error envelopes.

## Auth and route protection

Current common pieces:

- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/guards/roles.guard.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`
- `apps/api/src/common/decorators/roles.decorator.ts`

Route pattern:

- controller-level `@ApiBearerAuth('access-token')`
- `@UseGuards(JwtAuthGuard)` for authenticated routes
- add `RolesGuard` only where role filtering is needed
- use `@Roles(UserRole.admin, ...)` with Prisma `UserRole` enums when available
- access JWT data through `@CurrentUser()`

Notes:

- `RolesGuard` assumes it runs after `JwtAuthGuard`.
- Preserve existing portal-role semantics instead of broadening access casually.

## Swagger conventions

Observed controller pattern:

- `@ApiTags(...)` at controller level
- `@ApiOperation({ summary: ... })` on methods
- `@ApiResponse(...)` for important status paths
- `@ApiConsumes('multipart/form-data')` and `@ApiBody(...)` for file uploads

Rules:

- Keep summaries short and task-oriented.
- Document the meaningful non-200 statuses for role-sensitive or business-rule-heavy endpoints.
- Keep tags aligned with current domain groupings like `Auth`, `Users`, `Bookings`, `Coaching`, `Inventory`, `Payments`, `Fitness`, and `Notifications`.

## DTO and validation pattern

Current stack:

- `class-validator`
- `class-transformer`
- shared decorators under `apps/api/src/common/validators/`

Rules:

- Keep request DTOs in `dto/` beside the owning module.
- Prefer request and response separation when response shape differs from persistence shape.
- Reuse custom validators before adding one-off inline regex logic.
- Keep DTO naming consistent with surrounding module style:
  - some older modules use `*.dto.ts`
  - some older user files still use `user-dto.ts`
  - new work should match the nearest local pattern instead of forcing a repo-wide rename

## Repository and Prisma usage

Architecture guidance lives in:

- `apps/api/docs/architecture/domain-folder-conventions.md`
- `apps/api/docs/architecture/auth-domain-principles.md`
- `apps/api/docs/architecture/user-domain-principles.md`

Rules:

- For non-trivial modules, keep Prisma inside repositories.
- Reuse `apps/api/src/common/base-repository/base-repository.ts` when the module already fits that abstraction.
- Use transactions for multi-write flows that must stay atomic.
- Do not prove resource existence via accidental foreign-key failures.
- Prefer `find*OrThrow` repository contracts when the resource is required by the business flow.

## Queue and lifecycle pattern

Representative files:

- `apps/api/src/bookings/booking/booking-lifecycle.service.ts`
- `apps/api/src/bookings/booking/booking-lifecycle.processor.ts`
- `apps/api/src/membership/subscription/subscription-lifecycle.service.ts`
- `apps/api/src/queue/queue.module.ts`

Pattern:

- constants define queue and job ids
- lifecycle service owns scheduling and event reactions
- `@Processor(queueName)` class owns job execution
- notifications and other side effects are dispatched from lifecycle services after state is committed

## Redis and infra use

Wiring lives in `apps/api/src/app.module.ts`.

Rules:

- treat Redis as infra wiring for auth, throttling, queue support, and coordination
- do not invent per-feature cache layers unless a real repo pattern already exists
- keep config-driven connection setup inside Nest modules

## Testing defaults

- Unit specs sit beside modules with `.spec.ts`.
- API e2e specs live in `apps/api/test/`.
- When behavior spans transactions, auth, queues, or lifecycle side effects, add or update focused coverage near the owning module and add e2e only when the contract surface changes.
