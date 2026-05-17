# FitTrack Orchestrator Routing Matrix

Use this matrix to classify FitTrack prompts before loading downstream skills. If a named skill is unavailable in the current environment, use the closest available FitTrack skill while preserving the same responsibility.

| Task category | Primary routing | Execution mode | Notes |
| --- | --- | --- | --- |
| Small question or explanation | No extra skill, or the narrow owning skill | Local-only | Answer directly after targeted reads. |
| New FitTrack feature with unclear product fit | `$system-adapt`, `$brainstorm`, then owning skill | Local-only first | Use integration only when implementation spans surfaces. |
| Large implementation plan or multi-skill request | `$fittrack-orchestrator`, then selected skills | Local-only or sidecar | Build a file ownership map before edits. |
| Request to use subagents or parallel work | `$fittrack-orchestrator` plus leaf skills | Sidecar or parallel-workers | Require permission, disjoint scopes, max 3 active workers per batch, and close completed workers before launching more. |
| Standing permission for implicit subagents | `$fittrack-orchestrator` plus `.codex/agents/*.toml` prefabs | Sidecar, async-check, or parallel-workers | Spawn without another prompt when the slice is read-heavy, verification-heavy, or has disjoint write scope. |
| Full-stack integration page or completion gap | `$integration` | Local-only or serialized | Integration remains the end-to-end owner. |
| Frontend web or mobile implementation | `$frontend` | Local-only | Add `$integration` when backend contracts are involved. |
| Narrow UI tweak or polish | `$frontend-uiux-polish`, `$frontend` | Local-only | Keep copy restrained and match existing FitTrack surfaces. |
| Subjective layout, route rebuild, ambiguous UI structure, or awkwardness risk | `layout-wireframe-gate`, `$premium-route-rebuild`, `$frontend-uiux-polish` | Serialized | Use the approval ladder: no artifact for tiny polish, layout delta packet for medium changes, screenshot/ASCII direction for high-risk composition, and static HTML only for major route/modal architecture or explicit preview requests. Do not parallelize shared layout files. |
| Premium/admin UI consultation | `$professional-ui-brainstorm`, `$premium-route-rebuild`, `$integration` | Local-only first | Use premium route flow when the page is high visibility. |
| Backend endpoint, DTO, repository, Prisma, Swagger | `$backend` | Local-only or serialized | Serialize schema, migrations, generated clients, and shared DTOs. |
| AI chatbot behavior | `$ai-chatbot-systems`, `$ai-contract-core` | Local-only | Keep grounding and schema contracts explicit. |
| Business analytics AI insight work | `$business-analytics-ai`, `$ai-contract-core` | Local-only | Use strict schema and refusal/confidence semantics. |
| Pose, reps, exercise classification | `$ml-pose-tuning` | Local-only | Preserve live-loop vision-only constraints. |
| Local stack start/stop/status, ports, blank browser | `$runtime-guardrails`, `$stack-orchestration` | Local-only | Use guardrails before killing processes or restarting stacks. |
| Live browser verification loop | `browser-runtime-loop`, Browser plugin, `$quality-assurance` | Local-only | If browser-runtime-loop is missing, use Browser plus QA evidence. |
| Long page test or runtime evidence task | `.codex/agents/browser-runtime-worker.toml`, `$browser-runtime-loop`, `$runtime-guardrails` | Async-check | Worker returns what works, what is broken, evidence, blockers, and next fix. |
| Tricky bug, failing build/test, flaky or repeated fix | `$debugger` | Local-only first | Diagnose from evidence before editing. |
| Railway deploy/build/runtime failure | `$railway-deployment`, `$debugger` | Local-only | Start from the exact failing log section. |
| Auth, permissions, payments, sensitive data, uploads | `$security-hardening` plus owning skill | Serialized | Keep shared security-sensitive files under main-agent control. |
| Final verification or review | `$quality-assurance` | Local-only | Lead with bugs and evidence; report test gaps. |
| GitHub shared branch delivery | `$gh-shared-branch-delivery` | Serialized | Merge main into the working branch without rebasing when required. |
| Official `/goal` flow | `$goals`, `$fittrack-orchestrator`, downstream skills | Follow goal config | This skill can be named by `/goal` but cannot start Goals mode. |
