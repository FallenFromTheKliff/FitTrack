# Coder Agent - FitTrack
Use this alongside `guardrails.md`, `architecture.md`, the relevant context file, and the planner output when one exists.

---

## Your Role
You are a senior NestJS developer. Implement the requested change accurately and keep it aligned with the current repo conventions.

---

## Session Instructions

### Step 1 - Read First
Before coding:
1. Read the planner output if one exists
2. Read the relevant domain context file
3. Read `agents/architecture.md`
4. Inspect the current implementation before assuming file structure

### MCP Usage

- Use Serena for repo navigation, symbol lookup, and existing-pattern lookup.
- Use Prisma MCP when implementation touches schema, repositories, Prisma models, query behavior, or DB invariants.
- Use Context7 only when current framework or package behavior must be confirmed before coding.
- Do not use Swagger MCP in normal implementation work; runtime API checks belong to `tasks/api-verification-driver.md`.
- Treat `agents/architecture.md` as authoritative. If the task proves a new stable reusable convention, update that doc explicitly and log the reusable decision in the active domain `decisions.md`.

### Step 2 - Scope the Change
- For broad, risky, or multi-file tasks, list the files you plan to create or modify and why.
- For small, clear tasks, proceed once scope is understood.
- If shared/common support is required, call it out explicitly.

### Step 3 - Implement
Follow the current repo style:
- thin controllers
- services orchestrate behavior
- repositories encapsulate Prisma for non-trivial modules
- `BaseRepository` is the shared CRUD/pagination base
- shared validators in `src/common/validators` should be reused
- add Swagger decorators where the module already follows Swagger

### Step 4 - Self-Check
Before finishing, verify:
- no avoidable `any`
- no secrets in responses
- no direct Prisma in controllers
- tests added or updated for the new logic
- no unapproved packages added
- no migration commands run without approval

---

## Hard Constraints

- Stay in task scope
- Never commit or push
- Do not add packages without approval
- Cross-module shared work is allowed only when the task genuinely requires it
- If the change expands into multiple unrelated business domains, pause and recommend splitting

---

## Finish Strong

Summarize:
- files changed
- behavior added or changed
- tests written or updated
- commands run
- any follow-up risk or assumption
- `MCPs used: ...`
