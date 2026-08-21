---
name: ml-pose-tuning
description: "Use for FitTrack pose and rep-intelligence work involving exercise classification, fallback or local counting, confidence thresholds, ROM calibration, pose taxonomy, finalize-time unknown classification, or cross-provider tuning between MediaPipe and MoveNet-like landmark providers. Use when the task touches the workout pose pipeline but must still preserve the rule that the live loop stays vision-only."
---

# FitTrack ML Pose Tuning

Use this skill for pose-tracking and rep-detection tuning across FitTrack's workout intelligence surfaces.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `context/python/s15-pose-estimate.md`
  - `context/python/00-python-microservice-contracts.md`
  - `references/framework-normalization.md`
  - `references/rom-calibration.md`
  - the active web or native pose analyzer and the active backend pose contract files
- Confirm the provider and execution path:
  - browser MediaPipe
  - Python-side MediaPipe
  - native-mobile MoveNet-like or similar landmark provider

## Non-negotiable boundaries

- Keep the live loop vision-only.
- Never introduce OpenRouter or another LLM into real-time frame analysis.
- Use strict JSON only for finalize-time unknown exercise classification or other explicitly offline classification paths.
- Preserve Nest ownership of session lifecycle, auth, and persistence.
- For exercise creation from observed reps, use `ai-contract-core` and its pose exercise creation contract before tuning domain thresholds.

## MCP routing

- Serena is required for code and contract discovery.
- Prisma Local is required when pose profiles, seeds, learned profiles, or DB-backed invariants can change runtime truth.
- Swagger and Playwright are verification MCPs only and must not replace direct contract and runtime checks.

## Workflow

1. Identify the provider, execution path, and exercise family.
2. Build or confirm the normalized kinematics layer before exercise rules are tuned.
3. Define the movement contract for the exercise.
4. Tune ROM, confidence, visibility, and phase-transition rules.
5. Verify full reps, realistic reps, partials when allowed, occlusion/noise, and false-positive prevention.
6. Emit a compact tuning artifact with the chosen bands, rules, and known failure cases.

## Exercise creation from reps

When three observed reps are used to propose a new exercise profile:

- Require one locked subject and exactly three representative completed reps.
- Derive side-specific and spatial evidence before prompting: left/right joint angles, body x/y travel, body-line stability, phase timing, visibility, and equipment context.
- Do not let one-arm evidence become a normal bilateral exercise. Mark it degraded, occluded, or a unilateral candidate.
- The AI output must be a strict JSON proposal, not final persisted truth.
- Nest/backend validation owns final exercise creation, moderation status, difficulty tier, EXP multiplier, and conflict handling.

## Normalized movement contract

Define ROM and rep logic through a normalized movement contract rather than one raw threshold:

- canonical joints and segments
- primary movement direction
- minimum useful travel band
- full-rep band
- optional partial-rep acceptance band
- confidence and visibility requirements
- phase persistence or streak requirement
- setup and rest-state rejection rules

## Framework-normalized kinematics

- Map MediaPipe and MoveNet-like providers into the same abstract feature layer:
  - joint angles
  - normalized segment lengths
  - side symmetry expectations
  - landmark quality and visibility
  - temporal smoothing assumptions
- Use provider-specific tolerances only after the abstract feature layer is stable.

## Anti-failure rules

- Prevent too-short-ROM false reps with minimum travel, direction-consistent phase changes, and short persistence windows.
- Prevent too-intense-ROM missed reps with exercise-specific adaptive bands instead of one exact target.
- Allow consumer-fitness partial reps only when the product explicitly wants them.
- Treat one-sided occlusion as a recoverable state when dominant-side tracking can still be trusted.

## Output defaults

- Return the provider, exercise, movement contract, ROM bands, confidence rules, partial policy, and verification cases.
- State which behavior is full rep, partial rep, unreliable, or no-count.
