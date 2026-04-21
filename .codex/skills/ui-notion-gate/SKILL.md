---
name: ui-notion-gate
description: "Use internally for premium FitTrack UI work when a structured Notion review page, approval gate, or motion-bible update must be written in a machine-readable format that downstream agents can re-read safely."
---

# FitTrack UI Notion Gate

Use this skill as the structured writing lane for premium UI decisions. Do not treat it as a product-design skill.

## First pass

- Search for the parent page `Q&A God Tier Automation`.
- Search for `FitTrack Admin UI Canon`.
- Search for `FitTrack UI Motion Bible`.
- Read `references/uiux-notion-template.md`.
- Before creating or updating Notion content, read `notion://docs/enhanced-markdown-spec`.

## What this skill owns

- Review-page creation and update
- Machine-readable decision packets
- Approval checkbox placement
- Admin-canon creation and maintenance
- Motion-bible creation and maintenance
- Compact motion decision packet append behavior
- Visual-DNA and concept-divergence packet persistence
- Macro-to-micro Figma handoff persistence

## What this skill does not own

- Choosing the design direction by itself
- Figma authoring
- Browser validation
- Backend or contract repair

## Workflow

1. Create or update one child page per premium route or modal pass under `Q&A God Tier Automation`.
2. Use the fixed section order from the template.
3. Add the approval checkbox exactly as specified.
4. Keep the top of the page machine-readable with a fenced `yaml` packet.
5. Create `FitTrack Admin UI Canon` under the same parent if it does not exist.
6. Create `FitTrack UI Motion Bible` under the same parent if it does not exist.
7. When `admin-design-language` or `ui-visual-dna-director` finishes a premium admin run, update the canon with the family-level packet for that surface.
8. When `figma-concept-explorer` finishes, persist the concept divergence matrix and selected concept rationale on the current review page.
9. When `figma-scaffold-builder` finishes, persist the macro scaffold handoff and node targets on the current review page.
10. When `component-decorator` finishes, persist the `Component anatomy contact sheet`, the micro-design goals, and the decorator verdict on the current review page.
11. When `ui-animator` finishes a premium run, append a compact `Motion Decision Packet` to the current route or modal page and link it back to the bible.
12. If the packet marks the current surface or scaffold as `anti_reference`, add a short recommendation callout that says the current UI is not an adaptation candidate and that implementation must wait for approval of the proposed refactor direction.

## Guardrails

- Do not write freeform notes that reorder the template.
- Do not make the review page read like a brainstorm dump.
- Keep the content scannable by both humans and agents.
- Use short headings, short bullets, and explicit labels.
- When the run flags vibe-coded or weak current UI, say so plainly and route the user to the approval checkbox rather than softening it into generic `polish` language.
- Do not let the review page stop at workflow logic when the visual identity is still generic.
- Do not let the review page skip the macro-to-micro handoff once the page relies on `component-decorator`.

## MCP routing

- `notion_search` to find parent and existing pages
- `notion_fetch` to inspect the current page
- `notion_create_pages` to create missing pages
- `notion_update_page` to append or replace the packet

## Output defaults

- Return:
  - `Notion approval gate`
  - `Review page URL`
  - `Admin canon URL`
  - `Motion bible URL`
  - `Sections written`
  - `Pending approval state`
