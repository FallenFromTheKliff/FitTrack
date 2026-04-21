# FitTrack Admin Genre Brief

## Purpose

This brief defines the shared design identity for the FitTrack admin side so page-by-page premium redesigns stop inventing their feel from scratch.

It is intentionally light. The goal is not to fully redesign every route here. The goal is to lock the house genre, family variants, and product boundaries that future page-level Figma and implementation runs should follow.

## Non-Negotiables

- Theme switching stays.
- Font switching stays.
- Animation preference stays.
- Future admin pages must survive different themes and font selections without breaking hierarchy or layout.
- Page-level redesigns may replace weak layout, component, and copy patterns, but they must not break appearance-system capabilities.

## House Genre

### Primary genre

`Performance Operations`

FitTrack admin should feel like premium software for running a real gym, not a generic business dashboard and not a stylized concept site.

### What that means

- high-signal
- operational
- premium
- physically grounded
- athletic
- trustworthy
- controlled
- performance-oriented

### What that does not mean

- generic SaaS
- soft wellness lifestyle UI
- notebook app
- builder UI
- fintech shell
- devtool dashboard
- overdone cyberpunk
- gamer HUD

## Core Emotional Keywords

- precise
- intense
- premium
- fast-reading
- credible
- athletic
- disciplined
- technical
- grounded
- purposeful

## Physical Metaphors

Use these as direction cues, not literal skeuomorphism:

- training console
- facility control desk
- dispatch terminal
- equipment display
- operations wall
- performance monitor

The admin should feel closer to equipment and operations software than to a notebook or a component library.

## Anti-Genres

Any route should fail art direction if it drifts into these:

- generic dark SaaS shell
- notebook workspace
- browser-builder UI
- fintech analytics board
- component showroom
- visual-design-tool canvas
- lifestyle app dashboard

## Visual Intent

### Desired feel

- dense enough for real work
- premium without becoming decorative
- bold where hierarchy matters
- sharp and authored, not template-clean
- gym-management first, not abstract B2B software first

### Avoid

- equal-weight cards everywhere
- random KPI walls
- center-layout plus passive support rail as the default answer
- paper-tab / editorial motifs when they overpower the gym-ops feel
- browser-chrome framing as the dominant metaphor

## Page Family Variants

Each page inherits the house genre, but expresses it through a controlled family variant.

### Command Center

Surface:
- `Overview`

Feel:
- gym pulse
- business health
- operational pressure
- faster triage than storytelling

### Record Workspace

Surfaces:
- `Members`

Feel:
- dense operational records
- clear identity blocks
- strong action hierarchy
- quick inspection and controlled editing

### Planner / Dispatch

Surface:
- `Gym Operations`

Feel:
- live planning
- resource allocation
- queue pressure
- front-desk urgency
- coach readiness as a contained secondary mode

### Lab / Verification

Surface:
- `Exercise Lab`

Feel:
- review workbench
- catalog governance
- verification lane
- high-signal technical curation
- progression moderation as a contained sibling tab when the feature is still lightweight

### Spatial / Resource

Surfaces:
- `Facilities`
- `Inventory`

Feel:
- physical space awareness
- equipment/resource oversight
- status clarity
- topology and readiness

### System / Config

Surfaces:
- `Settings`
- `Profile`

Feel:
- calmer
- structured
- precise
- less theatrical than other families, but still premium

## Page Map

- `Overview` = merged `Dashboard + Analytics`
- `Members` = member/client record management
- `Gym Operations` = bookings, appointments, venue usage, live planning, and coach-data management
- `Exercise Lab` = global exercise CRUD, custom exercise review, promotion to conventional/global exercise, and lightweight milestone moderation
- `Facilities` = spaces, layout, amenities, operational areas
- `Inventory` = equipment and stock/resource management
- `BrodigyAI` only if it keeps a separate admin job beyond chat
- `Settings` = system configuration
- `Profile` = personal admin/staff identity

## Experiment And Calibration Pages

### Primary experiment page

`Exercise Lab`

Why:

- greenfield enough to avoid heavy legacy inheritance
- operational enough to test real admin seriousness
- distinct enough to prove the system can create authored FitTrack UI instead of reskinning existing pages

### Calibration pages

- `Overview`
- `Members`

Why:

- `Overview` proves the genre works for business and operational breadth
- `Members` proves the genre still works for dense record management

### Important rule

`Exercise Lab` is the first proving ground, not the single page that defines the entire admin by itself.

## Product Boundary Rules

- `Gym Operations` owns live booking and appointment planning, and hosts coach-data management as a contained secondary mode.
- `Members` should not remain the long-term owner of coach-specific admin actions.
- `Exercise Lab` owns exercise governance and promotion, and may host milestone moderation as a secondary tab while that feature remains lightweight.
- Milestone claims, proofs, and progression decisions must stay a separate moderation object from exercise publish review even when they share the same route shell.
- Temporary mixed-purpose tabs should be removed once dedicated surfaces exist.

## Route-Specific Notes

### Gym Operations

Must feel like:

- gym-tech operations
- dispatch
- front-desk planning
- contained coach management, not a separate coach product

Must not feel like:

- notebook UI
- generic planner SaaS
- members page adapted into scheduling
- separate coach back-office

### Exercise Lab

Must feel like:

- verification workbench
- exercise catalog governance
- technical review
- progression moderation sibling state when milestones are present

Must not feel like:

- AI chat page
- generic admin CRUD table
- playful gamification surface

### Members

Must feel like:

- premium record workspace
- high-trust operational member management

Must not feel like:

- CRM template
- profile inspector clone

## How To Use This Brief

For each page-level premium run:

1. Lock the page contract first.
2. Identify the page family from this brief.
3. Pull references that match both:
   - the house genre
   - the page family
4. Reject references that are high-quality but wrong-genre.
5. Treat `Exercise Lab` as the first major proving ground for the authored admin style.
6. Validate the resulting style against `Overview` and `Members` before treating it as admin-canon quality.

## Immediate Next Surfaces

Recommended order:

1. `Exercise Lab`
2. `Gym Operations`
3. `Overview`

This order resolves the current biggest ambiguity first and gives the admin a cleaner system before later route-wide UI refactors.
