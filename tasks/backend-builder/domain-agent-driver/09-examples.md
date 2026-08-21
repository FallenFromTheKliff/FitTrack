# Domain Agent Driver Example Values

Use this file for operator reference only.
It is not part of the normal task-run context unless the current run explicitly needs example values.

## Example: S4 Review

- `DOMAIN_FOLDER:` `tasks/s4-subscription-payments`
- `DOMAIN_CODE:` `S4`
- `DOMAIN_NAME:` `Subscription & Payments`
- `DOMAIN_CONTEXT_FILE:` `context/s4-subscription-payments.md`
- `AUTO_MODE:` `off`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `1`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK_FILE:` `none`
- `MODULE_HINTS:`
  - `capstone-backend/src/membership`
  - `capstone-backend/src/user`
  - `capstone-backend/src/auth`
  - `capstone-backend/prisma`

## Example: S4 Task Implementation

- `DOMAIN_FOLDER:` `tasks/s4-subscription-payments`
- `DOMAIN_CODE:` `S4`
- `DOMAIN_NAME:` `Subscription & Payments`
- `DOMAIN_CONTEXT_FILE:` `context/s4-subscription-payments.md`
- `AUTO_MODE:` `task`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `1`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `CURRENT_PHASE:` `implement`
- `CURRENT_TASK_FILE:` `tasks/s4-subscription-payments/active/TASK-404-payments-core-manual-flow.md`
- `MODULE_HINTS:`
  - `capstone-backend/src/membership`
  - `capstone-backend/src/common`
  - `capstone-backend/prisma`

## Example: S4 Domain Auto-Run

- `DOMAIN_FOLDER:` `tasks/s4-subscription-payments`
- `DOMAIN_CODE:` `S4`
- `DOMAIN_NAME:` `Subscription & Payments`
- `DOMAIN_CONTEXT_FILE:` `context/s4-subscription-payments.md`
- `AUTO_MODE:` `domain`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `2`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK_FILE:` `tasks/s4-subscription-payments/active/TASK-404-payments-core-manual-flow.md`
- `MODULE_HINTS:`
  - `capstone-backend/src/membership`
  - `capstone-backend/src/common`
  - `capstone-backend/prisma`

## Example: Cross-Domain Sleep Run

- `DOMAIN_FOLDER:` `tasks/s5-facility-bookings`
- `DOMAIN_CODE:` `S5`
- `DOMAIN_NAME:` `Facility Bookings`
- `DOMAIN_CONTEXT_FILE:` `context/s5-facility-bookings.md`
- `AUTO_MODE:` `sleep`
- `ECO_MODE:` `off`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `25`
- `MAX_DOMAINS_PER_RUN:` `1`
- `MAX_SELF_HEAL_ATTEMPTS_PER_TASK:` `2`
- `HARD_STOP_FILE:` `tasks/SLEEP_MODE_STOP.md`
- `TASK_BREAK_MODE:` `off`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK_FILE:` `none`
- `MODULE_HINTS:`
  - `capstone-backend/src/bookings`
  - `capstone-backend/src/membership`
  - `capstone-backend/src/user`
  - `capstone-backend/prisma`

## Example: One-Domain Eco Sleep Run

- `DOMAIN_FOLDER:` `tasks/s6-coaching`
- `DOMAIN_CODE:` `S6`
- `DOMAIN_NAME:` `Coaching`
- `DOMAIN_CONTEXT_FILE:` `context/s6-coaching.md`
- `AUTO_MODE:` `sleep`
- `ECO_MODE:` `on`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `15`
- `MAX_DOMAINS_PER_RUN:` `1`
- `MAX_SELF_HEAL_ATTEMPTS_PER_TASK:` `2`
- `HARD_STOP_FILE:` `tasks/SLEEP_MODE_STOP.md`
- `TASK_BREAK_MODE:` `off`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK_FILE:` `none`
- `MODULE_HINTS:`
  - `capstone-backend/src/coaching`
  - `capstone-backend/src/user`
  - `capstone-backend/prisma`
