---
name: schema-contract-sync
description: "Use for FitTrack schema/API/client/UI drift: Prisma schema changes, migrations, seeds, DTO or API contract changes, Swagger/client/query/form mismatches, data-shape drift, TypeScript type errors caused by contracts, and integration bugs where web or mobile UI behavior disagrees with the backend contract."
---

# FitTrack Schema Contract Sync

## Overview

Use this skill to trace one contract-shaped bug or change from its canonical source through backend, generated clients, query hooks, shared types, and UI consumers. Keep the fix as small as possible while making the owning layer explicit.

Read `references/contract-sync-checklist.md` when the change touches more than one layer, DB-backed data, auth-sensitive shape, or generated clients.

## Repo Defaults

- Prisma and seeds: `apps/api/prisma`
- API source, DTOs, controllers, services, repositories: `apps/api/src`
- Generated or handwritten API client: `packages/api-client`
- Query hooks and cache adapters: `packages/query`
- Shared app contracts and domain helpers: `packages/app-core`
- Web consumers: `apps/web`
- Mobile consumers: `apps/mobile`

Ignore generated or noisy paths unless the failure is inside generation output: `.artifacts/`, `node_modules/`, `apps/web/.next/`, `apps/mobile/.expo/`, `apps/mobile/dist-web-auth-check/`, and build outputs.

## Canonical Source First

Identify the canonical source before patching:

- Database invariant or persisted relationship: Prisma schema, migration history, seed state, repository contract.
- Request or response shape: DTO, controller metadata, Swagger, service mapper, API client type.
- Domain meaning: backend service or shared app-core type, not a one-off view mapper.
- Presentation-only copy, ordering, grouping, or local affordance: frontend view or form state.
- Cache identity, invalidation, or optimistic update shape: query package plus client return type.

If the source is unclear, scan consumers before deciding. Do not let the first failing TypeScript error choose ownership by accident.

## Required Workflow

1. State the suspected drift: field, enum, endpoint, relation, auth rule, payload, filter, aggregate, or action shape.
2. Identify the canonical source and record whether the fix should bias backend canonical or frontend presentation.
3. If DB-backed, scan `apps/api/prisma/schema.prisma`, relevant migrations, and seeds before editing DTOs or UI.
4. Scan DTOs, controllers, Swagger decorators, services, repositories, guards, and mappers in `apps/api/src`.
5. Scan `packages/api-client`, `packages/query`, and `packages/app-core` for generated types, hand mappers, cache keys, validators, and shared enums.
6. Scan forms, views, tables, modals, and mobile screens consuming the contract in `apps/web` and `apps/mobile`.
7. Patch the smallest coherent chain from canonical source to consumers.
8. Update migration, seed, API client, query hook, shared type, Swagger docs, or form schema whenever the edited layer requires it.
9. Verify in order: direct API, Swagger or client generation, query/client TypeScript, then UI behavior.

## Data-Shape Bias

Bias backend canonical when the UI needs:

- canonical statuses, labels, permissions, or action availability
- server-backed search, filter, sort, pagination, or aggregate fields
- cross-record meaning, joined data, or non-null guarantees
- role-aware response differences or denial reasons
- payloads reused by more than one web or mobile surface

Bias frontend presentation when the backend already exposes stable truth and the change is only:

- display formatting, layout grouping, local control state, or transient draft state
- route-specific filtering of an already complete dataset
- view copy that does not change domain meaning
- client-only optimistic state with a confirmed server reconciliation path

## Hard Rules

- Do not make a DB schema change without considering migration, seed, reset, and repository impact.
- Do not widen a DTO, enum, response, or action payload without checking `packages/api-client`, `packages/query`, and active web/mobile consumers.
- Do not add a local UI workaround when the backend should own canonical status, label, search, filter, aggregate, permission, or action payload semantics.
- Do not treat Swagger as canonical if live controller behavior or direct API checks disagree.
- Do not change generated client output by hand unless the repo already treats that file as handwritten.
- Do not hide contract drift with `any`, duplicate local types, broad optional fields, or silent fallback labels.
- Preserve backward compatibility unless the request explicitly owns a breaking change and all consumers are patched in the same chain.

## Patch Strategy

- Prefer mapper updates at contract edges over repeated per-view reshaping.
- Keep DTO validation, Swagger decorators, service return shapes, API client types, and query hook return types aligned.
- For enum or status drift, update all string unions, generated clients, display helpers, filters, and tests that encode the allowed set.
- For nullable or optional fields, decide whether nullability is a database fact, a DTO compatibility choice, or a frontend loading state before editing types.
- For auth or permission data, verify guards, roles, seeded accounts, and response fields together.
- For migrations or seeds, keep local reset and reseed paths viable.

## Verification

Use the narrowest proof that exercises the edited chain:

- DB-backed: confirm migration state, seed state, and repository/service behavior before UI.
- API-backed: call the endpoint directly with a seeded or known account before checking docs.
- Swagger/client: confirm `/v1/docs-json`, generated client output, or client types after direct API behavior passes.
- Frontend: run TypeScript or focused tests for the client/query/view chain, then verify the visible web or mobile flow.

Use Context7 or Exa only when current Prisma, NestJS, Swagger, or generator behavior is needed and local repo truth is insufficient. Prefer official docs through Context7 for library syntax.

## Completion Note

End with the canonical source, files changed by layer, generated or migration artifacts updated, and verification evidence in the same direct API -> Swagger/client -> UI order.
