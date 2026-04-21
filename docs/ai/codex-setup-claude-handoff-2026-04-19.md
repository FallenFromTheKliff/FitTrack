# Codex Setup Handoff For Claude

Date: 2026-04-19
Repo: `C:\Users\HOUSTON\Desktop\Capstone Shenaniggans\FrontendIntegration_0329\FitTrack_rebuilt_20260330_212527`
Primary Codex config: `C:\Users\HOUSTON\.codex\config.toml`
Local skills root: [`.codex/skills`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills)

## Purpose

This document extracts the current Codex setup, available skills, and the behavior they create in practice so Claude can improve the system intentionally instead of inferring it from scattered chat history.

Short version:

- The setup is already strong on orchestration, guardrails, runtime verification, and premium-route process.
- The weak point is not lack of rules. The weak point is that the UI/UX lane is still more constraint-heavy than taste-heavy.
- Claude should improve the system by adding stronger positive design guidance, component-level visual playbooks, and clearer premium heuristics for composition, density, typography, and motion.

## 2026-04-19 One-Shot UI/UX Upgrade

The intended premium-admin flow is now documented in [professional-uiux-one-shot-playbook.md](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/docs/ai/professional-uiux-one-shot-playbook.md).

The upgraded target behavior for high-visibility admin page work is:

1. scan the live page and repo route states
2. scan the route's real feature inventory
3. pull exact Figma references plus narrow Exa component benchmarks
4. create a collaborative child page under `Q&A God Tier Automation`
5. wait for the checkbox `Approved to scaffold and implement this direction` on collaborative runs
6. build the Figma scaffold
7. implement the page 1:1 from that scaffold, adapting only FitTrack-native theming and settings-driven skinning
8. add restrained dynamic polish after scaffold fidelity is already correct

This is the most important behavioral upgrade because it changes the premium lane from "review and improve" into "approve direction, scaffold it, then implement it faithfully."

Note: this session could not write directly into `.codex/skills/` because of sandbox restrictions, so the exact skill-upgrade instructions live in docs and should be mirrored into the skill files in a writable session.

### Exa benchmark decision

Exa research for FitTrack's admin member and record-management surfaces points to:

- `Attio` as the best default external benchmark
- `Linear` as the best secondary benchmark

Why this matters:

- `Attio` maps directly to people and record workflows: rows, record pages, top highlights, actions, tabs, and right-sidebar sections.
- `Linear` is the stronger supplement for dense list behavior, filters, display-property discipline, and fast preview mechanics.
- Generic admin-template roundups are a weaker lane for this setup and should not be the default quality bar anymore.

## 1. Runtime Setup

### Model and execution defaults

- Model: `gpt-5.4`
- Reasoning effort: `xhigh`
- Approval policy: `never`
- Sandbox mode: `workspace-write`
- Project trust: trusted for this repo
- Windows sandbox setting in config: `elevated`

### MCP and tool setup from `config.toml`

- `serena`
  - Primary codebase discovery and symbolic navigation tool.
  - Strongly shapes behavior because the session pushes Serena-first exploration before broader file reads.
- `context7`
  - Used for official or up-to-date library documentation when implementation details matter.
- `prismaRemote`
  - Remote Prisma MCP.
- `prismaLocal`
  - Local schema and database truth checks via Prisma MCP.
- `github`
  - GitHub MCP configured through `GITHUB_PAT_TOKEN`.
- `notion`
  - Available and plugin-enabled.
- `playwright`
  - Configured against repo-local `.playwright-mcp.json`.
  - Browser permissions include camera and microphone.
- `swagger`
  - Configured against local API docs at `http://127.0.0.1:3001/v1/docs-json`.
- `figma`
  - Available and plugin-enabled.
- `chromeDevtools`
  - Uses isolated Chrome DevTools MCP.
  - Currently configured with `--headless --isolated`.
  - Important nuance from recent live work: headless is acceptable now because page-control tools are available.
- `postgresReadOnly`
  - Raw SQL truth check lane against local Postgres.
- `sentry`
  - Available.
- `exa`
  - Available for external research and product-pattern lookup.
- `magicUI`
  - Available for motion or microinteraction inspiration and registry lookup.

