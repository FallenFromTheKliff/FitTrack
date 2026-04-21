# Domain Agent Driver Sleep Mode Domain Registry

Sleep mode uses this registry and proceeds in this order unless the operator explicitly edits the shared strategy later:

| Code | Domain | Workspace Folder | Context File |
| --- | --- | --- | --- |
| `S4` | Subscription & Payments | `tasks/s4-subscription-payments` | `context/s4-subscription-payments.md` |
| `S5` | Facility Bookings | `tasks/s5-facility-bookings` | `context/s5-facility-bookings.md` |
| `S6` | Coaching | `tasks/s6-coaching` | `context/s6-coaching.md` |
| `S7` | Fitness Training | `tasks/s7-fitness-training` | `context/s7-fitness-training.md` |
| `S8` | Gamification | `tasks/s8-gamification` | `context/s8-gamification.md` |
| `S9` | TDEE & Nutrition | `tasks/s9-tdee-nutrition` | `context/s9-tdee-nutrition.md` |
| `S10` | Inventory | `tasks/s10-inventory` | `context/s10-inventory.md` |
| `S11` | AI Chatbot | `tasks/s11-ai-chatbot` | `context/s11-ai-chatbot.md` |
| `S12` | Notifications | `tasks/s12-notifications` | `context/s12-notifications.md` |
| `S13` | Gym Layout & Analytics | `tasks/s13-gym-layout-analytics` | `context/s13-gym-layout-analytics.md` |
| `S14` | Auditing Refinement | `tasks/s14-auditing-refinement` | `context/s14-auditing.md` |
| `S15` | Pose Estimate | `tasks/s15-pose-estimate` | `context/python/s15-pose-estimate.md` |
| `S16` | AI Chatbot | `tasks/s16-ai-chatbot` | `context/python/s16-ai-chatbot.md` |
| `S17` | Business Analytics | `tasks/s17-business-analytics` | `context/python/s17-business-analytics.md` |

For `S15` through `S17`, the registry row points to the domain-specific file. Workers must also include `context/python/00-python-microservice-contracts.md` and `context/00-global-contracts.md`.

If a listed workspace folder does not exist yet, the loop runner should bootstrap it before starting that domain when the current driver already points at that registered domain.

When sleep mode advances to the next registry entry, rewrite the top session variables in `tasks/domain-agent-driver.md` to that next domain's:

- `DOMAIN_FOLDER`
- `DOMAIN_CODE`
- `DOMAIN_NAME`
- `DOMAIN_CONTEXT_FILE`
- `CURRENT_PHASE: review`
- `CURRENT_TASK_FILE: none`
- `MODULE_HINTS` aligned to the next domain's likely module roots when they are obvious from the context file

This keeps future reruns pointed at the correct next domain without requiring manual variable swapping.
