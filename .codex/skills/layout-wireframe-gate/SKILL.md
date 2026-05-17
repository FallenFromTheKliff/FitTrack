---
name: layout-wireframe-gate
description: "Use for FitTrack professional layout approval before implementation: subjective layout tweaks, modal or page composition changes, professional layout revisions, responsiveness redesigns, batched route layout approval, route shell or modal architecture replacement, awkward-looking UI risk, or when the user asks to preview or approve layout before code."
---

# FitTrack Layout Wireframe Gate

Gate subjective FitTrack layout work with the cheapest approval artifact that is honest for the risk. The goal is to make route composition, density, hierarchy, responsiveness, and overlay ownership clear enough for user approval without generating HTML for every tweak.

## Hard Rule

Do not implement subjective UI relayout until the user approves the chosen layout direction.

For UI-heavy work, layout approval is the high-priority first gate. Run this gate before integration, schema, or backend changes unless the layout cannot be evaluated without a minimal contract discovery pass.

Stop for confirmation before:

- subjective relayout work
- major route or modal composition changes
- replacing a page shell, modal architecture, drawer pattern, sidebar pattern, or route-level information architecture
- broad responsiveness redesign
- batched layout approval across routes

## Approval Ladder

Choose the lowest-token artifact that can prevent an awkward or broken layout.

- `low`: tiny component spacing, copy, color, icon, or state tweak.
  - Artifact: none.
  - Action: implement directly, then verify visually when useful.
- `medium`: section order, toolbar grouping, card/table/list anatomy, filter placement, or modal content layout.
  - Artifact: `Layout Delta Packet`.
  - Action: stop for approval only when the change is subjective or likely to alter user workflow.
- `high`: responsive recomposition, overlay ownership change, page density shift, primary/secondary region swap, or a layout that has looked awkward in past attempts.
  - Artifact: current screenshot when available plus an annotated text plan or ASCII sketch.
  - Action: stop for approval before code.
- `major`: route shell replacement, modal/drawer architecture replacement, page information architecture rewrite, batched route layout approval, or explicit user request for a preview file.
  - Artifact: temporary static HTML, max one file for one surface or two files for a batch.
  - Action: stop for approval before code.

Use HTML only for `major` risk or when the user explicitly asks for an HTML preview. Prefer a packet or screenshot-backed plan for ordinary layout tweaks.

## Workflow

1. Define the surface:
   - route or modal name
   - primary operator job
   - states that must be represented
   - current FitTrack shell, tokens, and reusable primitives that should remain recognizable
2. Read `references/layout-approval-rules.md` before creating the approval packet.
3. Use current FitTrack intent and implementation as the first source of truth. Inspect only the route shell, nearby primitives, tokens, and sibling surfaces needed to preserve product fit.
4. Classify the layout risk as `low`, `medium`, `high`, or `major` using the approval ladder.
5. If current external references are needed, use Exa MCP narrowly. Prefer:
   - shadcn/ui dashboard, sidebar, and data-table structures
   - Radix accessibility and interaction behavior
   - Attio or Linear style admin density and scanning patterns
   Magic UI is allowed only after structure is approved and only for component or motion inspiration.
6. For `low` risk, implement directly through the owning frontend skill and verify the changed surface.
7. For `medium` risk, return a `Layout Delta Packet` and ask for approval only when the change is subjective, workflow-visible, or user-requested.
8. For `high` risk, capture or reference the current route state when available, then return an annotated plan or ASCII sketch and stop for approval.
9. For `major` risk, create temporary static HTML wireframes only for a real task under `.artifacts/layout-wireframes/<timestamp>/`:
   - default folder: `.artifacts/layout-wireframes/<timestamp>/`
   - timestamp format: `YYYYMMDD-HHMMSS`
   - one HTML file for one page or modal
   - at most two HTML files for a batched request
