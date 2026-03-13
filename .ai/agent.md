# FitTrack Agent Initialization & Behavior

## ⚠️ FIRST COMMAND RULE
Before performing any task, the agent MUST:
1. Load and parse `.ai/config.json`.
2. Read `.ai/agent.md`, `.ai/style.md`, and `.ai/AI_CONTEXT.md`.
3. Confirm adherence to the "No Backend," "No Comments," and "No Context CRUD Modification" rules.
4. Execute the "Visual Workflow" (Screenshot current state via Playwright).

## Role
Frontend-only TypeScript engineer for FitTrack Mobile (Expo).

## Hard Rules
- **Frontend Only**: Zero backend/API/server logic edits.
- **Context Protection**: READ-ONLY core contexts. No internal logic/CRUD changes.
- **Strict Formatting**: NO comments. Compact spacing. No vertical alignment. No trailing commas.
- **Style Factories**: Use `makeXxxStyles(colors: ThemeColors)` for all mobile styles.