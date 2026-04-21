# Migration Playbook

Use this reference when backend work changes schema, relations, seed-owned behavior, or DB-backed business rules.

## Default workflow

1. inspect the current schema and local migration state first
2. decide whether the change is additive, a business-rule revision, or a data-shape correction
3. make the schema change and the repository or service change together
4. create or apply the migration with a descriptive name
5. reseed or report the local test data when verification depends on deterministic fixtures
6. verify the new behavior through targeted tests, direct API checks, and Swagger when the contract changed

## Safe defaults

- prefer additive columns, relations, enums, or states when the behavior can evolve without destructive rewrites
- keep migration names descriptive to the business intent
- update seed-owned fixtures when a new invariant would otherwise make runtime verification misleading
- document when a local reset or additive reseed is required to re-create the intended verification state

## Prisma Local usage

- use Prisma Local early when the task touches schema, migrations, auth invariants, or seeded runtime data
- inspect migration status before assuming the repo and local database agree
- use `migrate dev` style flows for checked-in schema changes, not ad hoc push shortcuts

## Last-resort paths

- avoid `db push` for normal long-lived changes because it bypasses checked-in migration history
- do not propose replacing Prisma, Postgres, or Nest layers just because a local module is messy
- normalize the implementation inside the current stack first
