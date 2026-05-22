---
name: layout-wireframe-gate
description: "Use for FitTrack professional layout approval before implementation: subjective layout tweaks, modal or page composition changes, professional layout revisions, responsiveness redesigns, batched route layout approval, route shell or modal architecture replacement, awkward-looking UI risk, or when the user asks to preview or approve layout before code."
---

# FitTrack Layout Wireframe Gate

## Changelog

- 2026-05-22: added GPT Images approval artifacts as the preferred high/major UI preview path before implementation, with HTML retained only for explicit or technical fallback cases.

Gate subjective FitTrack layout work with the cheapest approval artifact that is honest for the risk. The goal is to extract the UI intent, content, states, and interaction model, turn that into a visible approval artifact, and only then implement the approved direction. Prefer GPT Images for high-risk visual exploration because it gives the user a fast, high-fidelity target before code exists; use HTML only when the user explicitly asks for an HTML preview or when exact responsive mechanics cannot be judged from an image.

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
- `high`: responsive recomposition, overlay ownership change, page density shift, primary/secondary region swap, modal/task-flow redesign, or a layout that has looked awkward in past attempts.
  - Artifact: current screenshots plus a GPT Images prompt and generated concept image when image generation is available; otherwise use an annotated screenshot plan or ASCII sketch.
  - Action: show the generated image or fallback artifact and stop for approval before code.
- `major`: route shell replacement, modal/drawer architecture replacement, page information architecture rewrite, batched route layout approval, or explicit user request for a preview file.
  - Artifact: GPT Images concept board by default, grounded in captured screenshots and real content. Use temporary static HTML only when the user explicitly asks for HTML, when image generation is unavailable, or when exact breakpoint mechanics must be tested before code.
  - Action: show the generated image or fallback artifact and stop for approval before code.

Use GPT Images as the preferred visual approval path for high/major subjective UI work. Use HTML only as a fallback for explicit HTML requests, unavailable image generation, or mechanics that need browser-resizable proof. Prefer a packet or screenshot-backed plan for ordinary layout tweaks.

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
6. For image-backed approvals, first capture the current live surface and relevant sibling references with Playwright or Browser. Include default, selected, empty, create/edit, destructive, evidence/review, and mobile states when they affect the design.
7. Extract the UI intent before prompting GPT Images:
   - primary operator job
   - route sections and hierarchy
   - real data/content labels
   - controls, filters, actions, and feedback states
   - overlay ownership and scroll ownership
   - FitTrack theme constraints and sibling-route design language
   - what must stay product-facing and what must be hidden as advanced detail
8. Generate a GPT Images prompt that describes the approved product intent, real content, desktop and mobile states, and interaction flow. Ask for a high-fidelity product UI concept, not a marketing mockup, and forbid annotation-heavy or generic admin-template output.
9. Show the generated image to the user and ask for approval, small changes, or a new concept. Do not implement until the user approves the visual direction.
10. For `low` risk, implement directly through the owning frontend skill and verify the changed surface.
11. For `medium` risk, return a `Layout Delta Packet` and ask for approval only when the change is subjective, workflow-visible, or user-requested.
12. For `high` or `major` risk, prefer the GPT Images approval loop above. Use the screenshot plan or ASCII sketch only when image generation is unavailable or overkill.
13. For explicit HTML previews or browser-mechanics fallbacks, create temporary static HTML wireframes only for a real task under `.artifacts/layout-wireframes/<timestamp>/`:
   - default folder: `.artifacts/layout-wireframes/<timestamp>/`
   - timestamp format: `YYYYMMDD-HHMMSS`
   - one HTML file for one page or modal
   - at most two HTML files for a batched request
14. Copy and adapt `assets/wireframe-template.html` into the temporary folder. Never edit or delete the asset template during task execution.
15. Keep HTML wireframes static, dependency-free, and low-fidelity enough to focus on layout decisions. Plain HTML and CSS only. No app code, build tooling, external fonts, external CSS, external JS, screenshots as source, or production component imports.
16. After generating HTML, stop immediately and notify the user with the exact directory and HTML file path or paths. Use clear wording like: `Layout wireframe is ready for review: <absolute or repo-relative path>. Review the HTML in this directory. No implementation will start until approved.`
17. Ask for approval with a concise recommendation:
   - approve as-is
   - approve with small changes
   - revise before implementation
18. If the user requests changes, revise the approval artifact only and ask again. For image concepts, revise the prompt and regenerate; do not start coding from a rejected concept.
19. After approval, implement using the relevant FitTrack frontend skills and repo patterns. Preserve the approved composition unless a code constraint forces a deviation, then call out the deviation before proceeding.
20. After approved implementation and verification, delete any temporary generated HTML folder unless the user asks to keep it. Never delete `assets/wireframe-template.html`. Keep generated image artifacts unless the user explicitly asks to remove them.

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

## GPT Images Approval Prompt

Use this for high/major visual approval when image generation is available. Build the prompt from captured screenshots, real product copy, state inventory, and sibling FitTrack references. The generated concept should include the route default state plus the important overlays or mobile states that affect approval.

Prompt contents:

- product and route name
- audience and primary job
- FitTrack visual constraints: dark admin shell, orange accent, no generic marketing hero, no gradient/orb decoration, restrained cards, readable density
- sibling references to preserve, such as Accounts density or Gamification command hierarchy
- real rows, labels, filters, statuses, and actions
- overlay states: create/edit, confirmation, detail drawer, evidence review, empty/loading/error when relevant
- desktop composition and mobile adaptation
- interaction hints: selected row, active filters, pagination, destructive confirmation, approval/rejection states
- explicit anti-patterns to avoid: raw JSON in primary UI, annotation copy, over-nested cards, unreadable text, decorative clutter

After generation, return the image and a compact approval packet. If the user approves, implement against the image as the visual target. If the user requests changes, revise the prompt and regenerate before implementation.

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

Use HTML only for explicit HTML preview requests or browser-mechanics fallback cases. Each `major` HTML approval wireframe should include the route-specific version of these primitives when relevant:

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
- `Approval artifact`: none, delta packet, GPT Images concept, screenshot plan, ASCII sketch, or HTML
- `Primary job`
- `Generated image paths` when image generation is used
- `Wireframe files` when HTML is used
- `Wireframe directory` when HTML is used
- `Layout decision`
- `Key changes`
- `Responsive behavior`
- `Overlay ownership`
- `Open questions`
- `Approval needed`

Use recommendation-first questions when tradeoffs remain. Example: "I recommend the right-side inspector because it preserves list scan speed. Approve this structure?"

`Generated image paths` are required when GPT Images is used. `Wireframe files` and `Wireframe directory` are required only when HTML is generated. When an artifact type is not used, set it to `none`.

## Batch Policy

For GPT Images concepts, prefer one design board per route that includes representative overlays and mobile adaptation. For a batch, generate at most two boards unless the user asks to explore more variants.

HTML batch policy applies only to fallback HTML for `major` risk.

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
- a `high` or `major` subjective UI direction is still only a text description when image generation or another visible artifact is available
- the proposed structure replaces route architecture without a visible preview
- the batch needs more than two HTML files or more than two GPT Images boards without user approval
- external references are becoming a substitute for FitTrack product intent
