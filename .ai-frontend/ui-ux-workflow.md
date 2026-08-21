# UI/UX Workflow Rules

These rules migrate the general UI/UX instructions from the Notion page `FitTrack - UI/UX Enhancements` into local `.ai-frontend` guidance. This file is the default execution source for UI/UX workflow rules; Notion is not required unless the user explicitly asks to read a Notion page or specific design notes.

## Local Source Priority

- Read this file for UI/UX enhancements, redesign work, visual polish, layout changes, page/screen rebuilds, and component design changes.
- Use `.ai-frontend/style.md`, `.ai-frontend/component-rules.md`, `.ai-frontend/performance.md`, and `.ai-frontend/context-protection.md` for the deeper implementation rules behind this workflow.
- Source files, shared contract packages, and current frontend usage decide implementation truth.
- User-provided screenshots, Figma references, or explicitly requested Notion redesign pages can guide visual intent, but they do not replace working data, contracts, permissions, mutations, or route behavior.
- Do not read Notion for UI/UX rules by default. Read Notion only when the user explicitly asks for Notion notes, design pages, or a named Notion source.
- Treat Notion UI/UX sources as read-only unless the user explicitly asks to update Notion and the page is writable.

## Before UI/UX Changes

- Classify the target surface before acting: web-only, mobile-only, shared-package-only, frontend-contract-investigation, or explicitly requested cross-surface.
- For `/goals`, apply `.ai-frontend/goals-mode.md` before doing any UI/UX work.
- Inspect the current page/screen and nearby components before changing structure.
- Preserve existing backend integration, query wiring, mutations, permissions, role behavior, and dynamic data.
- Redesign references describe the visual direction; the current app provides feature and data truth.
- Keep `page.tsx` and mobile screen files as the body assembly point for their surface; do not move the entire body into one separate component.
- Do not replace dynamic or API-backed values with static or hardcoded values.
- Placeholder or default values are allowed only for brand-new user-requested features that do not yet have backend endpoints.
- Do not redesign unrelated pages, screens, components, or flows unless the user explicitly asks.
- If runtime verification is explicitly requested, keep it bounded by `.ai-frontend/goals-mode.md` and `.ai-frontend/performance.md`.

## During UI/UX Changes

- Apply redesigns as the new visual architecture while inheriting all necessary current functionality, controls, data, and state behavior.
- If a redesign lacks containers, sections, controls, or cards needed for existing functionality, create the missing UI while matching the local design system.
- Build pages and screens from precise components: Fit primitives, sections, panels, forms, tables, modals, drawers, and feature-specific slices instead of full-page content containers.
- Keep themes, colors, spacing, sizing, margins, padding, and density consistent across pages/screens and modals.
- Use the available page/screen space intentionally. Avoid narrow centered layouts that leave large unused side areas unless the route's content genuinely requires that shape.
- Keep edge spacing deliberate so content feels full without visually stretching into the viewport edges.
- Keep text, controls, cards, and modal contents away from edges and borders.
- Avoid avoidable modal scrolling; when scrolling is necessary, make it deliberate and preserve clear actions.
- Use dynamic theme/style systems instead of hardcoded styles that conflict with FitTrack themes.
- Follow the user's requested design direction without reinterpreting it into an unrelated UI pattern.

## Web Page Rules

- The public landing page is the pre-auth web entry and should carry only enough content for visitors and potential clients.
- The authenticated web app uses the layout shell as the overall structure: background/content area plus navigation sidebar.
- Each admin page renders its own page header as the top row of the content area, with title/subtitle behavior kept consistent with the current shell.
- Web content should adapt for both desktop browsers and mobile browser widths.
- Sidebar navigation may collapse into hamburger or grouped navigation at constrained widths when that matches the existing shell.
- Preserve established web navigation labels. Current admin labels include `Accounts`, `Gym Actions`, and `Gym Memberships` for memberships/promotions surfaces.
- Role-based access is part of the product model; preserve admin, staff, coach, member, and non-member behavior where it already exists.
- Sub-pages or page-local detail views that are not sidebar destinations should provide a clear back path near the top of the view.

## Mobile Screen Rules

- The splash screen is the app startup/return entry surface.
- Login is the technical first screen before authentication.
- After authentication, preserve the current navigation/session behavior for returning to the last appropriate main screen.
- Keep mobile screens less dense than web while still preserving the same product capabilities where applicable.
- Use the mobile FAB pattern for screen-wide actions when it prevents clutter and matches the existing screen architecture.
- Mobile responsive behavior must work beyond the native-web test width; do not assume a fixed production width.
- Do not launch Android Emulator by default. Use it only when the user explicitly requests emulator verification.

## Visual Evidence And Screenshots

- Use screenshots only when the user explicitly requests runtime or visual verification, or when the task explicitly requires visual comparison.
- Follow the Safe Goals Mode screenshot budget: one screenshot per verification iteration, maximum three failed iterations, then summarize blockers.
- When a task asks for before/after UI screenshots, store them under `.screenshots` and keep only the most recent relevant before/after set for that task.
- Do not use `.screenshots` as design source truth in later tasks. It is developer review evidence, not the canonical design reference.
- Do not keep retrying visual checks indefinitely.

## Test Data And Secrets

- Use project-provided seeded credentials only when they are already available through approved local docs, explicit user instruction, or an allowed source for the current task.
- Do not invent credentials.
- Do not copy secrets from Notion, `.env`, logs, screenshots, or config into chat or docs.
