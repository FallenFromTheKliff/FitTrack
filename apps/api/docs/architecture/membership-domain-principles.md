# Membership Domain Principles

These rules define how the `membership` domain handles its `subscription` and
`payment` modules, required-record contracts, and service boundaries.

## Structure

- The `membership` root stays thin and owns the Nest module wiring.
- `subscription` and `payment` live in their own subfolders.
- DTOs, events, repositories, services, controllers, and specs live with the
  module that owns them.

## Repository Contracts

- Use nullable reads only when "not found" is a valid business state.
- Use explicit `*OrThrow` methods for required plan, subscription, payment, and
  payment-context reads.
- Repositories must translate missing-record persistence failures into
  domain-safe HTTP exceptions instead of leaking raw Prisma errors.

## Subscription Rules

- Public plan reads must intentionally filter to active plans.
- Authenticated subscription flows must use required repository contracts for:
  - current subscription reads
  - cancellable subscription reads
- Partial plan updates should be mapped through helper functions instead of
  inline `if` ladders.

## Payment Rules

- Ownership-sensitive payment reads must use explicit owner/staff repository
  contracts.
- Required payment verification reads must use non-null repository contracts
  before status transitions or event emission.
- Unsupported manual payment types should fail explicitly in the service layer
  instead of falling through to runtime behavior.

## Side Effects

- Emit audit and business events only after the required database mutation is
  valid and accepted.
- Keep repository responsibilities focused on persistence and service
  responsibilities focused on business orchestration.

## Testing Checklist

- Missing active plan
- Missing current subscription
- Missing cancellable subscription
- Owner versus staff payment access
- Missing payment on verification
- Invalid payment verification status
- Unsupported manual payment type