### Enabled plugins

- `notion@openai-curated`
- `figma@openai-curated`

### Global or system skills available from `C:\Users\HOUSTON\.codex\skills\.system`

- `imagegen`
- `openai-docs`
- `plugin-creator`
- `skill-creator`
- `skill-installer`

## 2. Session-Level Behavior That Is Not File-Backed But Matters

These behaviors are not primarily coming from repo files. They come from the current Codex runtime instructions and materially affect output quality.

### Collaboration behavior

- Warm, supportive, ownership-heavy collaborator.
- Expected to make reasonable assumptions and keep momentum.
- Expected to send short progress updates while working.
- Expected to persist end-to-end instead of stopping at analysis.

### Coding behavior

- Inspect the codebase first instead of jumping to conclusions.
- Prefer Serena for discovery and symbol-level understanding.
- Prefer `rg` for search.
- Parallelize reads when safe.
- Use `apply_patch` for file edits.
- Avoid destructive git behavior.
- Do not revert unrelated user changes.

### Frontend taste instructions already present in the session

- Avoid generic "AI slop" UI.
- Preserve existing product or design language when a system already exists.
- Use intentional typography, color direction, and motion.
- Avoid boilerplate dashboards and generic card piles.
- Motion should be meaningful and restrained.
- On premium surfaces, structural quality comes before animation.

### Response behavior

- Final answers are meant to be concise.
- Intermediate updates are frequent.
- For reviews, findings should come first.

## 3. Local FitTrack Skill Architecture

These are the repo-local skills currently available under [`.codex/skills`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills).

### Core implementation and orchestration skills

- `integration`
  - End-to-end orchestrator skill.
  - Coordinates frontend, backend, UI polish, QA, Notion, Prisma, DevTools, Playwright, Swagger, Figma, Exa, and Magic UI.
  - Very process-rich and phase-driven.
  - Forces premium-gap review and route-rebuild gates for important UI surfaces.
- `frontend`
  - Owns implementation of web or mobile UI, controllers, helpers, query wiring, forms, auth flows, and runtime polish.
  - Strong on reusability, route structure, thin surfaces, and FitTrack-native implementation patterns.
  - Explicitly says UI shape should be settled before wider backend or shared-client work.
- `backend`
  - Owns NestJS, Prisma, DTO, controller, service, and backend refactor work.
- `quality-assurance`
  - Owns final verification.
  - Strong verification order and honest closure rules.
- `stack-orchestration`
  - Local dev-stack startup, shutdown, and status flows.
- `security-hardening`
  - Auth, permissions, sensitive-data, and security review lane.

### UI, product, and premium-direction skills

- `frontend-uiux-polish`
  - Main visual-polish skill.
  - Owns layout, spacing, hierarchy, motion quality, modal quality, adaptive layout, and surface consistency.
  - Very strong on premium admin-surface critique and anti-bloat enforcement.
  - Uses Figma and Magic UI as reference lanes when appropriate.
- `premium-route-rebuild`
  - Route-wide rebuild packet skill for high-visibility surfaces.
  - Forces live audit, state inventory, operator-first feature scan, keep-replace-remove-add matrix, Figma wireframe gate, and Notion decision gate.
  - Strongest "do not patch endlessly, rebuild correctly" skill in the setup.
- `brainstorm`
  - Used when surface or feature shape is still fuzzy.
  - Good for holes, constraints, options, and MVP cuts.
- `system-adapt`
  - Converts generic ideas into FitTrack-native product behavior and couplings.
  - Prevents feature or module sprawl.

### AI or domain-specialized skills

- `ai-contract-core`
- `ai-chatbot-systems`
- `business-analytics-ai`
- `ml-pose-tuning`

These are less relevant to the current UI/UX quality problem, but they show that the system already has strong domain specialization.

### Meta-maintenance skill

- `skill-improver`
  - Explicit-only maintenance skill for fixing weak skills surgically.
  - Important for Claude because it encodes the intended maintenance philosophy:
  - patch the narrow failing section
  - preserve boundaries
  - avoid full rewrites unless the problem is structural

## 4. UI/UX-Related Skill Behavior In Practice

