# Gym chat contract deployment boundary

The Docker Compose file builds the API and Python services independently. The API waits for the Python health check, but the two images are not deployed atomically.

Use this compatibility-first release sequence for the grounding contract removal:

1. Release a temporary Python bridge that accepts the retired grounding key as optional and ignores it.
2. Wait for the bridge health check, then release the API removal that stops sending that key.
3. After the API is healthy on the new contract, release the final Python image with the bridge removed.

The bridge is transition-only. It must exist only in the intermediate compatibility release and must not be present in the final repository tree. No production deployment was performed for this change.

Preserved contract lanes include membership-plan grounding, operating hours, special schedules, FAQs, and the existing subscription and checkout flows.
