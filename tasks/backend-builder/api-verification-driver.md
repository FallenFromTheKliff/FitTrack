# API Verification Driver

Use this file for live API verification after code checks pass. It may start the backend automatically when the session variables below allow it.

Tell Codex:

```text
Read tasks/api-verification-driver.md and follow it using the current variables in the file.
```

---

## Session Variables

Edit these values before starting the API verification chat:

- `DOMAIN_FOLDER:` `tasks/s17-business-analytics`
- `DOMAIN_CODE:` `S17`
- `DOMAIN_NAME:` `Business Analytics`
- `DOMAIN_CONTEXT_FILE:` `context/python/s17-business-analytics.md`
- `CURRENT_TASK_FILE:` `tasks/s17-business-analytics/active/TASK-1706-s17-runtime-api-verification.md`
- `APP_BASE_URL:` `http://localhost:3000`
- `OPENAPI_URL:` `http://localhost:3000/v1/docs-json`
- `BACKEND_WORKDIR:` `capstone-backend`
- `BACKEND_START_COMMAND:` `npm.cmd run start`
- `BACKEND_FALLBACK_START_COMMAND:` `npm.cmd run start:dev`
- `AUTO_START_BACKEND:` `yes`
- `STARTUP_WAIT_SECONDS:` `25`
- `API_VERIFICATION_SCOPE:` `S17 business-analytics routes: POST /v1/business-analytics/insights, GET /v1/business-analytics/insights, GET /v1/business-analytics/insights/{id}`
- `REQUIRED_CHECKS_PASSED:`
  - `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/analytics/analytics.service.spec.ts src/ai/ai-python-client.service.spec.ts`
  - `uv run pytest tests/test_business_insights_api.py tests/test_business_insights_service.py`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `MODULE_HINTS:`
  - `capstone-backend/src/analytics`
  - `capstone-backend/src/app.module.ts`
  - `capstone-backend/test`
  - `ai-microservice/app`
### Variable Rules

- `CURRENT_TASK_FILE` may be `none` for domain-level API verification or point to a real task file for task-level verification
- `APP_BASE_URL` must point to the backend that should be verified
- `OPENAPI_URL` must point to the OpenAPI JSON endpoint exposed by that backend
- `BACKEND_WORKDIR` must point to the repo directory where the backend start command should run
- `BACKEND_START_COMMAND` should be the exact local command used to boot the backend for Swagger verification, and when auto-start is needed it is interpreted as the inline verification-time server command
- `BACKEND_FALLBACK_START_COMMAND` is optional and may be `none`; when it is set and the primary start command still does not make `OPENAPI_URL` reachable, stop the primary process cleanly, capture logs, and retry with the fallback command
- for unattended verification runs, use the stable non-watch boot command `npm.cmd run start` after build passes
- for this repo, use `npm.cmd run start:dev` as the default fallback only after the stable primary boot command fails to make the endpoint reachable
- `AUTO_START_BACKEND` may be `yes` or `no`
- `AUTO_START_BACKEND: yes` means this driver may keep the backend process alive for the full Swagger pass when inline startup is needed
- `STARTUP_WAIT_SECONDS` should be long enough for NestJS plus local dependencies to come up
- `API_VERIFICATION_SCOPE` should be narrow and name the endpoints or controllers that matter for this pass
- `REQUIRED_CHECKS_PASSED` must reflect checks that have already succeeded before this driver is used

---

## Purpose

This driver verifies the live API surface after the coding loop is finished.

It must:

1. start or confirm the backend when allowed by the session variables
2. inspect the live OpenAPI surface with Swagger MCP
3. compare the live API contract against the task, domain context, and current code
4. report pass/fail findings and follow-up work
5. stop

It must not:

- implement code changes
- replace the normal `review -> plan -> implement -> test` task loop
- skip the required code checks before attempting live verification

---

## Preconditions

Before using this driver, confirm:

- the selected task or domain already completed the normal code workflow
- `npm.cmd run build` passed
- relevant tests passed
- `npm.cmd run lint:check` passed
- if the selected task or queue note requires a local Prisma migration baseline, confirm that first and auto-apply checked-in local migrations only when the shared domain driver explicitly enables that behavior
- either the backend is already running at `APP_BASE_URL` or `AUTO_START_BACKEND = yes` with a valid local start command
- the OpenAPI JSON is reachable at `OPENAPI_URL` after any allowed startup attempt

If any precondition is missing, stop and report that first.

---

## Driver Instructions

### Always Read First

In every API verification pass, read:

1. `agents/guardrails.md`
2. `agents/architecture.md`
3. `context/00-global-contracts.md`
4. the file in `DOMAIN_CONTEXT_FILE`
5. this file: `tasks/api-verification-driver.md`
6. `[DOMAIN_FOLDER]/README.md`
7. `[DOMAIN_FOLDER]/execution.md`
8. `[DOMAIN_FOLDER]/decisions.md`
9. `CURRENT_TASK_FILE`, if one is set

