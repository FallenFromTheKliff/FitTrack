# FitTrack Codex Overlay

This repository is FitTrack. Its durable project workflow lives in the global `fittrack-orchestrator` skill, which verifies FitTrack identity and routes each request to exactly one FitTrack leaf module.

## Local routing

- For FitTrack implementation, review, integration, or verification work, use the global `fittrack-orchestrator` hub and its single selected leaf module.
- The prior full FitTrack operating model is preserved verbatim in that hub's `references/repo-operating-model.md` and in the dated global archive.
- Preserve unrelated user and concurrent-worker changes; do not revert or clean up work outside the active request.

## Repository-bound configuration

- Keep `.codex/agents/` active. These agent definitions and `agent-index.md` remain FitTrack-specific.
- Keep the Graphify and Storybook MCP blocks in `.codex/config.toml` active and path-bound to this repository.
- Generic `[agents]` runtime limits are defined once in the global Codex configuration.

## Scope

Do not use FitTrack guidance outside this repository. Do not access credentials, production systems, remote databases, or deployment controls unless the active request explicitly authorizes them.

## Luna/Terra delivery defaults

- Do not use parallel execution or a faster service tier unless the user explicitly requests it.
- Luna owns bounded implementation work at Max reasoning; Terra owns the independent Max QA sweep.
- Implement the complete scoped batch first, then run QA, then make one grouped repair pass and recheck failed criteria.
- Use Serena for focused symbol discovery; use Graphify only when dependency coupling is unclear.
- For browser evidence use Chrome DevTools for DOM, console, network, accessibility, and performance checks; use native browser/Playwright and screenshots for user-visible mobile behavior.
