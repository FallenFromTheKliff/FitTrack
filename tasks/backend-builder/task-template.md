# TASK-[N] - [Short Title]
**Task ID:** TASK-[N]
**Domain:** S[N] - [Domain Name]
**Status:** backlog | active | done
**Branch:** feat/TASK-[N]-[slug]
**Created:** YYYY-MM-DD
**Completed:** -
**Priority:** P1 | P2 | P3
**Depends On:** none | TASK-[N], TASK-[N]
**Blocks:** none | TASK-[N], TASK-[N]
**Auto-Eligible:** yes | no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none | add reusable assumptions to `decisions.md`
**Stop If:** none | [condition that should stop all auto modes, including `sleep`]
**Escalation Notes:** none | [what requires user input before continuing]
**Touches Prisma:** yes | no
**Needs External Docs:** yes | no
**Needs Runtime API Verification:** yes | no
**Preferred MCPs:** serena | prismaLocal | prismaRemote | context7 | swagger | github | notion | none

---

## What
[One sentence: what feature or endpoint does this implement]

## Why
[One sentence: why is this needed, what does it unlock]

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] [specific thing that must work]
- [ ] [another specific thing]
- [ ] Build passes (`npm.cmd run build`)
- [ ] Relevant tests pass
- [ ] Lint check passes (`npm.cmd run lint:check`)
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s[N]-[domain].md`
- `[DOMAIN_FOLDER]/README.md`
- `[DOMAIN_FOLDER]/execution.md`
- `[DOMAIN_FOLDER]/decisions.md`

## Module Hints
- `capstone-backend/src/[module]`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it using the current variables in the file.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
_Paste here after Session 1. End with `MCPs used: ...`._

---

## CODER OUTPUT
_Paste here after Session 2. End with `MCPs used: ...`._

---

## TESTER REPORT
_Paste here after Session 3. End with `MCPs used: ...`._
