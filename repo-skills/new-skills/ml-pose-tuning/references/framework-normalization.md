# Framework Normalization

## Goal

Project provider-specific landmarks into a shared feature layer so exercise logic does not need to be rewritten for every tracker.

## Shared feature layer

- normalized joint angles
- segment ratios relative to body proportions
- side confidence and visibility
- bilateral symmetry cues
- temporal smoothing and phase persistence

## Provider guidance

- MediaPipe usually provides richer landmark coverage but still needs visibility-aware gating.
- MoveNet-like native providers may have fewer landmarks or different confidence characteristics, so provider-specific tolerance should sit beneath the shared movement contract, not replace it.
- Keep the exercise rules expressed in the shared feature layer whenever possible.
