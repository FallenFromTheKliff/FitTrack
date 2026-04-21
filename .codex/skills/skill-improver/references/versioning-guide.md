# Skill Versioning Guide

Use this guide when updating any repo-local skill under `.codex/skills/`.

## Backup rule

- Before changing `SKILL.md`, create `SKILL.v{N}.md`.
- Increment `N` from the highest existing version in the folder.
- Keep the backup in the same skill directory for fast rollback.

## Changelog rule

Prepend a short changelog section near the top of `SKILL.md`:

```md
## Changelog
- v2: tightened auth gap guidance after repeated 401 handling misses (2026-04-09)
```

Rules:

- newest entry first
- one line per revision
- describe the failure prevented, not the editing process

## What should change together

Update these together when relevant:

- `SKILL.md`
- `examples/bad-outputs.md`
- `examples/good-outputs.md`
- the smallest affected file under `references/`
- `agents/openai.yaml` only if trigger behavior changed

## Rollback rule

- If the latest skill update makes outputs worse, restore from the newest `SKILL.v{N}.md`.
- Re-run the failure analysis before trying a second patch.
- Do not stack multiple broad rewrites without isolating the original mistake.
