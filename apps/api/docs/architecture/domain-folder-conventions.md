# Domain Folder Conventions

These rules define how we structure domains that contain multiple business
modules.

## Multi-Module Domains

- Keep the domain root thin.
- If a domain owns multiple business modules, each module gets its own
  subfolder.
- Put controllers, services, repositories, DTOs, events, and tests beside the
  module that owns them.
- Keep only truly shared domain wiring at the root, such as the Nest module or
  cross-module constants.

## Current Examples

- `src/auth/` with `src/auth/otp/`
- `src/membership/` with:
  - `src/membership/subscription/`
  - `src/membership/payment/`

## Design Goal

- Structural boundaries should match business boundaries.
- A service file should not become a mixed-responsibility dumping ground just
  because two concerns happen to live in the same domain.
- Future domains such as `subscription/payment`, `booking/checkin`, or similar
  splits should start with subfolders instead of being flattened first and
  reorganized later.
