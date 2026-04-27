# Batch 7 Pose Fixture Checklist

Use this checklist when verifying the Batch 7 pose pipeline after implementation changes.

## Push-up fixtures

- Clean bilateral push-up: counts one rep at the top lockout once the concentric press reaches full extension.
- Shallow push-up: should stay `needs_more_evidence` or no-count when ROM is too small.
- One-arm push-up attempt: should not count as a clean bilateral push-up.
- Push-up with hips sagging: should surface body-line failure or degraded tracking.
- Push-up with left/right timing mismatch: should surface phase desync and avoid clean count.

## Bicep curl fixtures

- Clean dumbbell curl: counts one rep at peak contraction once the curl reaches the top squeeze.
- Fast but controlled curl: should still count when the ROM crosses the relaxed but valid thresholds.
- Empty-hand curl on a weighted exercise: should no-count with `equipment_required` or `equipment_provider_unavailable`.
- Curl with excessive hip swing: should no-count or mark degraded because stability is lost.
- Alternating left/right curls: should count per completed top contraction without forcing bilateral symmetry.

## Subject-lock fixtures

- Manual lock then record: tracking should stay bound to the locked subject.
- Rock-and-roll sign while unlocked: progress UI appears and locks after the hold duration.
- Rock-and-roll sign while already locked: no relock or unlock should trigger.
- Locked subject leaves frame: tracking should degrade or pause rather than drifting to bystanders.

## Provider fixtures

- Hosted equipment detection configured: weighted exercises should wait for compatible load evidence before counting.
- Hosted equipment detection missing: weighted exercises should fail closed with a clear status message.
- Bodyweight exercise with missing provider: rep counting should continue because no equipment is required.

## Future-profile placeholders

- Dip: requires bilateral elbow motion plus vertical body travel and should count at the top lockout.
- One-arm push-up candidate: unilateral review path plus elevated difficulty/EXP recommendation.