10. Copy and adapt `assets/wireframe-template.html` into the temporary folder. Never edit or delete the asset template during task execution.
11. Keep HTML wireframes static, dependency-free, and low-fidelity enough to focus on layout decisions. Plain HTML and CSS only. No app code, build tooling, external fonts, external CSS, external JS, screenshots as source, or production component imports.
12. After generating HTML, stop immediately and notify the user with the exact directory and HTML file path or paths. Use clear wording like: `Layout wireframe is ready for review: <absolute or repo-relative path>. Review the HTML in this directory. No implementation will start until approved.`
13. Ask for approval with a concise recommendation:
   - approve as-is
   - approve with small changes
   - revise before implementation
14. If the user requests changes, revise the approval artifact only and ask again.
15. After approval, implement using the relevant FitTrack frontend skills and repo patterns. Preserve the approved composition unless a code constraint forces a deviation, then call out the deviation before proceeding.
16. After approved implementation and verification, delete any temporary generated HTML folder unless the user asks to keep it. Never delete `assets/wireframe-template.html`.

## Layout Delta Packet

Use this for `medium` risk instead of HTML:

- `Surface`
- `Risk`: `medium`
- `Current layout`
- `Proposed layout`
- `What changes visually`
- `What stays the same`
- `Desktop behavior`
- `Mobile behavior`
- `Overlay or scroll ownership`
- `Risk of awkwardness`
- `Approval needed`: `yes` or `no`

Keep it concrete and short. Use product language, not design-process language.

## ASCII Sketch

Use this for `high` risk when a screenshot plus prose is enough:

```text
[Command header: title / context / primary action]
[Toolbar: search | filters | view switch | bulk actions]
[Primary content: table/list/card grid]
[Inspector/drawer/modal: opens on selection]
```

Pair the sketch with the current route screenshot or current route description when visual comparison matters.

## HTML Wireframe Contents

Each `major` HTML approval wireframe should include the route-specific version of these primitives when relevant:

- command header with title, context, primary action, and secondary actions
- dense toolbar with search, filters, view switch, sort, or bulk controls
- content grid with clear primary and secondary regions
- table or list region with realistic row anatomy and scan density
- modal, drawer, inspector, or confirmation mock when overlays are part of the decision
- responsive breakpoint notes for desktop, tablet, and mobile
- empty, loading, error, or permission state hints when these change composition
- scroll ownership and overlay ownership notes

Avoid annotation-heavy presentation. Labels should be short and product-like, not explanations of how to use the page.

## Approval Packet

Return a compact packet before implementation:

- `Surface`
- `Risk`
- `Approval artifact`: none, delta packet, screenshot plan, ASCII sketch, or HTML
- `Primary job`
- `Wireframe files`
- `Wireframe directory`
- `Layout decision`
- `Key changes`
- `Responsive behavior`
- `Overlay ownership`
- `Open questions`
- `Approval needed`

Use recommendation-first questions when tradeoffs remain. Example: "I recommend the right-side inspector because it preserves list scan speed. Approve this structure?"

`Wireframe files` and `Wireframe directory` are required only when HTML is generated. When no HTML is generated, set them to `none`.

## Batch Policy

HTML batch policy applies only to `major` risk.

For one route, create one HTML file.

For a batch, create at most two HTML files:

- one representative shared shell file
- one second file only when a route has materially different composition or overlay behavior

If more than two distinct layouts are needed, stop and ask the user to split the batch or choose the two highest-risk surfaces first.

## Cleanup

Generated files live under `.artifacts/layout-wireframes/<timestamp>/` and are temporary. After approved implementation and verification, remove only that generated timestamp folder unless the user asks to keep it.

Do not remove:

- this skill folder
- `assets/wireframe-template.html`
- `references/layout-approval-rules.md`
- unrelated `.artifacts` folders

## Failure Modes

Stop and ask before implementation if:

- the user has not approved a required `medium`, `high`, or `major` approval artifact
- a `major` wireframe is still only a text description
- the proposed structure replaces route architecture without a visible preview
- the batch needs more than two HTML files
- external references are becoming a substitute for FitTrack product intent
