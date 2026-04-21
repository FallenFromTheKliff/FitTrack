# Backend Anti-Patterns To Avoid

These are inferred from current architecture guidance and recurring failure modes the repo is already defending against.

## Controller owns persistence

Bad shape:

- controller calls Prisma directly
- controller assembles transactions or queue jobs
- controller performs large DTO-to-model mapping

Why to avoid it:

- breaks the controller-service-repository split
- makes auth, Swagger, and business rules harder to maintain

## Mixed-responsibility domain root

Bad shape:

- flattening unrelated concerns into one giant service under a multi-module domain
- adding new payment or OTP behavior to an existing root service instead of using a dedicated subfolder

Why to avoid it:

- the repo already uses module splits like `auth/otp` and `membership/subscription|payment`

## Side effects before commit

Bad shape:

- queueing mail or emitting downstream events before the transactionally required DB writes are committed

Why to avoid it:

- creates ghost notifications and inconsistent state

## Raw persistence errors as API behavior

Bad shape:

- relying on Prisma foreign-key failures to prove a resource exists
- surfacing raw Prisma error payloads in HTTP responses

Why to avoid it:

- the repo expects domain-safe exceptions and problem details responses

## Schema change without migration discipline

Bad shape:

- schema changes land without a checked-in migration, seed update, or runtime recheck

Why to avoid it:

- local verification becomes misleading and other developers cannot reproduce the intended state

## Backend leaves the page half-finished

Bad shape:

- the UI exposes sorting, filtering, status handling, or a visible action
- but the backend contract is missing the params, fields, denial semantics, or endpoint seam needed to complete that page cleanly

Why to avoid it:

- frontend polish cannot compensate for an underspecified backend contract
