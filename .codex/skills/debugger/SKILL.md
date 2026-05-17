---
name: debugger
description: "Use for tricky bugs, failed builds or tests, runtime errors, stuck fix loops, CI/local mismatches, flaky failures, and repeated failed fixes where Codex needs a bounded, evidence-first debugging protocol before editing."
---

# Debugger

Use this skill to keep debugging bounded, empirical, and honest. The goal is not to patch quickly; it is to preserve a stable failure signal, learn from each run, and stop before guesswork compounds the bug.

## Core Rule

Do not edit before the failure is defined. First capture:

- The exact command, URL, user flow, CI job, or runtime action that fails.
- The failing log excerpt needed to see the first fatal error without hiding preceding context.
- The first fatal error, including file, line, stack frame, status code, or failing assertion.
- The expected behavior and the observed behavior.
- Whether the failure is local-only, CI-only, browser-only, container-only, data-dependent, time-dependent, or intermittent.

If the user only provides a summary, ask for the missing command or log when necessary. If enough context exists to run the failing gate directly, run it and capture the first fatal error yourself.

## Bounded Loop

Run this loop in order:

1. Define the failure in one sentence.
2. Reproduce it with the exact command or flow, or classify it as non-reproducible with the attempted command, environment, and observed result.
3. Reduce or isolate the surface: smallest test, route, component, module, query, container, commit range, or input that still fails.
4. Form ranked hypotheses, with the most likely first and a specific prediction for each.
5. Run one experiment for the top hypothesis. Prefer reads, logs, targeted tests, browser traces, type inspection, DB/API checks, or config comparison before editing.
6. Apply one minimal patch only after evidence supports a cause.
7. Rerun the same failing gate first. Do not switch gates until the original signal is closed or explicitly reclassified.
8. Add a regression guard where reasonable: a targeted unit/integration/e2e test, fixture, schema contract, type assertion, lint rule, or runtime check.
9. Close with the root cause, patch summary, verification result, residual risk, and any guard added or deliberately skipped.

## Attempt Budget

- Allow at most 3 root-cause attempts unless the user explicitly extends the budget.
- Count an attempt when you form a cause hypothesis and either patch for it or run a diagnostic intended to prove it.
- After each failed attempt, record: hypothesis, experiment or patch, result, and what changed in the evidence.
- Stop after two unrelated new errors appear. Summarize the new errors and ask whether to debug the original failure or pivot.
- Stop immediately if the reproduction signal changes in kind. Restate the new failure before any further edit.

## Anti-Loop Rules

- Never keep editing after the failing command, failing assertion, stack trace, route, status code, or visible symptom changes without restating the new failure.
- Never hide errors with ignore flags, broad dependency updates, disabled tests, skipped assertions, silenced TypeScript/build/lint errors, swallowed exceptions, or relaxed validation unless the user explicitly approves that tradeoff.
- Never treat "passes once" as closure for a flaky failure. Repeat the narrow gate or use retry/trace evidence to prove stability.
- Never use a broad refactor to solve an unisolated bug.
- Never chase later log noise before the first fatal error unless the first fatal error is demonstrably a cascade.
- Never upgrade or reinstall dependencies as a first fix unless the evidence points to a known version defect or corrupted install.
- Never delete fixtures, snapshots, migrations, or tests to make a gate green without explicit approval.

## Evidence Ladder

Prefer the lowest-cost evidence that can falsify a hypothesis:

- Static evidence: types, imports, config, generated files, schema, environment variables, lockfile, route registration.
- Local targeted gate: single test, package build, lint/typecheck subset, API request, migration check.
- Runtime evidence: logs with timestamps, stack traces, browser console, network tab, container logs, process list, DB row truth.
- Browser evidence: use Browser DevTools or Playwright traces for UI/runtime bugs; capture console, network, DOM state, viewport, and the exact action before the failure.
- CI/deploy evidence: compare command, OS, Node/package manager version, env vars, build mode, cache, container image, generated artifacts, and service readiness.

## Non-Reproducible Failures

When the failure does not reproduce:

- State the exact reproduction attempt and result.
- Compare local and failing environment facts before editing.
- Prefer adding observability, stricter assertions, trace capture, or a narrow diagnostic guard.
- For flaky tests, run the narrow test repeatedly only when it is cheap and bounded; otherwise collect trace, seed, order, timing, worker, and retry artifacts.
- Do not patch on vibes. Patch only if a specific mismatch is found.

## Patch Discipline

- Keep the first patch as small as possible and tied to the leading hypothesis.
- Preserve unrelated work in the tree. Read touched files before editing and do not revert other people's changes.
- If the patch touches a shared contract, verify at least one adjacent consumer.
- If a regression guard is too expensive or inappropriate, say why in the final note.

## Reference Taxonomy

Load [references/bug-taxonomy.md](references/bug-taxonomy.md) when the bug matches one of these families:

- Next.js build or type errors
- flaky tests
- async, race, or state bugs
- browser/runtime bugs
- deployment or container failures
- schema/API drift
- rogue process or port issues
