# Legacy Archive: Scan And Seed

This file is retained only as a legacy archive note.

The active integration driver no longer uses a separate scan-only execution path.
Use these active docs instead:

1. `tasks/integration-builder/integration-driver.md`
2. `tasks/integration-builder/integration-driver/03-runtime-core.md`
3. `tasks/integration-builder/integration-driver/04-notion-contract.md`
4. `tasks/integration-builder/integration-driver/12-domain-task-flow.md`
5. `tasks/integration-builder/integration-driver/11-run-mode-integrate-domain-journeys.md`

Current behavior:

- domain review discovers the required domain-owned work
- domain seeding creates or refreshes the real owned task pages immediately
- sequential execution happens inside the same autonomous domain flow
