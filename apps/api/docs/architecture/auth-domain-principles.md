# Auth Domain Principles

These rules define how the `auth` domain handles required user aggregates,
nullable identity lookups, OTP orchestration, and service boundaries.

## Repository Contracts

- Use nullable `find*` methods only when absence is intentionally part of the
  flow.
- Use `*OrThrow` methods for required user/account reads in authenticated or
  post-verification flows.
- Repositories must translate missing-record persistence failures into domain-safe
  HTTP exceptions instead of leaking raw Prisma errors.

## Security-Sensitive Nullability

- Nullable identity lookups are allowed when preserving security semantics such
  as:
  - invalid login credentials returning `401`
  - enumeration-safe endpoints returning `200`
- Do not replace security-sensitive nullable checks with generic repository
  `404` behavior.

## Required Auth Aggregate

- Any auth flow that issues tokens or mutates user-scoped auth state must work
  with a required aggregate:
  - `User`
  - `UserProfile`
- Missing required profile data must fail explicitly. Do not optional-chain
  required profile fields when issuing tokens or verifying phone flows.

## OTP Responsibilities

- `AuthService` owns auth workflows and orchestration.
- `AuthOtpService` owns OTP issuance, validation, attempt tracking, lock
  handling, and queue dispatch.
- OTP-specific constants must live under `src/auth/otp/`.

## Transactions

- Database writes that must succeed together should be grouped transactionally.
- External side effects, such as queueing OTP delivery, should happen after the
  required database state is committed.

## Testing Checklist

- Missing identity on login
- Suspended or banned account behavior
- Missing required profile in authenticated auth flows
- Missing phone number during phone verification
- Enumeration-safe no-op flows
- Locked, expired, consumed, invalid, and successful OTP paths
