# Contract Sync Checklist

Use this checklist when a FitTrack change crosses schema, API, client, query, or UI boundaries. Keep the checked set proportional to the risk.

## Prisma

- Identify whether the contract is backed by `apps/api/prisma/schema.prisma`.
- Check model fields, relation names, enum values, indexes, defaults, nullable fields, and cascading behavior.
- Confirm repository assumptions match the persisted shape.
- Decide whether the change is additive, corrective, or breaking.

## Migrations

- Check existing migrations for prior naming, enum, default, and relation conventions.
- Add or update a migration when schema changes are durable.
- Consider backfill, rollback risk, local reset, and seeded data compatibility.
- Do not use a schema shortcut when a real migration is needed.

## Seeds

- Check seed files for required accounts, roles, plans, gyms, schedules, subscriptions, fixtures, and status values.
- Update seeds when new non-null fields, enums, permissions, or demo UI states require data.
- Keep reset plus reseed able to produce the expected runtime state.
- Avoid seed-only fixes for production contract bugs.

## DTOs

- Check create, update, query, response, nested, and list DTOs.
- Keep validation decorators, transform behavior, Swagger decorators, and TypeScript fields aligned.
- Avoid broad optional widening unless existing clients truly need compatibility.
- Update service mappers when DTOs change.

## Controllers And Services

- Confirm controller route, guard, role, current-user, status code, and Swagger behavior.
- Confirm services own domain rules, status labels, action availability, aggregates, and permission-aware fields.
- Confirm repositories own non-trivial Prisma access and null handling.
- Keep error responses and denial paths explicit.

## Swagger

- Check `@ApiProperty`, `@ApiResponse`, query params, path params, request bodies, enum metadata, and response wrappers.
- Confirm `/v1/docs-json` after direct API behavior passes.
- Treat Swagger as documentation of live behavior, not a replacement for direct API verification.

## API Client

- Check generated or handwritten endpoint methods, request types, response types, enum exports, and wrapper shapes.
- Regenerate clients when the repo expects generated contract output.
- Do not hand-edit generated output unless it is intentionally checked in as source.
- Preserve compatibility for existing consumers unless all call sites are updated.

## Query Hooks

- Check query keys, mutation payloads, invalidation, optimistic updates, selectors, and return types.
- Ensure query hooks expose the same shape the API client returns or intentionally map at the package boundary.
- Update cache identity when filters, pagination, search, auth scope, or tenant scope change.

## Forms

- Check form schemas, default values, submit payloads, field names, enum options, error mapping, and disabled states.
- Keep create and edit forms aligned when they share a contract.
- Avoid form-only transformations for canonical backend semantics.

## Views

- Check tables, cards, modals, drawers, mobile screens, filters, empty states, and action menus.
- Replace duplicate local mappers with shared helpers when more than one surface consumes the same shape.
- Keep presentation formatting local when it does not change domain meaning.

## Auth And Permission Data

- Check guards, roles, seeded accounts, tenant or gym scoping, membership state, and response fields for action availability.
- Confirm denial and hidden-action behavior with the right user type.
- Do not infer permissions purely from UI state when the backend can expose canonical availability.

## Verification Order

1. Confirm database schema and seed truth for DB-backed changes.
2. Run focused backend tests or direct service checks when behavior changed.
3. Call the endpoint directly with realistic auth and payloads.
4. Check Swagger docs or generated docs JSON.
5. Regenerate or typecheck API client and shared types.
6. Run query hook or frontend TypeScript checks.
7. Verify the affected web or mobile UI flow.
8. Re-check adjacent consumers that share the same contract.
