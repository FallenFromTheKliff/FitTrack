# Domain Integration Driver Agent v2.0
## Purpose
Execute integration work linearly by journey slice using repo truth from Serena, reporting state in Notion, and validating runtime behavior against the deployment-oriented Docker stack.

## Current Runtime Contract
- `apps/api` is the current backend API
- `apps/ai-microservice` is the AI service dependency
- `apps/web` is the admin and staff platform
- `apps/mobile` is the member platform
- `packages/types`, `packages/api-client`, `packages/query`, and `packages/validators` are part of the integration surface

## Hard Role Separation
- Web accepts `ADMIN` and `STAFF` only
- Mobile accepts `USER` and member only
- Admin and staff login on mobile is a negative-path verification case
- Member login on web admin is a negative-path verification case
- Any successful cross-platform login is a blocker

## MCPs Used
- Serena MCP: scan and modify repo truth
- Notion MCP: task page reads and status writes
- Prisma Local MCP: migration status and schema validation when backend changes touch Prisma
- Swagger MCP: optional runtime contract pull from `/v1/docs`
- Playwright MCP: use if available
- Playwright CLI: default fallback when Playwright MCP is unavailable

## Notion Inputs And Outputs
### Reads
- `Runtime Map`
- `External Config Registry`
- `Domain Registry`
- `Domain - <domain>`
- `Task - <domain> - <journey>`

### Writes
- task status
- blocker status
- gap findings
- chosen fix
- verification results
- docker and runtime failures

## Execution Unit
The execution unit is always a journey slice page:
- `Task - <domain> - <journey>`

Every task page must have:
- repo surfaces involved
- FE web impact
- FE mobile impact
- backend/API impact
- AI dependency impact
- shared package impact
- infra and deploy dependency impact
- gap findings
- chosen fix
- verification status

## Default Journey Order
1. `Task - auth - admin-web-login`
2. `Task - auth - member-mobile-login`
3. `Task - auth - member-registration-and-otp`
4. `Task - auth - password-reset-and-lockout`
5. `Task - user - profile-and-session-persistence`
6. `Task - bookings - booking-and-coaching`
7. `Task - notifications - queue-backed-delivery`
8. `Task - analytics - ai-business-insights`

## Fixed Per-Slice Loop
1. Serena scan and compare repo truth
2. Read and update the Notion task page
3. Install or refresh dependencies if the slice changes dependency surfaces
4. Rebuild affected containers if Docker inputs changed
5. Run Docker health checks
6. Run direct API contract verification
7. Run web and mobile verification
8. Log pass, fail, or blocker in Notion

## Dependency Installation Rules
### Backend Node Modules
Before running API build or runtime checks, verify API dependencies are installed:

```bash
pnpm install
pnpm install --filter @fittrack/api...
```

Use the filtered install when only the API workspace needs to be refreshed.

### Python Dependencies
If the AI microservice files or lockfile changed, refresh its environment before runtime verification:

```bash
cd apps/ai-microservice
uv sync --frozen
```

## Docker Orchestration Rules
### Canonical Stack
Use the root `docker-compose.yml` as the canonical deployment and integration stack.

Long-running services:
- `db`
- `redis`
- `api`
- `ai-microservice`
- `web`
- `prometheus`
- `grafana`

One-off services:
- `migrate`
- `init`

### Pre-Test Health Check
Before any slice verification:

```bash
docker compose ps
docker compose ps --format json
```

Confirm:
- required services are running
- health checks are passing
- the current slice has all dependencies available from the `Runtime Map`

### Rebuild Triggers
Rebuild affected services before verification if the slice touched:
- `package.json`
- `pnpm-lock.yaml`
- `pyproject.toml`
- `uv.lock`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `.env.docker.example`
- `apps/api/prisma/schema.prisma`
- Prometheus or Grafana provisioning files

Example rebuilds:

```bash
docker compose up -d --build api
docker compose up -d --build ai-microservice
docker compose up -d --build web
```

### Runtime Failure Handling
If a required service fails health checks:
1. capture `docker compose logs <service> --tail=100`
2. write the blocker to the Notion task page
3. mark `verification status = blocked`
4. do not continue to the next verification step for that slice

## Verification Rules
### API Contract Verification
Use direct API checks first.

Minimum checks:
- API health at `/health`
- API docs at `/v1/docs`
- direct endpoint behavior for the slice
- error-path behavior for the slice
- role-boundary behavior for the slice

Swagger MCP can be used after the API is live. If unavailable, use the checked-in DTOs and controllers as the contract source.

### Web Admin Verification
Target:
- `apps/web`
- `ADMIN` and `STAFF` only

Verify:
- happy path for admin or staff
- denial path for member credentials
- protected-route redirect behavior
- shared client and query contract alignment

### Mobile Member Verification
Target:
- `apps/mobile`
- `USER` and member only

Verify:
- happy path for member
- denial path for admin and staff credentials
- protected-route redirect behavior
- shared client and query contract alignment

If native verification is not available, use Expo web or log manual QA as an explicit follow-up. Do not silently skip the platform.

### Playwright Policy
- Prefer Playwright MCP if available in-session
- Otherwise run Playwright CLI without blocking the slice
- Mobile native is not part of the deployment compose stack

## Slice Completion Rule
A slice is complete only when:
- Notion task page is updated
- required dependencies are installed
- Docker services are healthy
- API contract checks pass
- web and mobile checks pass or are explicitly blocked with evidence
- role separation is verified
- blockers, if any, are recorded with logs and next action
