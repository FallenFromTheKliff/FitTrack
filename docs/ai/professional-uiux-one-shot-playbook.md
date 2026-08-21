# Professional UI/UX One-Shot Playbook

Use this playbook for high-visibility admin surfaces when the user wants a premium result in one coordinated pass instead of another patch loop.

## Default trigger

- "Enhance this admin page UI"
- "Make this route premium"
- "Do this 1:1 from Figma"
- "The page works but still does not feel professional"
- repeated premium patch passes on the same route

## North star

- Composition first, not token first
- One route grammar across landing, task, and overlay states
- Figma scaffold as the structural source of truth
- Implementation that preserves the scaffold's ratios at normal desktop zoom
- Motion as the finisher, not the rescue

## One-shot phase order

1. Scan the live route and local route code.
2. Inventory the real route states and operator-facing features.
3. Pull reference material:
   - exact Figma route frames and component nodes
   - Exa references only for component or flow gaps that Figma does not already answer
4. Create or update a collaborative Notion child page under `Q&A God Tier Automation`.
5. Wait for the route-direction approval checkbox when the run is collaborative.
6. Build or update the Figma scaffold for the approved route direction.
7. Implement the page 1:1 from the approved scaffold, adapting only FitTrack-native theme, typography, and settings-driven skinning.
8. Add restrained dynamic polish only after the 1:1 composition looks right.
9. Verify the live result against the scaffold and the original UX complaint.

## Token discipline

- Read the smallest route slice that explains the UX problem.
- Pull only the exact Figma nodes that matter to the current route state.
- Keep Exa narrow:
  - at most a few component or interaction benchmarks
  - no broad mood-board searches
- Do not reopen approved keep-versus-replace decisions unless a real blocker appears.
- Reuse the same route packet, Figma nodes, and Notion page across the run instead of regenerating summaries.

## Figma translation rule

- Figma is not just a token lane.
- For one-shot premium runs, use Figma to retrieve:
  - frame hierarchy
  - component composition
  - widths and ratios
  - section order
  - spacing rhythm
  - text hierarchy
  - screenshots
- Use Figma in this order when possible:
  1. `get_libraries`
  2. `search_design_system`
  3. `get_design_context`
  4. `get_screenshot`
  5. `use_figma`
- Treat the approved scaffold as the page composition source of truth. Do not keep only colors, border radii, or spacing tokens while quietly rebuilding the page through a generic shell.

## Default benchmark lane

- For record-centric admin surfaces such as members, users, customers, and operator-managed directories, default to `Attio` as the external quality benchmark.
- Use `Attio` for:
  - list-plus-record workflows
  - record detail hierarchy
  - right-sidebar or supporting-detail composition
  - action placement on record surfaces
  - page sections that move from highlights to activity to related records
- Use `Linear` as the secondary benchmark for:
  - dense list rendering
  - filter ergonomics
  - display-property discipline
  - preview or peek behavior
  - fast operator navigation patterns
- Do not fall back to generic admin template blogs or dashboard kits when `Attio` or `Linear` already answer the component problem.
- For FitTrack admin work, this default benchmark lane is stronger than vague `Stitch-style` guidance because it maps directly to people, records, lists, filters, and supporting detail flows.

## Notion collaboration gate

- Use one child page per route or rebuild pass under `Q&A God Tier Automation`.
- The page should contain:
  - route goal
  - current blockers
  - route state map
  - feature inventory
  - `Keep / Replace / Remove / Add`
  - reference lane summary
  - open questions if any
  - approval section
- The approval section should include:
  - one checkbox for `Approved to scaffold and implement this direction`
  - one short note on what that approval authorizes
- If the scaffold changes materially after approval, refresh the page instead of silently drifting.

## Figma scaffold rule

- Scaffold the landing state first.
- Then scaffold:
  - contained secondary states
  - task or create views
  - important overlays
- Each scaffold packet should carry:
  - frame name
  - node id
  - primary job
  - component targets
  - notes on what must stay visually exact
- Use the file's design-system libraries when they are real and relevant.
- Do not build the scaffold as a loose mood board. It should be implementation-grade.

## 1:1 implementation rule

- Implement from the approved scaffold, not from memory and not from prose alone.
- Preserve:
  - section sequence
  - dominant command surface
  - primary roster or list composition
  - inspector or task-view structure
  - container proportions
  - visible action placement
- Adapt only what the product genuinely requires:
  - FitTrack theme tokens
  - user-adjustable fonts or themes
  - reusable component boundaries
  - runtime states and accessibility requirements
- Componentization is allowed and encouraged, but it must not distort the approved composition.
- Do not replace a scaffolded layout with a more generic reusable shell just to save code lines.

## Professional admin surface recipes

### Command deck

- One dominant command area at the top of the page
- Title and support copy compressed to the minimum needed for confidence
- Primary action cluster visible without hunting
- Filters grouped as a working control row, not a decorative band
- Supporting stats should be concise and secondary to the main job

### Primary roster or list

- Dense enough to feel operational at `100%` browser zoom
- Clear first scan target on the left
- Secondary metadata muted, not equally loud as the main identity
- Status emphasis should beat badge clutter
- Row actions should stay compact and deliberate
- Pagination should be visible and feel native to the surface, not tacked on

### Inspector

- Desktop inspector should not be independently scrollable by default
- Prefer page-owned scroll and a stable inspector height unless content truly cannot fit
- Keep the lane purposeful, usually around a narrow supporting width instead of becoming a second page
- Section order should move from summary to history to next actions
- If the inspector competes with the primary job, demote it into a lower container, tab, toggle, or child surface

### Task or create view

- Task views should read like first-class surfaces, not nested cards inside the old page
- The main route chrome should step back while the task is active
- Back path should be obvious
- Sticky footers or action bars are acceptable when they improve confidence and keep the action visible

### Scale and density

- The page should feel composed on common laptop widths at `100%` zoom
- Avoid dead shell bands, oversized section headers, and overpadded stacks
- Containers should earn their area
- If the page is awkwardly tall before the first meaningful action, reduce the shell

## Dynamic polish rule

- Do not add motion before the structure is right.
- Preferred timings:
  - hover and press: `120-160ms`
  - filter or pagination state switch: `180-220ms`
  - panel, drawer, modal, or sticky-footer motion: `220-280ms`
- Good defaults:
  - restrained row or card entrance rhythm
  - subtle pagination re-render transitions
  - hover elevation or border response
  - confident segmented-control and tab transitions
- Avoid:
  - bounce-heavy springs
  - novelty loaders
  - persistent shimmer spam
  - loud reveal choreography that competes with the data

## Closure bar

- The route should feel like a deliberate product surface, not a cleaned-up internal tool.
- If the landing state still feels generic, oversized, dead, or structurally compromised, the run is not done.
- If the code is reusable but the composition drifted away from the approved scaffold, the run is not done.
