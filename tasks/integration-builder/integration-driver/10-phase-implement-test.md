# Legacy Archive: Separate Implement And Test Phase Guide

This file is retained only as a legacy archive note.

The active integration driver no longer routes through a standalone task-mode implement-and-test guide.
Implementation and domain testing now live inside the autonomous domain flow:

- sequential task implementation is described in `tasks/integration-builder/integration-driver/11-run-mode-integrate-domain-journeys.md`
- domain task ownership and backlog behavior are described in `tasks/integration-builder/integration-driver/12-domain-task-flow.md`
- browser verification guidance lives in `tasks/integration-builder/integration-driver/07-playwright-verification.md`
