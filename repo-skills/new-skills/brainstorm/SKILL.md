---
name: brainstorm
description: "Use for FitTrack product and UI ideation when the user wants a feature or surface improvement but the shape is still fuzzy. Use it to expose holes, constraints, MVP cuts, and practical industry-standard options without exploding scope."
---

# FitTrack Brainstorm

Use this skill when the request is still vague, product-shaped, or clearly under-specified.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/output-shape.md`
  - the nearest touched route, screen, or domain summary when the request names a real surface
  - the `integration` skill when the idea is likely to move directly into implementation
- If the idea depends on outside product patterns, use Exa for targeted research instead of broad generic browsing.

## What this skill owns

- Problem framing
- Hidden holes and missing assumptions
- Constraints and tradeoffs
- MVP cuts and implementation-safe scoping
- Practical option generation
- Industry-standard pattern direction without overcomplicating

## What this skill does not own

- Full implementation planning
- Code changes
- FitTrack-specific coupling design once the idea is already clear
- Big speculative roadmaps

## Workflow

1. Restate the real user or product goal.
2. If a `premium-route-rebuild` packet exists, treat it as the route-level source of truth and narrow this skill to operator-first additions, route risks, and practical benchmark options instead of reopening the whole route audit.
3. If the request is a user-facing surface revision, start with a review verdict: `good_enough`, `needs_relayout`, `needs_component_replacement`, or `blocked_external`.
4. State the current surface tier, likely premium blockers, and the weakest major components first.
5. Run a missing-component opportunity scan before proposing polish:
   - what components are missing
   - what behaviors are missing
   - what navigation or drill-in behavior is missing
   - whether the default route mode is still weaker than a polished child mode or task view
   - whether the current table, list, filter, pagination, rail, or task-view pattern is still the right one
   - whether the table or list is carrying low-signal columns, repetitive row values, empty cells, or oversized chrome
6. For flagged premium surfaces, state the likely navigation experience gaps, header-compression needs, route risks, and data-rendering opportunities before suggesting animation.
7. Identify the holes in the current ask.
8. Name the most important constraints.
9. Generate 2 or 3 practical options. At least one option should be a genuine redesign or component-replacement option when the review verdict is not `good_enough`.
10. Recommend the strongest MVP path.
11. Separate immediate scope from later ideas.
12. Call out the failure modes that would make the feature bloated, generic, or low-value.

## Guardrails

- Prefer 2 or 3 strong options over a giant idea dump.
- Keep the MVP recommendation practical enough to hand to `system-adapt` or `integration`.
- Do not turn every feature into a mega-suite.
- Do not confuse "more features" with "better product direction."
- For UI-elevation asks, do not confuse premium feel with extra panels, more metrics, or louder decoration.
- For premium admin surfaces, prefer concise composition and lower copy density over explanatory clutter.
- For route-wide rebuilds, prefer operator-first additions over broad feature growth. New behaviors must improve lookup, triage, review, creation, navigation, or data usefulness.
- Prefer explicit `keep / replace / remove / add` recommendations over vague “improve” language when the current route is structurally weak.
- If the request is really a FitTrack-coupling problem, hand off to `system-adapt`.

## MCP routing

- Serena is required for local discovery.
- Exa is the default external research MCP when outside product or UX references would improve the answer.
- Figma is optional and only useful when the question is specifically about UI direction or surface quality.
- When a route-wide rebuild packet exists, treat Figma as the approved route-reference lane and use Exa to fill product-pattern gaps around missing operator behaviors.
- `Magic UI` is optional and only useful when motion language, hover states, or tasteful transition patterns need concrete inspiration after the structural direction is already clear.
- Context7 is usually unnecessary here unless the user asks for framework-specific implementation considerations.

## Output defaults

- Return:
  - `Goal`
  - `Review verdict`
  - `Hidden holes`
  - `Constraints`
  - `Options`
  - `Recommended MVP`
  - `Later ideas`
  - `Risks to avoid`
- For surface-elevation work, also include:
  - `Operator-first additions`
  - `Keep / Replace / Remove / Add suggestions`
  - `Current tier`
  - `Target tier`
  - `Figma lane status`
  - `Missing component opportunities`
  - `Weak components`
  - `Component replacement candidates`
  - `Premium blockers`
  - `Reference lane`
  - `Major component scan`
  - `Reference targets by component`
  - `Copy-density cuts`
  - `Header compression needs`
  - `Navigation experience gaps`
  - `Data rendering opportunities`
  - `Route risks`
  - `Untouched surface risks`
  - `Visual delta risk`
  - `Redesign recommendation`
- Keep the answer compact, practical, and ready for the next skill.
