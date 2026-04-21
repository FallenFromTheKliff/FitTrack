# Tracker Hierarchy

Use this reference to avoid mixing the FitTrack integration trackers together.

## Canonical roles

- `Task Queue`: live execution board for current work
- `Surface Verification Tracker`: runtime evidence and surface completion state
- `Integration Map and Accomplishments`: seeded snapshot of system state and completed milestones
- `Refactor Requests`: durable intake for structural cleanup or non-urgent product follow-up

## Practical rule

- if you are deciding what to work on now, start from `Task Queue`
- if you are proving runtime behavior, update `Surface Verification Tracker`
- if you are summarizing what the system now supports, update `Integration Map and Accomplishments`
- if the issue should not block the current bundle, log it in `Refactor Requests` or a domain follow-up page

## What to avoid

- treating the integration map as the live task board
- closing a surface without evidence in the verification tracker
- burying current blockers only in repo notes when the Notion boards are supposed to carry live state
