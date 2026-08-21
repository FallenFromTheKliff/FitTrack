---
name: system-adapt
description: "Use for FitTrack feature adaptation when a generic idea must become a coherent FitTrack feature instead of a random module. Use it to choose the right immediate couplings, defer unnecessary ones, and keep the product feeling connected as a whole."
---

# FitTrack System Adapt

Use this skill after `brainstorm` or whenever a feature idea needs to be translated into FitTrack-native product behavior.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `references/fittrack-coupling-map.md`
  - the nearest touched route, domain, or benchmark surface
  - the `integration` skill when the output is likely to move straight into implementation
- Use Exa only when outside product patterns help evaluate realistic couplings.

## What this skill owns

- Mapping a generic idea onto FitTrack's real product loops
- Choosing the best immediate couplings
- Deferring nice-to-have couplings that would bloat the MVP
- Product coherence rules
- Recommended implementation order

## What this skill does not own

- General idea generation from scratch
- Full implementation planning
- Code changes
- Turning every feature into a giant all-systems initiative

## Workflow

1. Restate the core feature in plain product terms.
2. Identify where it naturally connects to FitTrack today.
3. If a `premium-route-rebuild` packet exists, map the approved route states into FitTrack-native behavior before discussing implementation detail:
   - landing state
   - secondary contained states
   - create or task states
   - important overlays
4. For user-facing surface revisions, state which product loops the page should emphasize, which supporting information should become secondary or lighter, and which workflows deserve a dedicated task view instead of a nested card or competing side rail.
5. Translate any approved redesign or replacement idea into FitTrack-native rules:
   - which secondary workflows must be contained
   - which navigation pattern makes the task easiest to enter, finish, and leave safely
   - which data deserves primary emphasis and which data should stay supporting
   - which default route mode still needs work even if a child mode is already strong
   - which typography or theme shifts are acceptable
   - which weak component patterns may be replaced freely without breaking FitTrack identity
    - which route states must share the same command language or visual grammar
6. Pick the 1 to 3 immediate couplings that create the strongest product feel.
7. Separate deferred couplings that are valuable but not MVP-safe.
8. Define coherence rules so the feature does not feel bolted on.
9. Recommend the safest implementation order.

## Guardrails

- Favor strong immediate fit over maximal feature count.
- If the coupling only sounds cool but does not improve product cohesion, defer it.
- Keep MVP-safe couplings narrow and believable.
- For UI-elevation work, do not bolt on gamification, analytics, or coaching panels just to make the page feel richer.
- For route-wide rebuilds, keep additions operator-first. Route growth must improve the main task, not broaden the route into a mini-suite.
- Assume brand theme, token language, and business-critical jobs are the default preservation boundary. Layout, copy, row design, filter treatment, and weak legacy interaction patterns may all be replaced when that improves FitTrack coherence.
- If a secondary operational workflow competes with the main command surface, favor tabs, toggles, lower containers, or child surfaces over a permanent side panel unless the side panel is clearly quieter than the primary workflow.
- Make the result feel like FitTrack, not like several unrelated apps glued together.

## MCP routing

- Serena is required for local system understanding.
- Exa is optional when outside product references improve coupling choices.
- Figma is optional when the system fit depends heavily on UI presentation or dashboard composition.
- For route-wide rebuilds, Figma should already hold the approved route wireframes before this skill finalizes navigation and state placement.
- `Magic UI` is optional when the system fit depends on restrained motion or interaction language after the layout direction is already chosen.
- Context7 is usually unnecessary here.

## Output defaults

- Return:
  - `Core fit`
  - `Immediate couplings`
  - `Deferred couplings`
  - `Keep / Replace / Remove / Add recommendations`
  - `Coherence rules`
  - `Secondary workflow placement`
  - `Navigation model`
  - `Route state priorities`
  - `Data rendering priorities`
  - `Theme and typography alignment`
  - `FitTrack-native replacement rules`
  - `Task-view authenticity rules`
  - `Recommended implementation order`
- Keep the answer compact enough that `integration` can act on it next.
