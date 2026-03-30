# How to Use These Agents - Codex in VS Code

You are using Codex with direct access to this repo. It can read files on its own.

---

## Folder Structure

```text
CapstoneBackend/
|- agents/
|- context/
|- tasks/
`- capstone-backend/
   |- src/
   |- prisma/
   `- test/
```

Do not use old `ai/...` paths. Use the real top-level folders shown above.

---

## Agent Roles

| Agent | When to Use |
|-------|-------------|
| Reviewer | Audit existing code against the system design |
| Planner | Produce an implementation plan before coding |
| Coder | Implement the agreed change |
| Tester | Add or verify tests for the change |

---

## Start of Session Prompt

Most sessions should begin with:

```text
Read agents/guardrails.md
Read agents/architecture.md
Read context/00-global-contracts.md
Read context/s[N]-[domain].md
Use Serena for repo navigation and symbol lookup.
Use Prisma MCP when the task touches schema, repositories, query behavior, or DB invariants.
Use Context7 only when current framework or package docs are needed.
Do not use Swagger MCP unless I am running tasks/api-verification-driver.md and the backend is already running.
End each phase report with `MCPs used: ...`.
```

---

## MCP Workflow Defaults

- Serena is the default MCP for codebase navigation and existing-pattern lookup.
- Prisma MCP is the default database-aware tool for review, planning, implementation, and verification when a task is DB-backed.
- Context7 is optional and should be used only when current library or framework guidance is needed.
- Swagger MCP is reserved for the separate runtime verification flow in `tasks/api-verification-driver.md`.
- `agents/architecture.md` is authoritative by default; if a task proves a new reusable convention, update that doc explicitly instead of treating code drift as the new rule.

---

## Review Existing Code

```text
Read agents/guardrails.md
Read agents/architecture.md
Read agents/reviewer.md
Read context/00-global-contracts.md
Read context/s[N]-[domain].md

Scan every file in capstone-backend/src/[module]/
Compare the implementation against the design.
Do NOT fix anything yet - only report.
```

Example:
- S3 currently lives in `capstone-backend/src/user/`, not `src/users/`

---

## Plan a New Feature or Refactor

```text
Read agents/guardrails.md
Read agents/architecture.md
Read agents/planner.md
Read context/00-global-contracts.md
Read context/s[N]-[domain].md

Scan capstone-backend/src/[module]/ and summarize what already exists.

I want to implement: [plain-English feature]

Produce the PLANNER OUTPUT.
```

---

## Implement a Planned Change

```text
Read agents/guardrails.md
Read agents/architecture.md
Read agents/coder.md
Read context/00-global-contracts.md
Read context/s[N]-[domain].md
Read tasks/active/[task-file].md

Implement the planned change.
If the task is broad or risky, list files first.
If shared/common support is required, include it.
```

---

## Check or Add Tests

```text
Read agents/guardrails.md
Read agents/architecture.md
Read agents/tester.md
Read capstone-backend/src/[module]/[module].service.ts
Read capstone-backend/src/[module]/[module].service.spec.ts

List the main logic paths.
Add or verify the missing tests.
Run build and relevant tests.
Report the results.
```

DTO- and validator-heavy tasks may also need:
- `capstone-backend/src/common/validators/*.spec.ts`
- `capstone-backend/src/[module]/dto/*.spec.ts`

---

## Useful Verification Commands

Use the real commands already working in this repo:

```text
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run lint:check
```

---

## Runtime API Verification

Use Swagger MCP only in a separate runtime verification prompt after the backend is already running.

```text
Read tasks/api-verification-driver.md and follow it.
Use the current variables in the file.
```

---

## Workflow Notes

- Review before large changes.
- Plan before new features or bigger refactors.
- Code after the plan is clear.
- Test after implementation, or as part of implementation when the task is test-driven.
- Commit manually after reviewing the diff.
