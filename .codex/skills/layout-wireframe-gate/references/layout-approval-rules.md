# Layout Approval Rules

Use this reference when `layout-wireframe-gate` is active.

## Approval Checklist

- Name the surface and the primary operator job.
- Preserve FitTrack intent, auth state, data ownership, route shell constraints, and available primitives.
- Choose the cheapest honest approval artifact: no artifact, Layout Delta Packet, screenshot-backed plan, ASCII sketch, or HTML.
- Use static HTML only for major route/modal architecture changes, batched layout approval, or explicit preview requests.
- Include desktop, tablet, and mobile breakpoint behavior when the change affects composition.
- Identify scroll ownership: page, panel, table, drawer, or modal.
- Identify overlay ownership: dialog, drawer, inspector, popover, or confirm layer.
- For medium/high/major risk, show or describe the command header, dense toolbar, content grid, table or list region, and any modal or drawer architecture when relevant.
- Keep labels short and production-like. Do not fill the mock with instructions.
- Ask for explicit approval before implementation.

## Risk Ladder

- `low`: tiny spacing, copy, icon, color, or state polish. No approval artifact by default.
- `medium`: section order, toolbar grouping, card/table/list anatomy, filters, or modal content. Use a Layout Delta Packet.
- `high`: responsive recomposition, overlay ownership, page density shift, primary/secondary region swap, or known awkwardness risk. Use current screenshot when available plus an annotated text plan or ASCII sketch.
- `major`: route shell replacement, modal/drawer architecture replacement, page information architecture rewrite, batched layout approval, or explicit HTML preview request. Use static HTML.

## Layout Delta Packet

Use this instead of HTML for ordinary layout tweaks:

- `Surface`
- `Risk`
- `Current layout`
- `Proposed layout`
- `What changes visually`
- `What stays the same`
- `Desktop behavior`
- `Mobile behavior`
- `Overlay or scroll ownership`
- `Risk of awkwardness`
- `Approval needed`

## Max File Policy

- Most requests should generate zero HTML files.
- One page or modal: create one HTML file.
- Batched request: create at most two HTML files.
- More than two distinct compositions: stop and ask the user to choose the first two surfaces or approve a smaller batch.
- Default output path: `.artifacts/layout-wireframes/<timestamp>/`.
- Use timestamp format `YYYYMMDD-HHMMSS`.

## Deletion Policy

- Temporary generated wireframes are deleted after approved implementation and verification unless the user asks to keep them.
- Delete only the generated timestamp folder.
- Never delete the skill asset template.
- Never delete unrelated `.artifacts` content.
- If implementation is paused, leave the temporary files in place and mention them in the handoff.

## Professional Layout Heuristics

- Start from FitTrack product intent, tokens, spacing, shell behavior, data contracts, and sibling surfaces.
- Prefer dense admin layouts that help scanning, comparison, triage, and repeated action.
- Avoid marketing-page composition, oversized hero sections, decorative card stacks, and copy-heavy onboarding panels in operational tools.
- Use shadcn/ui dashboard, sidebar, and data-table structures as structural reference points when they fit the route.
- Use Radix patterns for expected focus, dismissal, keyboard, and layered overlay behavior.
- Use Attio or Linear style density for record lists, command surfaces, filters, and inspector-like workflows.
- Use Magic UI only after the structure is approved, and only for component polish, microinteraction, or motion inspiration.
- Treat the current route as evidence, not destiny. Keep business-critical behavior, replace weak composition when the wireframe proves the improvement.
- One primary overlay owner should be active at a time. Avoid nested modal stacks unless the wireframe explicitly models a confirm step.
- Page scroll should be the default for dashboards and settings surfaces. Give inner regions independent scroll only when the wireframe names why.
- Mobile should collapse into task order, not merely shrink desktop columns.
- Keep admin surfaces quiet, legible, and fast to parse.
