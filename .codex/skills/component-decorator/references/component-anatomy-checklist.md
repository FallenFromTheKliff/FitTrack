# Component Anatomy Checklist

Read this when running `component-decorator` for a multi-component audit, contact sheet, or implementation pass.

## Contact Sheet Schema

Use a compact table or bullets with these fields:

| Field | What to capture |
| --- | --- |
| Component | Component family or weak zone name |
| Macro source | Approved wireframe, Figma node, route packet, or user-approved scaffold |
| Role | `primary_job`, `supporting_context`, `secondary_action`, or `state_surface` |
| Current anatomy | Title, metadata, controls, evidence object, row/card structure, footer, and state slots |
| Reference trait | Approved Figma, local sibling, shadcn/ui, Radix, or other named source and the exact trait borrowed |
| Do not copy | Visual, motion, density, or hierarchy traits that would harm FitTrack |
| FitTrack alignment | Existing primitive, token, class pattern, icon family, spacing, and copy voice to preserve |
| Required fixes | Blocking changes needed for clarity, density, states, accessibility, or control quality |
| Enhancements | `implement_now`, `optional_if_time`, or `reject_for_this_surface` polish ideas |
| States | Hover, focus, selected, loading, empty, error, disabled, destructive, and responsive states |
| Accessibility names | Labels for icon buttons, fields, dialogs, rows, tabs, filters, and destructive actions |
| Ownership | `component-decorator`, `frontend`, `integration`, `ui-reference-lane`, or `ui-animator` |

## Cards

- Strong title or identity line; value or status is not floating without context.
- One secondary metadata line unless the card's job requires more.
- Action area is obvious and does not fight the main scan path.
- Status badges are high-signal and not duplicates of the title or value.
- Empty, loading, selected, hover, focus, and disabled states exist when clickable.
- Avoid nested cards, oversized headers, decorative gradients, and low-signal helper copy.

## Tables And Lists

- Columns or row fields are ordered by action value, not database order.
- Row height, cell wrapping, and truncation are stable across common data lengths.
- Primary identity, status, and next action are scannable in one pass.
- Bulk actions, row actions, and contextual menus are visually distinct.
- Empty, loading, error, no-results, selected, hover, focus, and disabled states are designed.
- Remove repetitive badges, dead columns, debug labels, and values that repeat nearby copy.

## Filters And Toolbars

- Search, filters, sort, view switch, and primary action have clear hierarchy.
- Active filters are visible and removable.
- Reset or clear-all behavior is present when multiple filters can stack.
- Controls wrap cleanly on tablet/mobile without overlapping or hiding the main action.
- Icon-only controls have accessible names and tooltips when meaning is not obvious.
- Avoid toolbar bands that spend height without improving the user's next action.

## Pagination

- Current page or loaded range is visible.
- Boundary controls have disabled states.
- Page-size or density control is present only when it helps the operator.
- Content change feedback is clear enough for table/list updates.
- Mobile pagination does not collapse into tiny, ambiguous controls.

## Empty, Loading, And Error States

- Empty copy names the missing object and the next useful action.
- Loading skeletons match final density and do not resize the layout.
- Error states include retry or recovery when the surface can recover.
- Permission states explain access calmly and avoid exposing internal policy details.
- Success states are short and do not interrupt repeated work unnecessarily.

## Modals And Drawers

- One overlay owner is active at a time unless a confirm dialog is explicitly approved.
- Title names the object or task, not generic mode text.
- Body is compact, grouped, and free of nested card piles.
- Footer has clear cancel, destructive, and primary-action hierarchy.
- Focus trap, escape or close behavior, and restore-focus expectation are clear.
- Convert oversized or multi-step work into a task surface when a dialog becomes cramped.

## Destructive Confirms

- Name the exact object being changed or deleted.
- State the consequence in one short sentence.
- Use a distinct destructive action label, not a vague confirmation.
- Keep cancel safe and visually easier than accidental destruction.
- Require stronger confirmation only for irreversible or high-impact actions.

## Interaction States

- Hover clarifies clickability without shifting layout.
- Focus-visible is keyboard-visible and token-aligned.
- Selected is stronger than hover and persists clearly.
- Pressed and active states give brief feedback without noisy motion.
- Disabled states explain unavailable actions when the reason is not obvious.

## Density, Copy, And Accessibility

- Prefer nouns and labels over explanatory sentences.
- Remove repeated counts, status words, and helper text that does not change action speed.
- Use product language instead of board notes, implementation terms, or critique labels.
- Keep target sizes reasonable for touch where components are available on mobile.
- Ensure accessible names exist for icon-only actions, dialogs, fields, tabs, filters, pagination, and destructive controls.

## Magic UI Boundary

Magic UI may suggest a hover, reveal, shimmer, or transition trait only after structure and component anatomy are approved. It must never decide page hierarchy, component role, information order, or layout.
