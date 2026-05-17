# FitTrack Agent Prefabs

Project-scoped custom agents live in this folder as standalone TOML files. Skills hold workflows; custom agents hold role behavior, ownership rules, and compact return packets.

Shared operating rules:
- Max 3 active agents per batch.
- Close completed workers before launching more.
- Workers are not alone in the codebase: do not revert, overwrite, or clean up edits made by others.
- Respect the owned write scope in each assignment packet.
- Subjective, risky, or major UI layout work should go through tiered layout approval before integration or schema work unless a contract change is required to unblock the UI. Tiny polish can proceed directly.
- Browser/runtime async workers may run long verification tasks and return what works, what does not, and evidence without taking over broad implementation.

Available agents:
- `frontend-worker.toml`: scoped web/mobile frontend implementation.
- `backend-worker.toml`: scoped NestJS, API, auth, service, and persistence implementation.
- `ui-layout-worker.toml`: UI-first layout approval, route composition, and premium structure packets.
- `browser-runtime-worker.toml`: local browser/runtime verification and evidence collection.
- `debugger-worker.toml`: bounded 3-attempt root-cause debugging with same-gate reruns.
- `qa-worker.toml`: final verification, focused regression sweeps, and risk reporting.
- `railway-worker.toml`: Railway build, start, healthcheck, and production runtime failures.
- `schema-contract-worker.toml`: Prisma, DTO, client, API, and UI data-shape sync.
- `research-worker.toml`: focused research packets with sources or local references.
- `skill-worker.toml`: explicit, surgical skill maintenance when granted.
