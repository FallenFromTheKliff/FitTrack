# Admin handoff

## Interrupted bounded task — current state

- The milestone admin route is `apps/web/app/(auth)/milestones/page.tsx` (`/milestones`). It was inspected but not edited in this run.
- The requested `05-backend-handoff.md`, `15-contract-handoff.md`, and `25-admin-handoff.md` files were not present in the workspace at inspection time. This file is therefore a newly recorded handoff rather than an append to an existing file.
- The available milestone source of truth that was read was `docs/ai/milestones-page-contract.md`.
- Existing uncommitted changes were observed in `packages/types/fitness.ts` and `packages/api-client/domains/fitness.ts`; they were preserved and not modified.
- Backend behavior inspected: milestone definitions normalize to automatic verification with no evidence requirement; automatic unlock conditions require a canonical condition payload containing `target`, `value`, `min`/`max`, `all`, or `any`; managed progression icons accept allowlisted library keys or a user-owned raster asset.
- Backend upload behavior inspected: `/files/upload` accepts managed `image/jpeg`, `image/png`, and `image/webp` images; SVG is rejected, and managed icon content/signature/ownership is revalidated when the milestone is saved. The configured default upload limit is 25 MiB.
- The current page already displays automatic evaluation text and contains an unreachable, commented legacy evidence inspector. Its live draft still uses reward-payload badge icon fields, does not wire the milestone `icon_kind`/`icon_key`/`icon_asset_key` contract, and retains hidden verification/evidence query state.
- No source implementation was completed. No tests, typechecks, or lint commands were run.

## Deferred implementation items

1. Add allowlisted library icon selection using the shared progression icon keys and render the selected icon in the rule list, details inspector, and create/edit preview.
2. Add managed custom icon upload through the existing web image-upload client with PNG/JPEG/WebP-only client validation, explicit SVG rejection messaging, upload-pending state, managed preview, and upload/API error state.
3. Wire milestone API-client mapping and payload fields for `icon_kind`, `icon_key`, and `icon_asset_key` without touching backend, seeds, mobile, Ranking Governance, or Exercise Labs.
4. Make create/edit always submit and visibly explain the canonical automatic condition derived from metric plus target; remove obsolete verification/evidence controls and pending-review presentation from the live admin flow.
5. Preserve the existing FitTrack modal and dynamic validation behavior, then run focused web typecheck/lint or available tests and append their actual results here.