Also inspect:

- the modules listed in `MODULE_HINTS`
- changed controllers, DTOs, and specs relevant to `API_VERIFICATION_SCOPE`

### MCP Usage Rules

- Swagger MCP is required in this driver.
- Serena is preferred for mapping live endpoints back to the owning files and symbols.
- `prismaLocal` is optional and should be used when the verification needs DB-aware context or the selected task requires local migration-baseline confirmation before the live pass.
- `prismaRemote` is optional and should be used only for explicit remote Prisma context.
- Context7 is optional and should be used only if current Swagger or framework behavior is unclear.
- GitHub and Notion are usually unnecessary here; use them only if the verification depends on an external source of truth that is not in the repo.
- Shell use is explicitly allowed here for backend startup, OpenAPI reachability checks, and process cleanup.
- If sandbox or host-process restrictions prevent the live backend from staying reachable, request escalated execution instead of immediately turning that into a permanent environment blocker.
- during unattended runs, print short terminal updates for the primary start command, fallback start command, endpoint polling, and backend cleanup so the operator can confirm the supervised runtime loop
- End the report with `MCPs used: ...`

### Verification Flow

1. verify that `OPENAPI_URL` is reachable
   - if it is not reachable and `AUTO_START_BACKEND = yes`, start the backend from `BACKEND_WORKDIR` using `BACKEND_START_COMMAND` inline, keep that process alive for the full verification pass, wait up to `STARTUP_WAIT_SECONDS`, then retry
   - if a stale local server is clearly serving old code, the agent may restart it before retrying the OpenAPI check
   - detached or background startup is opportunistic only; if it fails but inline startup works, continue the Swagger pass instead of treating detached failure as the blocker
   - it is acceptable and preferred in this repo to start the backend inline for the duration of the verification pass, run the endpoint checks, then stop it at the end of that same command
   - if the primary inline start command still does not make `OPENAPI_URL` reachable and `BACKEND_FALLBACK_START_COMMAND` is not `none`, stop the primary process cleanly, capture its startup logs, then retry once with `BACKEND_FALLBACK_START_COMMAND`
   - keep the active inline backend process alive for the Swagger pass, then stop it cleanly after the pass finishes or fails
   - if the selected task or queue note says live verification is blocked only by checked-in local Prisma migrations and the shared domain driver enables `PRISMA_LOCAL_GUARD_MIGRATIONS = auto_apply_checked_in`, use Prisma Local MCP to inspect status and then run `npx.cmd prisma migrate deploy` before the Swagger pass
   - do not use `prisma migrate dev` for this checked-in-only guard-migration path
   - if inline startup or reachability checks are blocked by sandbox or host-process restrictions, request escalated execution and retry before recording an environment blocker
2. inspect the live endpoints in `API_VERIFICATION_SCOPE` with Swagger MCP
3. compare the live contract against:
   - the selected task file, if present
   - the domain context file
   - the current controller and DTO code
   - auth and response-envelope expectations from `context/00-global-contracts.md`
4. report:
   - endpoints checked
   - contract mismatches
   - auth or response-shape mismatches
   - missing or extra parameters
   - follow-up task recommendations if fixes are needed
5. stop after reporting

Autonomous retry rule:

- if this driver is being run from `AUTO_MODE = task`, `AUTO_MODE = domain`, or `AUTO_MODE = sleep` and it reveals a fixable implementation mismatch, do not leave the domain permanently blocked on the first failure
- instead, route back to the same domain by creating or updating a same-domain follow-up task, fix it through the normal task loop, then rerun this driver within the shared `MAX_SELF_HEAL_ATTEMPTS_PER_TASK` budget from `tasks/domain-agent-driver.md`
- if this driver is being run from `AUTO_MODE = off`, report the findings clearly and stop; do not auto-fix or auto-retry without the operator starting the next run

---

## Output Style

Use a findings-first report.

If everything matches, say that explicitly and list the endpoints checked.

Always end with:

```text
MCPs used: ...
```

---

## Stop Conditions

Stop and report instead of continuing when:

- the backend is not running and `AUTO_START_BACKEND = no`
- `OPENAPI_URL` is still not reachable after the allowed primary inline startup attempt, any configured fallback startup attempt, and any needed escalation retry
- the required code checks were not completed first
- the target task or endpoint scope is unclear
- the live API reveals a mismatch that needs implementation work

When implementation work is required in an autonomous mode, route back to the normal same-domain task workflow instead of fixing code inside this driver. In `AUTO_MODE = off`, report the findings and stop.
