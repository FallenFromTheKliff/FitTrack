# Legacy Archive: Execute Seeded Tasks

This file is retained only as a legacy archive note.

The active integration driver no longer uses a separate seeded-task execution mode.
Use these active docs instead:

1. `tasks/integration-builder/integration-driver.md`
2. `tasks/integration-builder/integration-driver/03-runtime-core.md`
3. `tasks/integration-builder/integration-driver/12-domain-task-flow.md`
4. `tasks/integration-builder/integration-driver/11-run-mode-integrate-domain-journeys.md`
5. `tasks/integration-builder/integration-driver/07-playwright-verification.md` when browser verification is needed

Current behavior:

- task pages are seeded during the domain `seed` phase
- new task pages receive `Review` and `Plan` immediately
- implementation then executes those seeded tasks sequentially inside the active domain
