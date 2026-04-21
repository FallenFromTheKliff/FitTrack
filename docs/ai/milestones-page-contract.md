# Milestones Tab Contract

## Purpose

`Milestones` is the contained moderation tab inside `Exercise Lab` for FitTrack's workout-achievement and progression review flow.

It owns:

- milestone submission review
- achievement approval and rejection
- proof inspection
- reviewer notes and audit visibility
- milestone-state governance
- progression moderation for gamified workout rewards

It does **not** own:

- exercise governance or global exercise publishing
- generic member editing
- coach roster management
- booking and scheduling operations
- AI exercise detection controls

## Primary Operators

- admin
- staff

Future extension:

- coaches as reviewers only if the moderation model later expands

## Surface Family

`lab / verification` with a `progress ops` sub-variant

## Genre Fit

Must feel like:

- achievement review console
- moderation workbench
- premium gym progression operations inside the broader Exercise Lab shell
- calm, trustable, evidence-first admin UI

Must not feel like:

- playful achievements gallery
- social feed
- exercise governance lab
- generic CRM side rail
- member profile tab pretending to be a page

## Core Job Inside Exercise Lab

Decide whether a submitted milestone claim:

- gets approved
- gets rejected
- stays pending until clearer proof exists
- remains visible as closed audit history after the decision

This tab exists to moderate progression truth, not to manage workouts directly.

## Top Actions

1. Review pending milestone claims.
2. Inspect attached proof and submission context.
3. Approve or reject a milestone.
4. Record moderator notes.
5. Filter queue by status.
6. Review closed decisions for audit context.
7. Later: manage milestone definitions and thresholds if product scope expands.

## Primary Objects

- `Milestone submission`
- `Milestone definition`
- `Review decision`
- `Proof asset`
- `Reviewer note`
- `Submission status`

Later:

- `Reward payload`
- `Progression rule`
- `Abuse / fraud flag`

## Recommended States

- `Pending`
- `Approved`
- `Rejected`
- `Archived` later if old review history needs long-term retention

These are the preferred product states even if the first backend contract names them differently.

## Best Initial Shape

One contained tab with two practical states:

- `Pending queue`
- `Closed reviews`

For the first pass, the tab should focus on moderation, not milestone creation.

## What Belongs Here

- pending milestone claims
- proof preview and review
- reviewer notes
- approval and rejection actions
- status filtering
- closed review history for audit context

## What Does Not Belong Here

- exercise promotion or global publish review
- member account editing
- schedule operations
- coach roster or availability
- AI chat
- raw workout session management

## MVP Scope

- pending milestone queue
- selected-claim review workbench
- proof preview
- reviewer notes
- approve / reject decisions
- status filter
- closed review history
- shared command shell with the rest of Exercise Lab

## Deferred Scope

- milestone definition CRUD
- reward editing
- fraud scoring
- automatic rule recommendations
- milestone analytics
- bulk moderation
- coach moderation permissions

## FitTrack-Native Couplings

Immediate couplings that make the page feel like FitTrack:

- milestone submissions originate from member workout progression, not generic badges
- approved milestones should reflect real workout effort and proof
- closed decisions need enough audit context for trust and support follow-up
- the tab should link naturally back to the member record later, but the moderation flow itself should live in Exercise Lab until it grows larger

## Relationship To Neighboring Pages

- `Members`: may link to milestone history, but should not own milestone moderation
- `Exercise Lab`: owns the route, shell, and neighboring exercise-governance tab
- `Overview`: may show milestone-review counts or alerts later, but not host the workflow
- `Schedule`: unrelated except for optional future context links

## Data And Code Seams

Current nearby seams already exist in:

- `apps/web/data/members/members.ts`
- `apps/web/app/(admin)/members/MembersDashboard.tsx`
- `apps/web/app/(admin)/members/MembersReviewRail.tsx`

This means milestone moderation is not greenfield. It is an extraction and elevation of an existing moderation workflow that currently lives in the wrong page.

## UI Shape Guidance

Recommended composition:

- shared Exercise Lab command strip with a clear `Milestones` tab
- top or left pending queue
- central review workbench with proof preview and claim details
- contained closed-history mode instead of mixing closed items into the active queue
- decision modal or inline confirmation only when needed, not a giant nested workflow stack

Visual priorities:

- evidence first
- high-trust decision language
- low copy noise
- clear difference between active review and closed history

## Risks To Avoid

- leaving this flow buried inside Members
- mixing milestone moderation directly into the exercise publish queue
- making the page look playful or game-first instead of moderation-first
- overbuilding definition management before the review flow is solid
- turning review history into a noisy second feed beside the live queue

## Recommended Implementation Order

1. Extract the seeded review flow from Members into the `Milestones` tab inside `Exercise Lab`.
2. Build the pending queue and selected-review workbench.
3. Build closed review history.
4. Later: decide whether milestone definition management deserves its own route or a deeper contained mode.

## Route-Evolution Rule

After this tab contract is accepted, milestone moderation should be implemented as part of the `Exercise Lab` page-level premium run:

1. Exercise Lab route contract locked
2. milestone tab state included in references and scaffold
3. Figma tab state and workbench approved
4. later implementation

Promote milestones to a standalone page only if moderation scope grows substantially beyond claim review and closed-history audit.
