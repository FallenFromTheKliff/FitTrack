# Premium Route Rebuild Output Shape

Use this shape unless the user clearly asks for something narrower:

- `Route verdict`
- `Current tier`
- `Target tier`
- `Route state map`
- `Feature inventory`
- `Keep / Replace / Remove / Add matrix`
- `Missing components`
- `Missing behaviors`
- `Weak components`
- `Operator-first additions`
- `Component replacement candidates`
- `Needs user decision`
  - when Notion is available, this should also be ready to mirror into `Q&A God Tier Automation`
- `Navigation model`
- `Data-rendering priorities`
- `Reference lane`
- `Reference targets by component`
- `Wireframe frame list`
- `Implementation slices`
- `QA gates`

For high-visibility admin routes, also include:

- `Landing-state score`
- `Secondary-state score`
- `Create-task score`
- `Overlay score`
- `Route-level premium blockers`
- `Scope cuts`

## Quality bar

- The wireframe frame list should cover every important route state before implementation starts.
- Operator-first additions should improve lookup, triage, review, creation, navigation, or data usefulness.
- The keep-replace-remove-add matrix should be explicit enough that a user can react before implementation begins.
- `Needs user decision` should only contain high-impact tradeoffs such as removing a workflow, replacing a table with a different interaction model, or dropping a legacy control that still has business implications.
- Write `Needs user decision` in a user-ready way, for example:
  - `Keep member detail modal or replace it with a right-side inspector? Recommended: replace.`
  - `Keep KPI strip or remove it entirely? Recommended: remove.`
- For the Notion Q&A lane, each item should be easy to convert into:
  - a question heading
  - three recommended checkbox options
  - one checkbox for `Custom option`
  - one short explanation of the default recommendation
- Component replacement candidates should be real pattern decisions, not cosmetic rewrites.
- Implementation slices should be grouped by route state or subsystem, not by random file lists.
- QA gates should make it impossible to pass the route if only one child mode is premium.
