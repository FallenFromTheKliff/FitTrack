# Refactor Driver Runtime Core

Follow the shared rules below using the execution controller variables and system-managed state in `tasks/integration-builder/refactor-driver.md`.

## Always Read First

In every normal refactor run, read or inspect:

1. `tasks/integration-builder/refactor-driver.md`
2. `agents/architecture.md`
3. `tasks/integration-builder/integration-preflight.cmd`
4. `docker-compose.local-infra.yml`
5. `.env.example`
6. `packages/types`
7. `packages/api-client`
8. `packages/query`
9. `packages/validators`
10. the paths listed in `MODULE_HINTS`

Also inspect the active implementation surfaces as needed:

- `apps/api`
- `apps/ai-microservice`
- `apps/web`
- `apps/mobile`

## Shared Guardrails

- reuse the integration-driver runtime and architecture guardrails instead of creating a separate refactor-only architecture
- preserve the existing layered shape before introducing a new abstraction
- for backend or shared-code refactors, copy the closest existing repo pattern first and use `agents/architecture.md` only when no clear local pattern exists
- keep touched route files at or below 100 lines when the landed change can reasonably do so
- treat touched non-route UI components above roughly 150 lines as a refactor signal
- treat touched backend or API files above roughly 250 lines, or files that grow by roughly 150+ lines during one request, as an extraction signal
- treat noticeable navigation lag in shared UI shells such as mobile sidebar, tabs, header, or overlay flows as a first-line refactor signal, not polish debt
- when a shared navigation control changes routes, do not couple modal teardown, overlay animation, and synchronous route replacement in one blocking interaction if a non-blocking navigation path is available
- for navigation-triggered screen entry, defer non-critical work that does not need to run in the same interaction tick as the route switch

## MCP And Runtime Preflight

Before broad exploration or edits, initialize the workflow in this order:

1. activate Serena for repo truth and read relevant Serena memories
2. fetch the selected Notion request page plus the affected system design pages
3. run `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
4. if the request is DB-relevant, use Prisma MCP before concluding the app is wrong
5. before runtime-sensitive verification, direct API checks, or Playwright work, run `tasks/integration-builder/integration-preflight.cmd -Mode runtime`

## Request Lifecycle

- `review` -> inspect repo truth, request intent, affected surfaces, and likely design-doc impact
- `plan` -> write an execution-complete plan into the request page before implementation begins
- `implement` -> land the code and required refactors
- `test` -> run the relevant checks and verification paths, then sync docs and close the request
- `blocked` -> a real blocker prevents safe continuation
- `done` -> request implementation, testing, and doc sync are complete

## Stop Conditions

Stop and report instead of continuing automatically when:

- the selected Notion request page cannot be found
- Notion is unavailable or the refactor container pages cannot be read or created
- required MCP parity fails in `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
- auth, role, or security behavior is ambiguous
- the request broadens into a product decision or multiple unrelated requests
- a required runtime surface remains unreachable after bounded local recovery
- verification fails and the root cause is not obvious after the allowed retry budget
- the request is hard-blocked and no safe continuation remains
