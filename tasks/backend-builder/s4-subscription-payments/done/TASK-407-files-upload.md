# TASK-407 - Files Upload
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-407-files-upload
**Created:** 2026-03-22
**Completed:** 2026-03-24
**Auto-Eligible:** no
**Stop If:** storage adapter choice or upload contract details still require product or infrastructure decisions
**Escalation Notes:** do not auto-run this task until the shared upload and storage direction is explicitly settled

---

## What
Implement the shared file-upload endpoint required by manual payment screenshots and future avatar or media flows.

## Why
S4 manual payments depend on a real upload contract, and other domains will reuse the same file service later.

## Acceptance Criteria
- [x] Implement `POST /v1/files/upload` for authenticated users.
- [x] Accept only `image/jpeg` and `image/png` with a 5 MB max size.
- [x] Return `{ url: string }` in the project response envelope pattern.
- [x] Store files through the project-approved storage abstraction for Cloudflare R2.
- [x] Keep controllers thin and isolate storage logic in a service.
- [x] Replace or clearly deprecate the current avatar upload stub if it conflicts with the new shared upload contract.
- [x] Add unit tests for upload validation rules and service behavior where practical.
- [x] Unit tests pass (`npm run test src/[module]`)
- [x] Lint passes (`npm run lint`)
- [x] No `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s4-subscription-payments.md`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - STOP, split into 2 tasks first

---

## PLANNER OUTPUT
- This task is technically shared infrastructure, but S4 has the clearest immediate dependency on it.
- Avoid coupling upload storage details directly to membership or payment modules.
- If R2 config or SDK scaffolding is larger than expected, split storage adapter setup from endpoint wiring.

---

## CODER OUTPUT
Implemented the shared upload infrastructure in `src/files/`:
- added `FilesModule`, `FilesController`, `FilesService`, and `R2StorageService`
- added shared file types/constants plus focused specs for service and R2 adapter behavior
- added `r2` config registration and wired the module into `AppModule` and Swagger

Behavior implemented:
- `POST /v1/files/upload` now accepts authenticated multipart uploads
- upload validation is enforced in `FilesService` for `image/jpeg`, `image/png`, and 5 MB max size
- uploads go through a dedicated storage adapter seam with an R2-backed implementation
- the avatar upload stub in `UserController`/`UserService` now uses the shared files service instead of echoing `file.originalname`
- the avatar route is marked as a deprecated convenience path so new clients can prefer `POST /v1/files/upload`

---

## TESTER REPORT
Verification run on 2026-03-24.

Checks:
- `npm.cmd run build` - passed
- `npm.cmd test -- files --runInBand` - passed (`2` suites, `7` tests)
- `npm.cmd test -- user.service --runInBand` - passed (`1` suite, `9` tests)
- `npm.cmd test -- auth --runInBand` - passed (`4` suites, `26` tests)
- `npm.cmd test -- base-repository --runInBand` - passed (`1` suite, `3` tests)
- `npm.cmd run lint` - passed

Notes:
- the repo-wide lint blocker was cleared by tightening existing auth/common specs that were outside the files module but on the verification path
- no active TASK-407 blockers remain
