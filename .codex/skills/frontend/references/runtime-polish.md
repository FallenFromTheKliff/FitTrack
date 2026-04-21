# Runtime And Polish Defaults

Use this reference when a frontend task reaches verification or visible completion review.

## Auth-role defaults

Source of truth: `.playwright-fittrack-flow.json`

Web:

- login route: `/login`
- protected route: `/dashboard`
- allowed roles: `ADMIN`, `STAFF`
- denied roles: `USER`, `COACH`

Mobile Expo-web:

- login route: `/login`
- protected route in config: `/`
- expected landing usually resolves to the home tab
- allowed roles: `USER`
- denied roles: `ADMIN`, `STAFF`, `COACH`

## Visible completion defaults

- primary actions work, are intentionally hidden, or are explicitly classified as blocked
- modal-driven flows open, close, submit, and cancel cleanly
- loading, empty, error, and pending states are visible for touched async flows
- success or failure feedback appears after meaningful actions
- visible post-action state matters more than network success alone

## Polish bugs that count

- stale branding or mixed visual language
- mojibake or other encoding glitches
- awkward labels or status copy
- dead controls
- broken return paths
- weak spacing or hierarchy that makes the flow hard to read
- browser or React Native Web warnings that point to broken behavior
- external asset failures that visibly degrade the page

## Cross-surface parity

- when a feature exists on both web and mobile, compare the user-facing capability before calling the work finished
- parity does not require identical layout, but it does require equivalent completion for the supported flow
