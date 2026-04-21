# FitTrack Skill Rollout Staging

This folder stages the god-mode multi-agent skill system in a writable repo path because `.codex/skills` is write-blocked in the current environment.

## Layout

- `core-overlays/`
  - replacement `SKILL.md` files for existing repo-local skills
  - copy these files over the matching `.codex/skills/<skill-name>/SKILL.md` targets when the skill path is writable again
- `new-skills/`
  - full new skill folders with `SKILL.md`, `agents/openai.yaml`, `references/`, and `examples/`
  - copy these folders into `.codex/skills/` when the skill path is writable again

## Intended targets

- `repo-skills/core-overlays/integration/SKILL.md` -> `.codex/skills/integration/SKILL.md`
- `repo-skills/core-overlays/integration/agents/openai.yaml` -> `.codex/skills/integration/agents/openai.yaml`
- `repo-skills/core-overlays/frontend/SKILL.md` -> `.codex/skills/frontend/SKILL.md`
- `repo-skills/core-overlays/frontend/agents/openai.yaml` -> `.codex/skills/frontend/agents/openai.yaml`
- `repo-skills/core-overlays/backend/SKILL.md` -> `.codex/skills/backend/SKILL.md`
- `repo-skills/core-overlays/backend/agents/openai.yaml` -> `.codex/skills/backend/agents/openai.yaml`
- `repo-skills/core-overlays/frontend-uiux-polish/SKILL.md` -> `.codex/skills/frontend-uiux-polish/SKILL.md`
- `repo-skills/core-overlays/frontend-uiux-polish/agents/openai.yaml` -> `.codex/skills/frontend-uiux-polish/agents/openai.yaml`
- `repo-skills/core-overlays/quality-assurance/SKILL.md` -> `.codex/skills/quality-assurance/SKILL.md`
- `repo-skills/core-overlays/quality-assurance/agents/openai.yaml` -> `.codex/skills/quality-assurance/agents/openai.yaml`
- `repo-skills/core-overlays/skill-improver/SKILL.md` -> `.codex/skills/skill-improver/SKILL.md`
- `repo-skills/core-overlays/skill-improver/agents/openai.yaml` -> `.codex/skills/skill-improver/agents/openai.yaml`
- `repo-skills/new-skills/*` -> `.codex/skills/*`

## Scope

This staging tree now implements or stages:

- adaptive lean multi-agent orchestration
- MCP-aware routing and verification
- hardened core skills
- new stack orchestration, security, and AI/ML skills
- normalized pose ROM guidance for current MediaPipe and future MoveNet-like providers
- `brainstorm` for practical feature and UI ideation
- `system-adapt` for FitTrack-native feature coupling and product coherence
- UI excellence, adaptive-layout, and anti-bloat enforcement across the implementation lanes

## Helper scripts

- `repo-skills/scripts/validate-staged-skills.ps1`
  - repo-local structural validation for the staged rollout
- `repo-skills/scripts/sync-to-codex-skills.ps1 -DryRun`
  - preview the live copy plan into `.codex/skills`
- `repo-skills/scripts/sync-to-codex-skills.ps1`
  - promote the staged rollout into `.codex/skills` once the target path is writable