This is the most important section for Claude.

### `frontend-uiux-polish` behavior

What it does well:

- Starts from presentation-only diagnosis.
- Enforces premium-gap scans before polish.
- Prevents low-signal copy, oversized shell chrome, dead headers, and bloated admin layouts.
- Explicitly prefers stronger interaction models when legacy patterns are weak.
- Forces comparison between default route state and polished child modes.
- Treats motion as the finisher, not the fix.
- Encourages component-level reference work instead of vague "make it premium" drift.

What it currently emphasizes:

- Guardrails
- removal discipline
- reference-lane honesty
- premium blockers
- component replacement freedom when justified
- motion timing discipline

What it still lacks:

- More positive taste recipes for what excellent FitTrack UI should look like.
- More concrete guidance on:
  - typography scales
  - density targets by surface type
  - row or card anatomy
  - command bar composition
  - inspector composition
  - empty-state tone
  - spacing rhythm
  - contrast thresholds
  - icon usage discipline
  - premium table and pagination patterns

### `frontend` behavior

What it does well:

- Keeps route files thin.
- Pushes orchestration into hooks, helpers, and controllers.
- Encourages reuse and safe extraction.
- Preserves FitTrack-native theme and system patterns.
- Explicitly rejects bloated pages and generic one-off UI.

What it currently emphasizes:

- architecture safety
- reusability
- repo conventions
- shared-client compatibility
- runtime polish and verification defaults

What it still lacks for professional-feel UI:

- It is implementation-strong but not highly taste-opinionated.
- It helps avoid bad structure better than it teaches great composition.

### `premium-route-rebuild` behavior

What it does well:

- Stops endless patch cycles.
- Forces route-level thinking rather than isolated component tweaks.
- Makes Figma and Notion decision gating first-class.
- Uses keep-replace-remove-add checkpoints to prevent inertia.

What it currently emphasizes:

- route state inventory
- operator-first flow design
- coordinated route grammar
- implementation slices and QA gates

What it still lacks:

- More concrete design-system-level recipes for what the wireframes should feel like once created.
- It is excellent at forcing the rebuild process, but still depends on human taste quality in the reference lane.

### `integration` behavior

What it does well:

- Strong orchestrator.
- Good at sequencing audit, redesign, implementation, QA, and sync.
- Strong premium-gap enforcement across the whole stack.

What it currently emphasizes:

- process correctness
- orchestration discipline
- explicit routing between skills
- verification completeness

What it still lacks:

- More lightweight "taste escalation" triggers.
- It can successfully orchestrate a premium workflow while still producing outputs that are technically disciplined but not visually elite enough.

## 5. Plugin Skill Families That Matter For Premium UI Work

### Figma plugin lane

Relevant available skills from the session:

- `figma:figma-use`
- `figma:figma-generate-design`
- `figma:figma-generate-library`
- `figma:figma-implement-design`
- `figma:figma-code-connect`
- `figma:figma-create-design-system-rules`
- `figma:figma-create-new-file`

Current value:

- Strong for wireframe gates, design context, component search, and design-to-code work.
- Essential for the premium-route-rebuild lane.

Current weakness:

- The setup has a Figma lane, but the skill system does not yet encode enough "what good looks like" at the component recipe level.

### Notion plugin lane

Relevant available skills from the session:

- `notion:notion-knowledge-capture`
- `notion:notion-meeting-intelligence`
- `notion:notion-research-documentation`
- `notion:notion-spec-to-implementation`

Current value:

- Strong for recommendation-first decision capture.
- Supports the `Q&A God Tier Automation` workflow used during rebuild decisions.

## 6. Current Strengths Of The Whole Setup

- Strong orchestration discipline.
- Strong repo-boundary discipline.
- Strong premium-route process.
- Strong anti-bloat and anti-inertia behavior.
- Strong runtime verification and reality checks.
- Strong multi-tool environment for premium UI work:
  - Serena
  - Figma
  - Notion
  - Chrome DevTools
  - Playwright
  - Magic UI
  - Exa

## 7. Why The Current Setup Still Undershoots Professional UI/UX Feel

