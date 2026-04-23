# Branch Policy

## DEVELOPER CONFIG (each dev sets this once locally)

my_branch = waes-lehjet-backend
role = dev + qa
shared_base = main
pr_target = main

The scripts in this skill read the first occurrence of these keys. Keep them on single lines and do not rewrite them during normal skill use.

Dev 2 uses the same block shape with their own branch value:

- `my_branch = teammate-branch`
- `role = dev`
- `shared_base = main`
- `pr_target = main`

## Team branch structure

- `main` is the canonical shared base.
- `main` is the only PR target for all developers.
- `waes-lehjet-backend` is Dev 1's personal branch and Dev 1 also handles QA on this branch.
- Dev 2 works on their own personal branch.
- There is no dedicated QA branch.

## Hard rules

- Never push directly to `main` - open a PR instead.
- Each developer pushes only to their own branch.
- PRs from personal branches always target `main`.
- Codex can push freely to `my_branch`.
- Codex never pushes directly to `main`.
- Codex never pushes to a teammate's branch.
- If GitHub MCP is available, Codex should open the PR through GitHub tooling.
- If GitHub MCP is not available, Codex should remind the developer to open the PR manually on GitHub.

## Daily sync

- Fetch remote refs.
- Update local `main`.
- Switch back to `my_branch`.
- Merge `main` into `my_branch`.
- Never rebase in this workflow.

## Dev 1 QA rules

- Dev 1 uses `waes-lehjet-backend` for both development and QA revisions.
- QA revisions stay on the same branch.
- QA revisions still follow the PR path: `waes-lehjet-backend -> main`.
- QA revisions do not get lighter gates.
