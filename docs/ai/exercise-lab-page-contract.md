# Exercise Lab Page Contract

## Purpose

`Exercise Lab` is the admin and staff workspace for governing FitTrack's exercise ecosystem.

It owns:

- custom exercise review
- canonical exercise CRUD
- promotion from custom exercise to conventional or global exercise
- exercise-state governance
- provenance and audit visibility for exercise decisions
- milestone and achievement moderation as a contained secondary tab inside the same surface

It does **not** own:

- generic AI chat
- live rep-tracking UI
- member profile management
- booking or scheduling operations

## Primary Operators

- admin
- staff

Future extension:

- coaches as privileged creators or reviewers if permissions later expand

## Page Family

`lab / verification`

## Genre Fit

Must feel like:

- verification workbench
- catalog governance surface
- progression moderation sibling surface
- premium gym operations lab
- technical but readable review UI

Must not feel like:

- AI chat console
- generic admin CRUD table
- playful gamification panel
- notebook or builder UI

## Core Job

Decide whether a submitted or created exercise:

- stays custom
- maps to an existing canonical exercise
- becomes a new conventional exercise
- becomes globally available to other users
- gets rejected, archived, or sent back for changes

And, in the milestone tab, decide whether a submitted workout achievement:

- gets approved
- gets rejected
- stays visible as audit history after moderation

## Top Actions

1. Review pending exercise submissions.
2. Inspect exercise evidence, metadata, and origin.
3. Map a submission to an existing canonical exercise.
4. Create a new canonical exercise when no match exists.
5. Edit or archive existing canonical exercises.
6. Promote an approved exercise to global visibility.
7. Search and filter the exercise library.

## Primary Objects

- `Custom exercise submission`
- `Canonical exercise`
- `Global exercise`
- `Review decision`
- `Promotion state`
- `Source / provenance`
- `Exercise metadata`
- `Milestone claim`
- `Achievement review decision`

Later:

- `Movement contract`
- `AI training signal`
- `Duplicate cluster`

## Recommended States

- `Draft`
- `Pending review`
- `Needs changes`
- `Rejected`
- `Approved custom`
- `Promoted to global`
- `Archived`

These are the preferred product states even if the first backend contract uses different names.

## Best Initial Shape

One page with four strong modes:

- `Exercise Review`
- `Milestones`
- `Global Library`
- `Create / Edit`

This keeps the first implementation cohesive without prematurely splitting the experience into many routes while still separating exercise governance from lightweight gamification moderation.

## What Belongs Here

- pending custom exercise submissions from clients
- future coach-created exercise submissions
- approval and rejection workflow
- promotion workflow
- canonical exercise catalog CRUD
- search, filter, and state management
- reviewer notes and provenance
- pending milestone claims
- milestone proof preview, approve / reject, and closed-review audit context

## What Does Not Belong Here

- generic BrodigyAI chat
- live camera and rep-tracking surfaces
- member record editing
- coach scheduling
- venue and amenity bookings

## MVP Scope

- review queue for pending exercises
- milestone moderation tab
- exercise detail review surface
- approve / reject / promote / archive actions
- global library list
- create canonical exercise form
- edit canonical exercise form
- search
- status filter
- source filter
- reviewer notes

## Deferred Scope

- model-quality analytics
- exercise similarity clustering
- advanced duplicate resolution
- taxonomy graphs
- coach-specific permission tiers
- version branching and rollback history
- rich AI training controls
- milestone definition CRUD
- reward editing or fraud scoring

## FitTrack-Native Couplings

Immediate couplings that make the page feel like FitTrack:

- mobile workout flow can feed custom exercise submissions into this queue later
- approved global exercises become available to other users
- canonical exercise naming should align with workout and pose vocabulary
- source visibility should preserve whether an exercise originated from a client or a future coach author
- milestone claims originate from member workout progression and use the same workout-intelligence pipeline, but they remain a different moderation object than exercise submissions

## Relationship To Neighboring Pages

- `Members`: should no longer host this workflow through the temporary alien tab
- `Milestones`: now lives inside `Exercise Lab` as a contained tab until that moderation scope becomes large enough to deserve its own route
- `Schedule`: unrelated except for future coach or workout context links
- `BrodigyAI`: should not absorb this page unless it gains a true separate admin intelligence workflow

## Data And Code Seams

Current nearby seams already exist in:

- `apps/mobile/components/workout/WorkoutLiveScreen.tsx`
- `packages/api-client/domains/fitness.ts`
- `packages/utils/pose.ts`

This means `Exercise Lab` is not greenfield; it is a clearer admin surface over existing exercise and pose-intelligence seams.

## UI Shape Guidance

Recommended composition:

- top command strip for tab selection, search, filters, and create action
- `Exercise Review` tab with a primary review queue region and selected exercise workbench
- `Milestones` tab with a lighter claim-review queue and proof-first moderation workbench
- separate library mode for approved canonical exercises
- contained create/edit sheet instead of nested modal chaos

Visual priorities:

- strong state clarity
- high-signal review actions
- technical confidence without becoming cold or unreadable
- more industrial than playful
- milestone tab should feel calmer and more trust-oriented than the exercise review tab without becoming playful

## Risks To Avoid

- turning the page into a generic admin table
- mixing milestone claims directly into the exercise publish queue
- overfitting the UI to the current prototype AI pipeline
- auto-publishing custom exercises with weak review controls
- letting the page drift into AI-chat product language
- letting the milestone tab become so feature-heavy that it quietly deserves its own page without a deliberate product decision

## Recommended Implementation Order

1. Lock the backend and frontend state contract.
2. Build the review queue.
3. Add the milestone moderation tab with the existing seeded review flow.
4. Build canonical create and edit flows.
5. Build the global library mode.
6. Wire richer mobile submission and future AI signals later.

## Page-By-Page Handoff Rule

After this contract is accepted, the next step should be a normal page-level premium run using the existing setup:

1. page contract locked
2. references for this page family only
3. Notion review packet
4. Figma concept and scaffold
5. later implementation

This page should be the first proving ground, not another planning-only exercise.
