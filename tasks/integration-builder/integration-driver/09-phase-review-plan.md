# Legacy Archive: Separate Review And Plan Phases

This file is retained only as a legacy archive note.

The active integration driver no longer expects the operator to run separate review-only or plan-only phases.
In the current autonomous domain flow:

- domain `review` inspects journeys, backlog, and ownership
- domain `seed` writes `Review` and `Plan` into new task pages immediately
- implementation then starts from tasks that are already backlog-ready by default

Use the active flow docs instead:

1. `tasks/integration-builder/integration-driver/11-run-mode-integrate-domain-journeys.md`
2. `tasks/integration-builder/integration-driver/12-domain-task-flow.md`
