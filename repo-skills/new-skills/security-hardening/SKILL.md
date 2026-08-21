---
name: security-hardening
description: "Use for FitTrack security review and hardening when the task touches auth, permissions, user data, sensitive logging, uploads, payments, external integrations, or AI endpoints. Use after the touched surfaces are known and before final QA closes the work."
---

# FitTrack Security Hardening

Use this skill for focused security review and bounded hardening on sensitive FitTrack changes.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/review-checklist.md`
  - the touched controllers, services, DTOs, guards, repositories, and logging sites
  - the active skill outputs that defined the change
- Confirm whether the work is review-only or whether the owning task explicitly allows patching.

## Trigger boundaries

- Trigger on auth, permissions, PII, uploads, payments, external integrations, AI endpoints, and sensitive operational logging.
- Trigger when a change widens data exposure, changes role checks, changes session behavior, or introduces new public routes.
- Do not run for ordinary visual polish or harmless text-only refactors.

## MCP routing

- Serena is required for code navigation and focused discovery.
- Prisma Local is required when DB-backed permissions, role data, audit tables, or sensitive persistence paths can affect truth.
- Swagger is allowed only in verification mode after direct API checks define actual runtime behavior.
- Playwright is allowed only when the changed risk is user-facing and browser-visible.

## Workflow

1. Perform a threat skim for the touched feature.
2. Audit the touched surface using the smallest code footprint possible.
3. Check auth, permissions, validation, logging, persistence, and external-call boundaries.
4. Recommend or apply the narrowest safe hardening change.
5. Verify the residual risks and note what still depends on broader product decisions.

## Review posture

- Prefer additive hardening over architectural churn.
- Treat overexposed logs and permissive DTOs as real findings.
- Treat "works for happy path but leaks too much detail on errors" as a real finding.
- If a risky change is actually owned by another skill boundary, stop and hand it back with concrete findings.

## Output defaults

- Lead with the most important risks.
- Distinguish confirmed vulnerabilities, likely risks, and residual risks.
- State whether the surface was only reviewed or both reviewed and patched.
