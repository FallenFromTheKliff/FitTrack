# User Domain Principles

These rules define how the `user` domain handles nullable database results,
partial updates, and multi-step writes.

## Repository Contracts

- Use nullable `find*` methods only when "not found" is an expected business
  state.
- Use `*OrThrow` methods for required resources in request/command flows.
- Repositories must translate persistence-level missing-record failures into
  domain-safe HTTP exceptions instead of leaking raw Prisma errors.

## User Aggregate Invariants

- A user-facing aggregate is expected to contain:
  - `User`
  - `UserProfile`
  - `NotificationPreference`
- Missing required related records must fail explicitly. Do not silently
  optional-chain required user aggregate data.

## Update Mapping

- Build patch/update objects in dedicated mapper helpers.
- Do not inline large `if (dto.field !== undefined)` ladders inside service
  methods.
- Use shared helpers such as `pickDefined` for direct field passthrough.
- Handle special transforms, such as date parsing, explicitly in the mapper.

## Service Rules

- Service methods must not rely on raw foreign-key or update failures to prove
  that a user exists.
- If a service reads or mutates user-scoped data, it must use a non-null
  repository contract before continuing, unless absence is part of the business
  rule.
- Do not use non-null assertions such as `value!` after manual existence
  checks; prefer non-null return contracts instead.

## Transactions

- Any operation that changes multiple user-domain records must wrap all database
  writes in a transaction.
- External side effects, such as sending OTP messages, should happen after the
  database state is committed.

## Testing Checklist

- Missing user
- Missing user profile
- Missing notification preferences
- Missing attendance log
- Invalid or inactive QR
- Empty partial updates
- Multi-write flows that must remain atomic