- The system is richer in negative constraints than in positive design taste.
- It knows how to say "do not preserve weak legacy structure," but is less explicit about what premium replacements should actually look and feel like.
- Premium quality is framed as a review bar, not yet as a reusable visual grammar.
- The setup has process for reference lanes, but not a strong enough component canon for:
  - admin tables
  - row anatomy
  - dense but elegant control bars
  - inspector or detail surfaces
  - split-view balance
  - empty or loading states
  - restrained luxury in admin contexts
- Motion guidance exists, but signature motion patterns are under-specified.
- Typography guidance is still too open-ended.
- Density guidance is still too qualitative.
- There is not yet a codified "professional admin surface pack" that repeatedly produces the same level of polish.

## 8. What Claude Should Improve First

### Highest-value improvement direction

Claude should not add more generic rules. Claude should make the current premium system more taste-operational.

### Recommended upgrades

- Strengthen `frontend-uiux-polish` with positive visual playbooks, not just blocker detection.
- Add a component recipe pack for premium admin surfaces:
  - page shell
  - command deck
  - dense filter row
  - primary roster or table
  - row hierarchy
  - inspector panel
  - moderation or review rail
  - pagination
  - empty state
  - success or error feedback
- Add explicit density profiles:
  - compact admin
  - balanced admin
  - task mode
  - mobile condensed
- Add typography tokens by surface role:
  - route title
  - section title
  - eyebrow
  - support copy
  - row primary
  - row secondary
  - stat value
  - pill text
- Add stronger row or card anatomy rules:
  - information priority
  - badge-count discipline
  - row hover and selected behavior
  - action-affordance pattern
  - when to split into multi-line versus when to compress
- Add inspector sizing and composition heuristics:
  - ideal width bands
  - sticky behavior
  - internal scroll rules
  - section sequencing
  - top-block density
- Add more explicit "professional feel" benchmark references:
  - named component reference lane
  - known high-quality admin inspirations
  - component-by-component comparison templates
- Add a stronger "visual signature" layer:
  - FitTrack-specific premium cues
  - restrained motion patterns
  - contrast and elevation behavior
  - voice rules for labels and helper text

## 9. Best Strategy For Claude

- Keep the orchestration skeleton.
- Keep the premium-route-rebuild gate.
- Keep the Notion decision gate.
- Keep the Figma requirement for route-wide rebuilds.
- Keep the anti-bloat and keep-replace-remove-add discipline.
- Do not replace the system with a looser one.
- Improve the system by making premium taste more reusable and more component-specific.
- Use `skill-improver` style discipline:
  - patch surgically first
  - only redesign the skill set structurally if repeated failures keep happening after targeted upgrades

## 10. Files Claude Should Read First

- `C:\Users\HOUSTON\.codex\config.toml`
- [`.codex/skills/frontend-uiux-polish/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/frontend-uiux-polish/SKILL.md)
- [`.codex/skills/frontend/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/frontend/SKILL.md)
- [`.codex/skills/premium-route-rebuild/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/premium-route-rebuild/SKILL.md)
- [`.codex/skills/integration/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/integration/SKILL.md)
- [`.codex/skills/brainstorm/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/brainstorm/SKILL.md)
- [`.codex/skills/system-adapt/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/system-adapt/SKILL.md)
- [`.codex/skills/quality-assurance/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/quality-assurance/SKILL.md)
- [`.codex/skills/skill-improver/SKILL.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/skill-improver/SKILL.md)
- [`.codex/skills/frontend-uiux-polish/references/polish-rubric.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/frontend-uiux-polish/references/polish-rubric.md)
- [`.codex/skills/frontend/references/component-patterns.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/frontend/references/component-patterns.md)
- [`.codex/skills/frontend/references/runtime-polish.md`](/abs/path/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/FrontendIntegration_0329/FitTrack_rebuilt_20260330_212527/.codex/skills/frontend/references/runtime-polish.md)

## 11. Direct Ask For Claude

"Preserve the current orchestration quality, route-rebuild discipline, Figma/Notion gates, and anti-bloat behavior. Improve the UI/UX skill system so premium outcomes come from stronger positive design playbooks and reusable component-level taste, not just better blocker detection."
