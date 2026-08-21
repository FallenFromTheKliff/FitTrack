# Context Recovery

Use this file when the Codex App compacts context, resumes from a summary, or appears to have lost part of the active task history. Recovery means reconstructing what was being done before continuing, not restarting the task from scratch.

## Recovery Triggers

Apply this workflow when:

- the conversation was compacted or summarized;
- the agent resumes after a long pause or context transition;
- the visible thread no longer contains the full task details;
- the current files contain edits whose intent must be re-established before more work.

## Recovery Order

1. Read the newest user message first and let it override older intent.
2. Read the available compacted summary or visible thread context.
3. Read `.ai-frontend/config.json`.
4. Read this file and the smallest relevant `.ai-frontend` rule files for the active task.
5. Check local state with `git status --short`.
6. Inspect the current diff for the active scope, such as `git diff -- .ai-frontend` for rule work or `git diff -- <target>` for app/package work.
7. Re-read any touched files before editing them again.

## Reconstruct The Active Task

Before continuing, re-establish:

- the current user request and any hard constraints;
- the target classification and allowed surface;
- which files were created, edited, or intentionally left untouched;
- what behavior or rules the previous work was trying to preserve;
- which validation steps already ran;
- which validation steps were intentionally skipped or forbidden;
- known blockers, uncertainties, or user decisions;
- the remaining checklist needed to finish the task.

Do not rely only on memory after compaction. Use the current filesystem, git diff, and the latest user message as the recovery source of truth.

## Continuation Rules

- Continue from the current filesystem state instead of recreating prior edits from memory.
- Preserve user edits and pre-existing uncommitted changes unless the user explicitly asks to revert them.
- Do not broaden scope because context was compacted.
- Do not restart Docker, dev servers, browser tools, emulators, watchers, or MCP-heavy tools just to recover context.
- Do not use Serena, Playwright, ChromeDevTools, Figma, Notion, Swagger, GitHub, browser automation, Docker, or emulator access only to re-learn what the current files and git diff can show.
- For `/goals`, keep the same Safe Goals Mode target classification unless the latest user message changes it.
- If the prior state cannot be reconstructed confidently, stop and ask one concise question before editing further.

## User Updates

After recovery, give a short status update only when it helps the user understand continuity. Include what task is being continued, the active scope, and any remaining validation, without repeating the entire compacted history.
